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

const CLASSIFIER_MODEL_ID =
  process.env.OPENROUTER_CLASSIFIER_MODEL ?? "google/gemini-2.5-flash";
const GEMINI_RESEARCH_MODEL_ID =
  process.env.GEMINI_RESEARCH_MODEL ?? "gemini-2.5-pro";
const OPENAI_RESEARCH_MODEL_ID = process.env.OPENAI_RESEARCH_MODEL ?? "o3";

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

const relevanceStageSchema = z.object({
  is_relevant: z.boolean().default(true),
  reason: stringValue.default(null),
  distracting_elements: stringArrayValue.default(null),
});

const classifierStageSchema = z.object({
  main_item: stringValue.default(null),
  category: stringValue.default(null),
  brand: stringValue.default(null),
  model: stringValue.default(null),
  model_number: stringValue.default(null),
  condition: stringValue.default(null),
  confidence: confidenceValue.default(null),
  confidence_label: stringValue.default(null),
  special_findings: stringArrayValue.default(null),
  visible_wear: stringArrayValue.default(null),
  issues: stringArrayValue.default(null),
  missing_parts: stringArrayValue.default(null),
  included_items: stringArrayValue.default(null),
  accessories: stringArrayValue.default(null),
  markings: stringArrayValue.default(null),
  serial_numbers: stringArrayValue.default(null),
  materials: stringArrayValue.default(null),
  colors: stringArrayValue.default(null),
  dimensions: dimensionsSchema.default(null),
  notes: stringValue.default(null),
  relevance: relevanceStageSchema.default({
    is_relevant: true,
    reason: null,
    distracting_elements: null,
  }),
});

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
  main_item: stringValue,
  model_number: stringValue,
  special_findings: stringArrayValue,
  confidence: confidenceValue,
  confidence_label: stringValue,
  relevance: relevanceStageSchema,
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

const objectValue = <T extends z.ZodTypeAny>(schema: T) =>
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

const geminiResearchStageSchema = z.object({
  product: productSchema,
  pricing: pricingSchema,
  listing: listingSchema,
});

const openAiResearchStageSchema = z.object({
  product: productSchema,
  pricing: pricingSchema,
  listing: listingSchema,
});

