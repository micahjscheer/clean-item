import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const VISION_MODEL_ID =
  process.env.GEMINI_VISION_MODEL_ID ?? "gemini-3.0-pro-vision";
const OPENAI_RESEARCH_MODEL =
  process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4.1";

const conditionSchema = v.union(
  v.literal("new"),
  v.literal("like_new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("poor")
);

export const startResearch = mutation({
  args: {
    imageId: v.id("images"),
    condition: conditionSchema,
  },
  handler: async (ctx, args) => {
    const researchId = await ctx.db.insert("productResearch", {
      imageId: args.imageId,
      status: "queued",
      progressPct: 0,
      condition: args.condition,
      extractModelId: VISION_MODEL_ID,
      researchModelId: OPENAI_RESEARCH_MODEL,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.research.processResearch, {
      researchId,
    });

    return researchId;
  },
});

export const getResearchByUpload = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("images")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .collect();

    const imageIds = images.map((img) => img._id);

    const allResearch = await Promise.all(
      imageIds.map((imageId) =>
        ctx.db
          .query("productResearch")
          .withIndex("by_image", (q) => q.eq("imageId", imageId))
          .first()
      )
    );

    return allResearch.filter((research) => research !== null);
  },
});

export const getResearch = internalQuery({
  args: { researchId: v.id("productResearch") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.researchId);
  },
});

export const getImage = internalQuery({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
  },
});

export const updateResearch = internalMutation({
  args: {
    researchId: v.id("productResearch"),
    progressPct: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed")
      )
    ),
    error: v.optional(v.string()),
    extraction: v.optional(v.any()),
    product: v.optional(v.any()),
    pricing: v.optional(v.any()),
    listing: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.progressPct !== undefined) updates.progressPct = args.progressPct;
    if (args.status) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;
    if (args.extraction !== undefined) updates.extraction = args.extraction;
    if (args.product !== undefined) updates.product = args.product;
    if (args.pricing !== undefined) updates.pricing = args.pricing;
    if (args.listing !== undefined) updates.listing = args.listing;

    await ctx.db.patch(args.researchId, updates);
  },
});

export const processResearch = internalAction({
  args: { researchId: v.id("productResearch") },
  handler: async (ctx, args) => {
    const research = await ctx.runQuery(internal.research.getResearch, {
      researchId: args.researchId,
    });

    if (!research) {
      console.error("Research job not found:", args.researchId);
      return;
    }

    const image = await ctx.runQuery(internal.research.getImage, {
      imageId: research.imageId,
    });

    if (!image) {
      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 0,
        status: "failed",
        error: "Image not found",
      });
      return;
    }

    await ctx.runMutation(internal.research.updateResearch, {
      researchId: args.researchId,
      progressPct: 10,
      status: "running",
    });

    try {
      const imageUrl = await ctx.storage.getUrl(image.storageId);
      if (!imageUrl) {
        throw new Error("Could not get image URL");
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new Error(
          `Image fetch failed: ${imageResponse.status} - ${errorText}`
        );
      }
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = arrayBufferToBase64(imageArrayBuffer);

      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY not configured");
      }

      const extraction = await callGeminiExtraction({
        apiKey,
        modelId: research.extractModelId,
        imageBase64,
        mimeType: image.mimeType,
      });

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 40,
        extraction,
      });

      const openAiKey = process.env.OPENAI_API_KEY;
      if (!openAiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      const researchResult = await callOpenAiResearch({
        apiKey: openAiKey,
        model: research.researchModelId,
        extraction,
        condition: research.condition,
      });

      const normalizedProduct = normalizeProduct(researchResult.product);
      const normalizedPricing = normalizePricing(
        researchResult.pricing,
        research.condition
      );
      const normalizedListing = normalizeListing(
        researchResult.listing,
        normalizedProduct,
        normalizedPricing,
        research.condition,
        extraction
      );

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 90,
        product: normalizedProduct,
        pricing: normalizedPricing,
        listing: normalizedListing,
      });

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 100,
        status: "succeeded",
      });
    } catch (error) {
      console.error("Research processing failed:", error);
      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 0,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

async function callGeminiExtraction({
  apiKey,
  modelId,
  imageBase64,
  mimeType,
}: {
  apiKey: string;
  modelId: string;
  imageBase64: string;
  mimeType: string;
}) {
  const prompt = buildGeminiPrompt();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part: { text?: string }) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  const parsed = safeJsonParse(text);
  if (!parsed) {
    throw new Error("Gemini returned invalid extraction JSON");
  }

  return parsed;
}

