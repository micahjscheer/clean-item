import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { z } from "zod";
import * as R from "remeda";
import { conditionSchema } from "./validators";

const VISION_MODEL_ID =
  process.env.GEMINI_VISION_MODEL_ID ?? "gemini-3.0-pro-vision";
const OPENAI_RESEARCH_MODEL =
  process.env.OPENAI_RESEARCH_MODEL ?? "gpt-4.1";

const conditionEnum = z.enum(["new", "like_new", "good", "fair", "poor"]);

const stringValue = z.preprocess((value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, z.string().nullable());

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const numberValue = z.preprocess((value) => parseNumber(value), z.number().nullable());

const confidenceValue = z.preprocess((value) => {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}, z.number().nullable());

const stringArrayValue = z.preprocess((value) => {
  if (!Array.isArray(value)) return null;
  const cleaned = R.pipe(
    value,
    R.filter((item) => typeof item === "string"),
    R.map((item) => item.trim()),
    R.filter((item) => item.length > 0)
  );
  return cleaned.length ? cleaned : null;
}, z.array(z.string()).nullable());

const dimensionsSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}, z.object({
  length: numberValue,
  width: numberValue,
  height: numberValue,
  unit: z.enum(["cm", "in"]).nullable(),
}).nullable());

const extractionSchema = z.object({
  item_name: stringValue,
  brand: stringValue,
  model: stringValue,
  category: stringValue,
  variant: stringValue,
  materials: stringArrayValue,
  colors: stringArrayValue,
  condition: stringValue,
  visible_wear: stringArrayValue,
  issues: stringArrayValue,
  missing_parts: stringArrayValue,
  included_items: stringArrayValue,
  markings: stringArrayValue,
  serial_numbers: stringArrayValue,
  accessories: stringArrayValue,
  dimensions: dimensionsSchema,
  notes: stringValue,
});

const productSchema = z.object({
  name: stringValue,
  brand: stringValue,
  model: stringValue,
  category: stringValue,
  variant: stringValue,
  confidence: confidenceValue,
  confidence_label: stringValue,
  evidence: stringArrayValue,
});

const sourceSchema = z.object({
  title: stringValue,
  url: stringValue,
  price: numberValue,
  condition: stringValue,
  type: stringValue,
});

const objectValue = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value;
  }, schema);

const pricingSchema = z.object({
  currency: stringValue,
  new: objectValue(
    z.object({
      average: numberValue,
      minimum: numberValue,
    })
  ),
  used: objectValue(
    z.object({
      low: numberValue,
      median: numberValue,
      high: numberValue,
    })
  ),
  recommended: objectValue(
    z.object({
      price: numberValue,
      rationale: stringValue,
    })
  ),
  sources: z.preprocess((value) => {
    if (!Array.isArray(value)) return null;
    return value;
  }, z.array(sourceSchema).nullable()),
});

const listingSchema = z.object({
  title: stringValue,
  description: stringValue,
  reason_for_selling: stringValue,
  issues: stringArrayValue,
  loved: stringArrayValue,
  highlights: stringArrayValue,
  condition: stringValue,
  recommended_price: numberValue,
});

const researchSchema = z.object({
  product: productSchema,
  pricing: pricingSchema,
  listing: listingSchema,
});

const geminiResponseSchema = z
  .object({
    candidates: z
      .array(
        z.object({
          content: z
            .object({
              parts: z
                .array(
                  z.object({
                    text: z.string().optional(),
                  })
                )
                .optional(),
            })
            .optional(),
        })
      )
      .optional(),
  })
  .passthrough();

const openAiResponseSchema = z
  .object({
    output_text: z.string().optional(),
    output: z
      .array(
        z.object({
          type: z.string().optional(),
          content: z
            .array(
              z.object({
                type: z.string().optional(),
                text: z.string().optional(),
              })
            )
            .optional(),
        })
      )
      .optional(),
    choices: z
      .array(
        z.object({
          message: z
            .object({
              content: z.string().optional(),
            })
            .optional(),
        })
      )
      .optional(),
  })
  .passthrough();

const geminiRequestSchema = z.object({
  apiKey: z.string(),
  modelId: z.string(),
  imageBase64: z.string(),
  mimeType: z.string(),
});

const openAiRequestSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
  extraction: extractionSchema,
  condition: conditionEnum,
});

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