const mergedResearchStageSchema = z.object({
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

const openRouterResponseSchema = z
  .object({
    choices: z
      .array(
        z.object({
          message: z
            .object({
              content: z.any().optional(),
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

const classifierRequestSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
  imageBase64: z.string(),
  mimeType: z.string(),
});

const geminiResearchRequestSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
  classification: classifierStageSchema,
  condition: conditionEnum,
});

const openAiResearchRequestSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
  classification: classifierStageSchema,
  condition: conditionEnum,
});

type ClassificationStage = z.infer<typeof classifierStageSchema>;
type ExtractionStage = z.infer<typeof extractionSchema>;
type ResearchStage = z.infer<typeof mergedResearchStageSchema>;

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
      extractModelId: CLASSIFIER_MODEL_ID,
      researchModelId: `${GEMINI_RESEARCH_MODEL_ID} | ${OPENAI_RESEARCH_MODEL_ID}`,
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
      extractModelId: CLASSIFIER_MODEL_ID,
      researchModelId: `${GEMINI_RESEARCH_MODEL_ID} | ${OPENAI_RESEARCH_MODEL_ID}`,
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

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        throw new Error("OPENROUTER_API_KEY not configured");
      }

      const classification = await callOpenRouterClassifier({
        apiKey: openRouterKey,
        model: research.extractModelId || CLASSIFIER_MODEL_ID,
        imageBase64,
        mimeType: image.mimeType,
      });

      const extraction = normalizeClassification(classification);
      const classifierCondition = normalizeCondition(classification.condition);
      const resolvedCondition = classifierCondition ?? research.condition;

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 35,
        extraction,
      });

      if (!classification.relevance.is_relevant) {
        const irrelevantResult = buildIrrelevantResearchResult(
          classification,
          resolvedCondition
        );
        const finalizedPricing = finalizePricing(
          irrelevantResult.pricing,
          resolvedCondition
        );
        const finalizedListing = finalizeListing({
          listing: irrelevantResult.listing,
          product: irrelevantResult.product,
          pricing: finalizedPricing,
          condition: resolvedCondition,
          extraction,
        });

        await ctx.runMutation(internal.research.updateResearch, {
          researchId: args.researchId,
          progressPct: 100,
          status: "succeeded",
          product: irrelevantResult.product,
          pricing: finalizedPricing,
          listing: finalizedListing,
        });
        return;
      }

      const geminiKey = process.env.GOOGLE_API_KEY;
      if (!geminiKey) {
        throw new Error("GOOGLE_API_KEY not configured");
      }

      const openAiKey = process.env.OPENAI_API_KEY;
      if (!openAiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      const [geminiResearchResult, openAiResearchResult] = await Promise.all([
        callGeminiResearch({
          apiKey: geminiKey,
          model: GEMINI_RESEARCH_MODEL_ID,
          classification,
          condition: resolvedCondition,
        }).catch((error) => {
          console.error("Gemini research stage failed:", error);
          return null;
        }),
        callOpenAiResearch({
          apiKey: openAiKey,
          model: OPENAI_RESEARCH_MODEL_ID,
          classification,
          condition: resolvedCondition,
        }).catch((error) => {
          console.error("OpenAI research stage failed:", error);
          return null;
        }),
      ]);

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 80,
      });

      if (!geminiResearchResult && !openAiResearchResult) {
        throw new Error("Both Gemini and OpenAI research stages failed");
      }

      const mergedResearch = mergeResearchResults({
        gemini: geminiResearchResult,
        openAi: openAiResearchResult,
        classification,
      });

      const parsedMerged = mergedResearchStageSchema.parse(mergedResearch);
      const finalizedPricing = finalizePricing(parsedMerged.pricing, resolvedCondition);
      const finalizedListing = finalizeListing({
        listing: parsedMerged.listing,
        product: parsedMerged.product,
        pricing: finalizedPricing,
        condition: resolvedCondition,
        extraction,
      });

      await ctx.runMutation(internal.research.updateResearch, {
        researchId: args.researchId,
        progressPct: 95,
        product: parsedMerged.product,
        pricing: finalizedPricing,
        listing: finalizedListing,
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

const callOpenRouterClassifier = async (
  params: z.infer<typeof classifierRequestSchema>
) => {
  const { apiKey, model, imageBase64, mimeType } =
    classifierRequestSchema.parse(params);
  const prompt = buildClassifierPrompt();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.OPENROUTER_REFERER ?? "https://create-listing.local",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Create Listing",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict listing-image classifier. Return only valid JSON.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `OpenRouter classifier error: ${response.status} - ${responseText}`
    );
  }

  const parsed = safeJsonParse(responseText);
  const result = openRouterResponseSchema.parse(parsed ?? {});
  const content = extractOpenRouterText(result);

  return parseJsonWithSchema(
    classifierStageSchema,
    content,
    "OpenRouter classifier returned invalid JSON"
  );
};