async function callOpenAiResearch({
  apiKey,
  model,
  extraction,
  condition,
}: {
  apiKey: string;
  model: string;
  extraction: unknown;
  condition: string;
}) {
  const prompt = buildOpenAiPrompt(extraction, condition);
  const basePayload = {
    model,
    temperature: 0.2,
    input: [
      {
        role: "system",
        content:
          "You are a product research assistant. Use web search when helpful.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: buildOpenAiSchema(),
    },
  };

  let result: any;
  try {
    result = await requestOpenAi(apiKey, {
      ...basePayload,
      tools: [{ type: "web_search" }],
    });
  } catch (error) {
    if (shouldFallbackToNoTools(error)) {
      result = await requestOpenAi(apiKey, basePayload);
    } else {
      throw error;
    }
  }
  const outputText = extractResponseText(result);
  const parsed = safeJsonParse(outputText);

  if (!parsed) {
    throw new Error("OpenAI returned invalid research JSON");
  }

  return parsed as { product: unknown; pricing: unknown; listing: unknown };
}

function buildGeminiPrompt() {
  return [
    "You are a careful product inspector.",
    "From the image, extract the product details as JSON only.",
    "Include condition and any visible issues or missing parts.",
    "Condition should be one of: new, like new, good, fair, poor.",
    "Use the schema below and return null when unknown.",
    "Do not include any extra commentary or markdown.",
    "",
    "Schema:",
    "{",
    '  "item_name": string | null,',
    '  "brand": string | null,',
    '  "model": string | null,',
    '  "category": string | null,',
    '  "variant": string | null,',
    '  "materials": string[] | null,',
    '  "colors": string[] | null,',
    '  "condition": string | null,',
    '  "visible_wear": string[] | null,',
    '  "issues": string[] | null,',
    '  "missing_parts": string[] | null,',
    '  "included_items": string[] | null,',
    '  "markings": string[] | null,',
    '  "serial_numbers": string[] | null,',
    '  "accessories": string[] | null,',
    '  "dimensions": { "length": number | null, "width": number | null, "height": number | null, "unit": "cm" | "in" | null } | null,',
    '  "notes": string | null',
    "}",
  ].join("\n");
}

function buildOpenAiPrompt(extraction: unknown, condition: string) {
  const extractionText = JSON.stringify(extraction, null, 2);
  return [
    "Identify the exact product and research pricing.",
    "Use the extracted visual details below.",
    `Condition for pricing: ${condition}.`,
    "",
    "Provide confidence as 0-1 and a label (low, medium, high).",
    "Use multiple searches if needed to disambiguate similar products.",
    "Recommended price must reflect the stated condition.",
    "Write a Facebook Marketplace ready listing title and description.",
    "The description must include: reason for selling, any issues, and what they loved.",
    "Include recommended_price in the listing output.",
    "If reason for selling is unknown, suggest a neutral option like upgrading or decluttering.",
    "Issues should reflect visible wear or missing parts from the extraction.",
    "Use a friendly, concise tone that avoids exaggeration.",
    "Return JSON that matches the schema exactly.",
    "If you cannot find a value, return null.",
    "Provide 3-6 sources with URLs and prices when available.",
    "",
    "Extracted details:",
    extractionText,
  ].join("\n");
}

function buildOpenAiSchema() {
  return {
    name: "product_research",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        product: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: ["string", "null"] },
            brand: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            variant: { type: ["string", "null"] },
            confidence: { type: ["number", "null"] },
            confidence_label: {
              type: ["string", "null"],
              enum: ["low", "medium", "high", null],
            },
            evidence: {
              type: ["array", "null"],
              items: { type: "string" },
            },
          },
          required: ["name", "confidence", "confidence_label"],
        },
        pricing: {
          type: "object",
          additionalProperties: false,
          properties: {
            currency: { type: ["string", "null"] },
            new: {
              type: "object",
              additionalProperties: false,
              properties: {
                average: { type: ["number", "null"] },
                minimum: { type: ["number", "null"] },
              },
              required: ["average", "minimum"],
            },
            used: {
              type: "object",
              additionalProperties: false,
              properties: {
                low: { type: ["number", "null"] },
                median: { type: ["number", "null"] },
                high: { type: ["number", "null"] },
              },
              required: ["low", "median", "high"],
            },
            recommended: {
              type: "object",
              additionalProperties: false,
              properties: {
                price: { type: ["number", "null"] },
                rationale: { type: ["string", "null"] },
              },
              required: ["price", "rationale"],
            },
            sources: {
              type: ["array", "null"],
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: ["string", "null"] },
                  url: { type: ["string", "null"] },
                  price: { type: ["number", "null"] },
                  condition: { type: ["string", "null"] },
                  type: { type: ["string", "null"] },
                },
                required: ["title", "url", "price", "condition", "type"],
              },
            },
          },
          required: ["currency", "new", "used", "recommended"],
        },
        listing: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            reason_for_selling: { type: ["string", "null"] },
            issues: {
              type: ["array", "null"],
              items: { type: "string" },
            },
            loved: {
              type: ["array", "null"],
              items: { type: "string" },
            },
            highlights: {
              type: ["array", "null"],
              items: { type: "string" },
            },
            condition: { type: ["string", "null"] },
            recommended_price: { type: ["number", "null"] },
          },
          required: [
            "title",
            "description",
            "reason_for_selling",
            "issues",
            "loved",
            "highlights",
            "condition",
            "recommended_price",
          ],
        },
      },
      required: ["product", "pricing", "listing"],
    },
  };
}