export const queueResearch = internalMutation({
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
    const updates = {
      updatedAt: Date.now(),
      ...(args.progressPct !== undefined
        ? { progressPct: args.progressPct }
        : {}),
      ...(args.status ? { status: args.status } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
      ...(args.extraction !== undefined ? { extraction: args.extraction } : {}),
      ...(args.product !== undefined ? { product: args.product } : {}),
      ...(args.pricing !== undefined ? { pricing: args.pricing } : {}),
      ...(args.listing !== undefined ? { listing: args.listing } : {}),
    };

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

      const pricing = finalizePricing(researchResult.pricing, research.condition);
      const listing = finalizeListing({
        listing: researchResult.listing,
        product: researchResult.product,
        pricing,
        condition: research.condition,
        extraction,
      });

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 90,
        product: researchResult.product,
        pricing,
        listing,
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

const callGeminiExtraction = async (
  params: z.infer<typeof geminiRequestSchema>
) => {
  const { apiKey, modelId, imageBase64, mimeType } =
    geminiRequestSchema.parse(params);
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

  const result = geminiResponseSchema.parse(await response.json());
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const text = R.pipe(
    parts,
    R.map((part) => part.text),
    R.filter((value) => typeof value === "string" && value.trim().length > 0),
    (items) => items.join("\n").trim()
  );

  return parseJsonWithSchema(
    extractionSchema,
    text,
    "Gemini returned invalid extraction JSON"
  );
};

const callOpenAiResearch = async (
  params: z.infer<typeof openAiRequestSchema>
) => {
  const { apiKey, model, extraction, condition } =
    openAiRequestSchema.parse(params);
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

  const result = await requestOpenAi(apiKey, {
    ...basePayload,
    tools: [{ type: "web_search" }],
  }).catch((error) => {
    if (shouldFallbackToNoTools(error)) {
      return requestOpenAi(apiKey, basePayload);
    }
    throw error;
  });

  const outputText = extractResponseText(result);
  return parseJsonWithSchema(
    researchSchema,
    outputText,
    "OpenAI returned invalid research JSON"
  );
};

function buildGeminiPrompt() {
  return [
    "You are a careful product inspector.",
    "From the image, extract the product details as JSON only.",
    "Include condition and any visible issues or missing parts.",
    "Condition should be one of: new, like_new, good, fair, poor.",
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

const parseJsonWithSchema = (
  schema: z.ZodTypeAny,
  text: string,
  errorMessage: string
) => {
  const parsed = safeJsonParse(text);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(errorMessage);
  }
  return result.data;
};

const extractResponseText = (result: z.infer<typeof openAiResponseSchema>) => {
  if (result.output_text) {
    return result.output_text;
  }

  if (result.output) {
    for (const item of result.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        const textParts = item.content
          .map((content) =>
            content.type === "output_text" ? content.text : null
          )
          .filter((text) => typeof text === "string");
        if (textParts.length > 0) {
          return textParts.join("");
        }
      }
    }
  }

  if (result.choices) {
    const content = result.choices[0]?.message?.content;
    if (content) return content;
  }

  return "";
};

const requestOpenAi = async (apiKey: string, payload: unknown) => {
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

  const parsed = responseText ? safeJsonParse(responseText) : {};
  return openAiResponseSchema.parse(parsed);
};

const shouldFallbackToNoTools = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("web_search") ||
    message.includes("tool") ||
    message.includes("unsupported") ||
    message.includes("unknown")
  );
};

const safeJsonParse = (text: string) => {
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
};

const finalizePricing = (
  pricing: z.infer<typeof pricingSchema>,
  condition: z.infer<typeof conditionEnum>
) => {
  const currency = pricing.currency ?? "USD";
  const fallback = computeRecommendation({
    condition,
    newAverage: pricing.new.average,
    newMinimum: pricing.new.minimum,
    usedLow: pricing.used.low,
    usedMedian: pricing.used.median,
    usedHigh: pricing.used.high,
  });

  const recommendedPrice = pricing.recommended.price ?? fallback.price;
  const recommendedRationale =
    pricing.recommended.rationale ?? fallback.rationale ?? null;

  const filteredSources = pricing.sources
    ? R.pipe(
        pricing.sources,
        R.filter((source) => source.url)
      )
    : null;

  return {
    ...pricing,
    currency,
    recommended: {
      price: recommendedPrice,
      rationale: recommendedRationale,
    },
    sources: filteredSources && filteredSources.length > 0 ? filteredSources : null,
  };
};

const finalizeListing = ({
  listing,
  product,
  pricing,
  condition,
  extraction,
}: {
  listing: z.infer<typeof listingSchema>;
  product: z.infer<typeof productSchema>;
  pricing: z.infer<typeof pricingSchema>;
  condition: z.infer<typeof conditionEnum>;
  extraction: z.infer<typeof extractionSchema>;
}) => {
  const issues = firstNonEmptyList([
    listing.issues,
    extraction.issues,
    extraction.visible_wear,
    extraction.missing_parts,
  ]);

  const listingCondition =
    listing.condition ?? extraction.condition ?? condition ?? null;

  const recommendedPrice =
    listing.recommended_price ?? pricing.recommended.price ?? null;

  return {
    ...listing,
    title: listing.title ?? product.name,
    issues,
    condition: listingCondition,
    recommended_price: recommendedPrice,
  };
};

const firstNonEmptyList = (lists: Array<unknown>) => {
  const found = R.find(lists, (list) => Array.isArray(list) && list.length > 0);
  return found ?? null;
};

const computeRecommendation = ({
  condition,
  newAverage,
  newMinimum,
  usedLow,
  usedMedian,
  usedHigh,
}: {
  condition: z.infer<typeof conditionEnum>;
  newAverage: number | null;
  newMinimum: number | null;
  usedLow: number | null;
  usedMedian: number | null;
  usedHigh: number | null;
}) => {
  const parsedCondition = conditionEnum.safeParse(condition);
  const conditionKey = parsedCondition.success ? parsedCondition.data : "good";

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
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