const callGeminiResearch = async (
  params: z.infer<typeof geminiResearchRequestSchema>
) => {
  const { apiKey, model, classification, condition } =
    geminiResearchRequestSchema.parse(params);
  const prompt = buildGeminiResearchPrompt(classification, condition);

  const attempts: Array<{ includeSearch: boolean; includeThinking: boolean }> = [
    { includeSearch: true, includeThinking: true },
    { includeSearch: false, includeThinking: true },
    { includeSearch: false, includeThinking: false },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const result = await requestGeminiResearch(apiKey, model, prompt, attempt);
      const parts = result.candidates?.[0]?.content?.parts ?? [];
      const text = R.pipe(
        parts,
        R.map((part) => part.text),
        R.filter((value) => typeof value === "string" && value.trim().length > 0),
        (items) => items.join("\n").trim()
      );

      if (!text) {
        throw new Error("Gemini research returned empty response text");
      }

      return parseJsonWithSchema(
        geminiResearchStageSchema,
        text,
        "Gemini research returned invalid JSON"
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Gemini research failed: ${errors.join(" | ")}`);
};

const requestGeminiResearch = async (
  apiKey: string,
  model: string,
  prompt: string,
  options: { includeSearch: boolean; includeThinking: boolean }
) => {
  const generationConfig: {
    responseMimeType: string;
    temperature: number;
    thinkingConfig?: { thinkingBudget: number };
  } = {
    responseMimeType: "application/json",
    temperature: 0.2,
  };

  if (options.includeThinking) {
    generationConfig.thinkingConfig = { thinkingBudget: 4096 };
  }

  const payload: {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: typeof generationConfig;
    tools?: Array<{ googleSearch: Record<string, never> }>;
  } = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig,
  };

  if (options.includeSearch) {
    payload.tools = [{ googleSearch: {} }];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  return geminiResponseSchema.parse(await response.json());
};

const callOpenAiResearch = async (
  params: z.infer<typeof openAiResearchRequestSchema>
) => {
  const { apiKey, model, classification, condition } =
    openAiResearchRequestSchema.parse(params);
  const prompt = buildOpenAiPrompt(classification, condition);

  const basePayload = {
    model,
    reasoning: { effort: "high" as const },
    input: [
      {
        role: "system",
        content:
          "You are a product research assistant. Prefer verifiable marketplace evidence.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        ...buildOpenAiSchema("openai_research_stage"),
      },
    },
  };

  let result: z.infer<typeof openAiResponseSchema>;
  try {
    result = await requestOpenAi(apiKey, {
      ...basePayload,
      tools: [{ type: "web_search_preview" }],
    });
  } catch (previewError) {
    if (!shouldFallbackToLegacyWebSearch(previewError)) {
      throw previewError;
    }
    try {
      result = await requestOpenAi(apiKey, {
        ...basePayload,
        tools: [{ type: "web_search" }],
      });
    } catch (legacyError) {
      if (!shouldFallbackToLegacyWebSearch(legacyError)) {
        throw legacyError;
      }
      result = await requestOpenAi(apiKey, basePayload);
    }
  }

  const outputText = extractResponseText(result);
  return parseJsonWithSchema(
    openAiResearchStageSchema,
    outputText,
    "OpenAI research returned invalid JSON"
  );
};

function buildClassifierPrompt() {
  return [
    "Assess this upload image for a resale listing workflow.",
    "Return JSON only using the schema below.",
    "Identify the main item, model info, condition, and any special findings.",
    "Set relevance.is_relevant to false if the image is unrelated, too blurry to assess, or mostly non-product content.",
    "Condition should map to: new, like_new, good, fair, poor when possible; otherwise null.",
    "If a field is unknown, return null.",
    "",
    "Schema:",
    "{",
    '  "main_item": string | null,',
    '  "category": string | null,',
    '  "brand": string | null,',
    '  "model": string | null,',
    '  "model_number": string | null,',
    '  "condition": string | null,',
    '  "confidence": number | null,',
    '  "confidence_label": string | null,',
    '  "special_findings": string[] | null,',
    '  "visible_wear": string[] | null,',
    '  "issues": string[] | null,',
    '  "missing_parts": string[] | null,',
    '  "included_items": string[] | null,',
    '  "accessories": string[] | null,',
    '  "markings": string[] | null,',
    '  "serial_numbers": string[] | null,',
    '  "materials": string[] | null,',
    '  "colors": string[] | null,',
    '  "dimensions": { "length": number | null, "width": number | null, "height": number | null, "unit": "cm" | "in" | null } | null,',
    '  "notes": string | null,',
    '  "relevance": {',
    '    "is_relevant": boolean,',
    '    "reason": string | null,',
    '    "distracting_elements": string[] | null',
    "  }",
    "}",
  ].join("\n");
}

function buildGeminiResearchPrompt(
  classification: ClassificationStage,
  condition: z.infer<typeof conditionEnum>
) {
  const classificationText = JSON.stringify(
    buildResearchContext(classification, condition),
    null,
    2
  );
  return [
    "You are a product pricing researcher.",
    "Use available web knowledge/search grounding to identify the exact product and estimate realistic pricing.",
    "Prefer concrete market evidence and avoid hallucinations.",
    "Return JSON matching the schema exactly.",
    "When uncertain, keep values null.",
    "",
    "Research context from classifier:",
    classificationText,
    "",
    "Output requirements:",
    "- confidence as 0-1 and confidence_label as low/medium/high",
    "- 3-6 sources when available",
    "- listing copy should be concise and marketplace-ready",
    "- include issues and condition-aligned recommended_price",
    "",
    "Return JSON only.",
  ].join("\n");
}

function buildOpenAiPrompt(
  classification: ClassificationStage,
  condition: z.infer<typeof conditionEnum>
) {
  const classificationText = JSON.stringify(
    buildResearchContext(classification, condition),
    null,
    2
  );
  return [
    "Identify the exact product and research current market pricing.",
    "Use the classifier details below as authoritative starting context.",
    "Think carefully before finalizing answers; prioritize accuracy over coverage.",
    `Condition for valuation: ${condition}.`,
    "",
    "Requirements:",
    "- confidence as 0-1 and confidence_label low/medium/high",
    "- recommended_price must fit condition and findings",
    "- include 3-6 pricing sources with URLs when possible",
    "- generate a friendly but factual listing title and description",
    "- description must include reason_for_selling, issues, and loved points",
    "- return null for unknown values",
    "",
    "Classifier context:",
    classificationText,
    "",
    "Return JSON that matches the schema exactly.",
  ].join("\n");
}

function buildOpenAiSchema(name: string) {
  return {
    name,
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
          required: [
            "name",
            "brand",
            "model",
            "category",
            "variant",
            "confidence",
            "confidence_label",
            "evidence",
          ],
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
          required: ["currency", "new", "used", "recommended", "sources"],
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

const mergeResearchResults = ({
  gemini,
  openAi,
  classification,
}: {
  gemini: ResearchStage | null;
  openAi: ResearchStage | null;
  classification: ClassificationStage;
}): ResearchStage => {
  const fallback = emptyResearchStage();
  const g = gemini ?? fallback;
  const o = openAi ?? fallback;

  const product: z.infer<typeof productSchema> = {
    name: firstNonNull([o.product.name, g.product.name, classification.main_item]),
    brand: firstNonNull([o.product.brand, g.product.brand, classification.brand]),
    model: firstNonNull([
      o.product.model,
      g.product.model,
      classification.model_number,
      classification.model,
    ]),
    category: firstNonNull([
      o.product.category,
      g.product.category,
      classification.category,
    ]),
    variant: firstNonNull([o.product.variant, g.product.variant]),
    confidence: firstNonNullNumber([
      o.product.confidence,
      g.product.confidence,
      classification.confidence,
    ]),
    confidence_label: firstNonNull([
      o.product.confidence_label,
      g.product.confidence_label,
      classification.confidence_label,
    ]),
    evidence: mergeUniqueStrings([
      o.product.evidence,
      g.product.evidence,
      classification.special_findings,
    ]),
  };

  const pricing: z.infer<typeof pricingSchema> = {
    currency: firstNonNull([o.pricing.currency, g.pricing.currency]),
    new: {
      average: firstNonNullNumber([o.pricing.new.average, g.pricing.new.average]),
      minimum: firstNonNullNumber([o.pricing.new.minimum, g.pricing.new.minimum]),
    },
    used: {
      low: firstNonNullNumber([o.pricing.used.low, g.pricing.used.low]),
      median: firstNonNullNumber([o.pricing.used.median, g.pricing.used.median]),
      high: firstNonNullNumber([o.pricing.used.high, g.pricing.used.high]),
    },
    recommended: {
      price: firstNonNullNumber([
        o.pricing.recommended.price,
        g.pricing.recommended.price,
      ]),
      rationale: firstNonNull([
        o.pricing.recommended.rationale,
        g.pricing.recommended.rationale,
      ]),
    },
    sources: mergeSources([o.pricing.sources, g.pricing.sources]),
  };

  const listing: z.infer<typeof listingSchema> = {
    title: firstNonNull([o.listing.title, g.listing.title, classification.main_item]),
    description: firstNonNull([o.listing.description, g.listing.description]),
    reason_for_selling: firstNonNull([
      o.listing.reason_for_selling,
      g.listing.reason_for_selling,
    ]),
    issues: mergeUniqueStrings([
      o.listing.issues,
      g.listing.issues,
      classification.issues,
      classification.special_findings,
    ]),
    loved: mergeUniqueStrings([o.listing.loved, g.listing.loved]),
    highlights: mergeUniqueStrings([
      o.listing.highlights,
      g.listing.highlights,
      classification.special_findings,
    ]),
    condition: firstNonNull([o.listing.condition, g.listing.condition, classification.condition]),
    recommended_price: firstNonNullNumber([
      o.listing.recommended_price,
      g.listing.recommended_price,
      o.pricing.recommended.price,
      g.pricing.recommended.price,
    ]),
  };

  return {
    product,
    pricing,
    listing,
  };
};

const buildIrrelevantResearchResult = (
  classification: ClassificationStage,
  condition: z.infer<typeof conditionEnum>
): ResearchStage => {
  const reason =
    classification.relevance.reason ??
    "Image appears unrelated to a single sellable item.";

  return {
    product: {
      name: classification.main_item,
      brand: classification.brand,
      model: firstNonNull([classification.model_number, classification.model]),
      category: classification.category,
      variant: null,
      confidence: classification.confidence,
      confidence_label: "low",
      evidence: mergeUniqueStrings([
        classification.special_findings,
        [reason],
        classification.relevance.distracting_elements,
      ]),
    },
    pricing: {
      currency: null,
      new: { average: null, minimum: null },
      used: { low: null, median: null, high: null },
      recommended: {
        price: null,
        rationale: reason,
      },
      sources: null,
    },
    listing: {
      title: classification.main_item,
      description: reason,
      reason_for_selling: "Image needs replacement before listing.",
      issues: mergeUniqueStrings([
        classification.issues,
        classification.special_findings,
      ]),
      loved: null,
      highlights: null,
      condition,
      recommended_price: null,
    },
  };
};

const buildResearchContext = (
  classification: ClassificationStage,
  condition: z.infer<typeof conditionEnum>
) => ({
  condition_for_pricing: condition,
  classifier: {
    main_item: classification.main_item,
    category: classification.category,
    brand: classification.brand,
    model: classification.model,
    model_number: classification.model_number,
    condition: classification.condition,
    confidence: classification.confidence,
    confidence_label: classification.confidence_label,
    special_findings: classification.special_findings,
    visible_wear: classification.visible_wear,
    issues: classification.issues,
    missing_parts: classification.missing_parts,
    included_items: classification.included_items,
    accessories: classification.accessories,
    markings: classification.markings,
    serial_numbers: classification.serial_numbers,
    materials: classification.materials,
    colors: classification.colors,
    dimensions: classification.dimensions,
    notes: classification.notes,
    relevance: classification.relevance,
  },
});

const normalizeClassification = (
  classification: ClassificationStage
): ExtractionStage =>
  extractionSchema.parse({
    item_name: classification.main_item,
    brand: classification.brand,
    model: firstNonNull([classification.model_number, classification.model]),
    category: classification.category,
    variant: null,
    materials: classification.materials,
    colors: classification.colors,
    condition: classification.condition,
    visible_wear: classification.visible_wear,
    issues: classification.issues,
    missing_parts: classification.missing_parts,
    included_items: classification.included_items,
    markings: classification.markings,
    serial_numbers: classification.serial_numbers,
    accessories: classification.accessories,
    dimensions: classification.dimensions,
    notes: classification.notes,
    main_item: classification.main_item,
    model_number: classification.model_number,
    special_findings: classification.special_findings,
    confidence: classification.confidence,
    confidence_label: classification.confidence_label,
    relevance: classification.relevance,
  });

const emptyResearchStage = (): ResearchStage => ({
  product: {
    name: null,
    brand: null,
    model: null,
    category: null,
    variant: null,
    confidence: null,
    confidence_label: null,
    evidence: null,
  },
  pricing: {
    currency: null,
    new: {
      average: null,
      minimum: null,
    },
    used: {
      low: null,
      median: null,
      high: null,
    },
    recommended: {
      price: null,
      rationale: null,
    },
    sources: null,
  },
  listing: {
    title: null,
    description: null,
    reason_for_selling: null,
    issues: null,
    loved: null,
    highlights: null,
    condition: null,
    recommended_price: null,
  },
});

const parseJsonWithSchema = <T extends z.ZodTypeAny>(
  schema: T,
  text: string,
  errorMessage: string
): z.infer<T> => {
  const parsed = safeJsonParse(text);
  if (parsed === null) {
    console.error("Failed to parse JSON from text:", text.slice(0, 500));
    throw new Error(`${errorMessage}: Could not parse JSON from response`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("Schema validation failed:", result.error.issues);
    console.error("Parsed object:", JSON.stringify(parsed).slice(0, 500));
    throw new Error(
      `${errorMessage}: ${
        result.error.issues[0]?.message ?? "Schema validation failed"
      }`
    );
  }
  return result.data;
};

const extractOpenRouterText = (
  result: z.infer<typeof openRouterResponseSchema>
) => {
  const content = result.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n");
  }
  return "";
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

const shouldFallbackToLegacyWebSearch = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("web_search_preview") ||
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
  } catch (_error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_parseError) {
      return null;
    }
  }
};

const normalizeCondition = (
  value: string | null
): z.infer<typeof conditionEnum> | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  const direct = conditionEnum.safeParse(normalized);
  if (direct.success) return direct.data;

  if (["excellent", "mint", "near_mint"].includes(normalized)) return "like_new";
  if (["very_good", "used_good", "average"].includes(normalized)) return "good";
  if (["worn", "acceptable", "used_fair"].includes(normalized)) return "fair";
  if (["damaged", "broken", "for_parts"].includes(normalized)) return "poor";
  return null;
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
        R.filter((source) => source.url !== null)
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
    extraction.special_findings,
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
    title: listing.title ?? product.name ?? extraction.main_item,
    issues,
    condition: listingCondition,
    recommended_price: recommendedPrice,
  };
};

const firstNonNull = (values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
};

const firstNonNullNumber = (values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
};

const mergeUniqueStrings = (
  lists: Array<Array<string> | null | undefined>
): Array<string> | null => {
  const merged = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        merged.add(trimmed);
      }
    }
  }
  const values = Array.from(merged);
  return values.length > 0 ? values : null;
};

const mergeSources = (
  sourceLists: Array<Array<z.infer<typeof sourceSchema>> | null | undefined>
): Array<z.infer<typeof sourceSchema>> | null => {
  const byKey = new Map<string, z.infer<typeof sourceSchema>>();
  for (const list of sourceLists) {
    if (!Array.isArray(list)) continue;
    for (const source of list) {
      const key = source.url ?? source.title ?? JSON.stringify(source);
      if (!byKey.has(key)) {
        byKey.set(key, source);
      }
    }
  }
  const values = Array.from(byKey.values());
  return values.length > 0 ? values : null;
};

const firstNonEmptyList = (
  lists: Array<Array<string> | null | undefined>
): Array<string> | null => {
  for (const list of lists) {
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return null;
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