function extractResponseText(result: any): string {
  if (typeof result?.output_text === "string") {
    return result.output_text;
  }

  if (Array.isArray(result?.output)) {
    for (const item of result.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        const textParts = item.content
          .filter((content: any) => content?.type === "output_text")
          .map((content: any) => content?.text)
          .filter((text: any) => typeof text === "string");
        if (textParts.length > 0) {
          return textParts.join("");
        }
      }
    }
  }

  if (Array.isArray(result?.choices)) {
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
  }

  return "";
}

async function requestOpenAi(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} - ${responseText}`
    );
  }

  return responseText ? JSON.parse(responseText) : {};
}

function shouldFallbackToNoTools(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("web_search") ||
    message.includes("tool") ||
    message.includes("unsupported") ||
    message.includes("unknown")
  );
}

function safeJsonParse(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (parseError) {
      return null;
    }
  }
}

function normalizeProduct(product: any) {
  const confidenceRaw = toNumber(product?.confidence);
  const confidence =
    confidenceRaw !== null && confidenceRaw > 1
      ? confidenceRaw / 100
      : confidenceRaw;

  return {
    name: normalizeString(product?.name),
    brand: normalizeString(product?.brand),
    model: normalizeString(product?.model),
    category: normalizeString(product?.category),
    variant: normalizeString(product?.variant),
    confidence,
    confidence_label: normalizeString(product?.confidence_label),
    evidence: Array.isArray(product?.evidence)
      ? product.evidence.filter((item: unknown) => typeof item === "string")
      : null,
  };
}

function normalizePricing(pricing: any, condition: string) {
  const currency = normalizeString(pricing?.currency) ?? "USD";
  const newAverage = toNumber(pricing?.new?.average);
  const newMinimum = toNumber(pricing?.new?.minimum);
  const usedLow = toNumber(pricing?.used?.low);
  const usedMedian = toNumber(pricing?.used?.median);
  const usedHigh = toNumber(pricing?.used?.high);

  const recommendedFromModel = toNumber(pricing?.recommended?.price);
  const recommendationFromModel = normalizeString(pricing?.recommended?.rationale);

  const fallback = computeRecommendation({
    condition,
    newAverage,
    newMinimum,
    usedLow,
    usedMedian,
    usedHigh,
  });

  const recommendedPrice =
    recommendedFromModel !== null ? recommendedFromModel : fallback.price;
  const recommendedRationale =
    recommendationFromModel ?? fallback.rationale ?? null;

  const sources = Array.isArray(pricing?.sources)
    ? pricing.sources
        .map((source: any) => ({
          title: normalizeString(source?.title),
          url: normalizeString(source?.url),
          price: toNumber(source?.price),
          condition: normalizeString(source?.condition),
          type: normalizeString(source?.type),
        }))
        .filter((source: any) => source.url)
    : null;

  return {
    currency,
    new: {
      average: newAverage,
      minimum: newMinimum,
    },
    used: {
      low: usedLow,
      median: usedMedian,
      high: usedHigh,
    },
    recommended: {
      price: recommendedPrice,
      rationale: recommendedRationale,
    },
    sources,
  };
}

function normalizeListing(
  listing: any,
  product: ReturnType<typeof normalizeProduct>,
  pricing: ReturnType<typeof normalizePricing>,
  condition: string,
  extraction: any
) {
  const title = normalizeString(listing?.title) ?? product.name ?? null;
  const description = normalizeString(listing?.description);
  const reasonForSelling = normalizeString(listing?.reason_for_selling);
  const issuesFromListing = Array.isArray(listing?.issues)
    ? listing.issues.filter((item: unknown) => typeof item === "string")
    : null;
  const issuesFromExtraction = Array.isArray(extraction?.issues)
    ? extraction.issues.filter((item: unknown) => typeof item === "string")
    : null;
  const wearFromExtraction = Array.isArray(extraction?.visible_wear)
    ? extraction.visible_wear.filter((item: unknown) => typeof item === "string")
    : null;
  const missingFromExtraction = Array.isArray(extraction?.missing_parts)
    ? extraction.missing_parts.filter(
        (item: unknown) => typeof item === "string"
      )
    : null;
  const issues =
    issuesFromListing ??
    issuesFromExtraction ??
    wearFromExtraction ??
    missingFromExtraction ??
    null;
  const loved = Array.isArray(listing?.loved)
    ? listing.loved.filter((item: unknown) => typeof item === "string")
    : null;
  const highlights = Array.isArray(listing?.highlights)
    ? listing.highlights.filter((item: unknown) => typeof item === "string")
    : null;
  const listingCondition =
    normalizeString(listing?.condition) ??
    normalizeString(extraction?.condition) ??
    condition ??
    null;

  const recommended =
    pricing?.recommended?.price !== null &&
    pricing?.recommended?.price !== undefined
      ? pricing.recommended.price
      : toNumber(listing?.recommended_price);

  return {
    title,
    description,
    reason_for_selling: reasonForSelling,
    issues,
    loved,
    highlights,
    condition: listingCondition,
    recommended_price: recommended,
  };
}

function computeRecommendation({
  condition,
  newAverage,
  newMinimum,
  usedLow,
  usedMedian,
  usedHigh,
}: {
  condition: string;
  newAverage: number | null;
  newMinimum: number | null;
  usedLow: number | null;
  usedMedian: number | null;
  usedHigh: number | null;
}) {
  const conditionKey = condition as
    | "new"
    | "like_new"
    | "good"
    | "fair"
    | "poor";

  const rangeMid =
    usedLow !== null && usedHigh !== null
      ? (usedLow + usedHigh) / 2
      : usedMedian;

  let price: number | null = null;
  let rationale: string | null = null;

  switch (conditionKey) {
    case "new":
      price = newAverage ?? newMinimum ?? usedHigh ?? rangeMid ?? usedLow;
      rationale =
        "Condition is new, so pricing anchors to new retail averages.";
      break;
    case "like_new":
      price = usedHigh ?? newMinimum ?? rangeMid ?? usedMedian ?? usedLow;
      rationale =
        "Like-new items typically sell near the top of used ranges.";
      break;
    case "good":
      price = usedMedian ?? rangeMid ?? usedLow ?? usedHigh;
      rationale = "Good condition anchors near the used median.";
      break;
    case "fair":
      price = usedLow ?? usedMedian ?? rangeMid;
      rationale = "Fair condition anchors near the used low end.";
      break;
    case "poor":
      price =
        usedLow !== null
          ? usedLow * 0.7
          : usedMedian !== null
          ? usedMedian * 0.6
          : newMinimum !== null
          ? newMinimum * 0.5
          : null;
      rationale =
        "Poor condition reduces pricing below typical used lows.";
      break;
    default:
      price = usedMedian ?? rangeMid ?? usedLow ?? usedHigh ?? newMinimum;
      rationale = "Condition unknown; defaulting to used median pricing.";
  }

  if (price !== null) {
    price = Math.round(price * 100) / 100;
  }

  return { price, rationale };
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
