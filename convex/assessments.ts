import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { z } from "zod";

const OPENROUTER_CHAT_COMPLETIONS_URL =
  process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const CLASSIFIER_MODEL_ID =
  process.env.OPENROUTER_CLASSIFIER_MODEL ?? "google/gemini-2.5-flash";
const RESEARCH_GEMINI_MODEL_ID =
  process.env.OPENROUTER_RESEARCH_GEMINI_MODEL ?? "google/gemini-2.5-pro";
const RESEARCH_OPENAI_MODEL_ID =
  process.env.OPENROUTER_RESEARCH_OPENAI_MODEL ?? "openai/o3";

type AssessmentStatus = "queued" | "running" | "succeeded" | "failed";
type ReasoningEffort = "low" | "medium" | "high";
type ResearchConfidence = "low" | "medium" | "high";

const statusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed")
);

const confidenceValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
);

const perImageClassificationValidator = v.object({
  imageId: v.id("images"),
  isRelevant: v.boolean(),
  reason: v.string(),
  condition: v.optional(v.string()),
  mainItem: v.optional(v.string()),
  modelNumber: v.optional(v.string()),
  specialFindings: v.array(v.string()),
  confidence: v.number(),
});

const classificationValidator = v.object({
  acceptedCondition: v.optional(v.string()),
  acceptedMainItem: v.optional(v.string()),
  acceptedModelNumber: v.optional(v.string()),
  specialFindings: v.array(v.string()),
  relevantImageIds: v.array(v.id("images")),
  irrelevantImages: v.array(
    v.object({
      imageId: v.id("images"),
      reason: v.string(),
      confidence: v.number(),
    })
  ),
  perImage: v.array(perImageClassificationValidator),
});

const researchModelValidator = v.object({
  summary: v.string(),
  normalizedItemName: v.optional(v.string()),
  inferredManufacturer: v.optional(v.string()),
  inferredModelNumber: v.optional(v.string()),
  alternateModelNumbers: v.array(v.string()),
  conditionAssessment: v.optional(v.string()),
  keyFindings: v.array(v.string()),
  specialConsiderations: v.array(v.string()),
  recommendedQueries: v.array(v.string()),
  confidence: confidenceValidator,
});

const researchValidator = v.object({
  gemini: researchModelValidator,
  openai: researchModelValidator,
  combinedSummary: v.string(),
  consensusModelNumber: v.optional(v.string()),
  keyFindings: v.array(v.string()),
  recommendedQueries: v.array(v.string()),
  followUpQuestions: v.array(v.string()),
  confidence: confidenceValidator,
});

const imageIdSchema = z.custom<Id<"images">>(
  (value): value is Id<"images"> => typeof value === "string",
  { message: "Invalid image id" }
);

const classifierImageSchema = z.object({
  isRelevant: z.boolean(),
  relevanceReason: z.string().min(1),
  condition: z.string().nullish(),
  mainItem: z.string().nullish(),
  modelNumber: z.string().nullish(),
  specialFindings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

const classificationStageSchema = z.object({
  acceptedCondition: z.string().optional(),
  acceptedMainItem: z.string().optional(),
  acceptedModelNumber: z.string().optional(),
  specialFindings: z.array(z.string()),
  relevantImageIds: z.array(imageIdSchema),
  irrelevantImages: z.array(
    z.object({
      imageId: imageIdSchema,
      reason: z.string().min(1),
      confidence: z.number().min(0).max(1),
    })
  ),
  perImage: z.array(
    z.object({
      imageId: imageIdSchema,
      isRelevant: z.boolean(),
      reason: z.string().min(1),
      condition: z.string().optional(),
      mainItem: z.string().optional(),
      modelNumber: z.string().optional(),
      specialFindings: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const researchModelResponseSchema = z.object({
  summary: z.string().min(1),
  normalizedItemName: z.string().nullish(),
  inferredManufacturer: z.string().nullish(),
  inferredModelNumber: z.string().nullish(),
  alternateModelNumbers: z.array(z.string()).default([]),
  conditionAssessment: z.string().nullish(),
  keyFindings: z.array(z.string()).default([]),
  specialConsiderations: z.array(z.string()).default([]),
  recommendedQueries: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

const researchModelSchema = z.object({
  summary: z.string().min(1),
  normalizedItemName: z.string().optional(),
  inferredManufacturer: z.string().optional(),
  inferredModelNumber: z.string().optional(),
  alternateModelNumbers: z.array(z.string()),
  conditionAssessment: z.string().optional(),
  keyFindings: z.array(z.string()),
  specialConsiderations: z.array(z.string()),
  recommendedQueries: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});

const researchStageSchema = z.object({
  gemini: researchModelSchema,
  openai: researchModelSchema,
  combinedSummary: z.string().min(1),
  consensusModelNumber: z.string().optional(),
  keyFindings: z.array(z.string()),
  recommendedQueries: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});

type ClassifierImageResult = z.infer<typeof classifierImageSchema>;
type ClassificationStage = z.infer<typeof classificationStageSchema>;
type ResearchModelResult = z.infer<typeof researchModelResponseSchema>;
type ResearchStage = z.infer<typeof researchStageSchema>;

type ClassifiedImage = {
  imageId: Id<"images">;
  isRelevant: boolean;
  reason: string;
  condition?: string;
  mainItem?: string;
  modelNumber?: string;
  specialFindings: string[];
  confidence: number;
};

export const ensureUploadAssessment = mutation({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("uploadAssessments")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .first();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const assessmentId = await ctx.db.insert("uploadAssessments", {
      uploadId: args.uploadId,
      status: "queued",
      progressPct: 0,
      classifierModelId: CLASSIFIER_MODEL_ID,
      researchGeminiModelId: RESEARCH_GEMINI_MODEL_ID,
      researchOpenAiModelId: RESEARCH_OPENAI_MODEL_ID,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.assessments.processUploadAssessment, {
      assessmentId,
    });

    return assessmentId;
  },
});

export const getUploadAssessment = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("uploadAssessments")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .first();
  },
});

export const processUploadAssessment = internalAction({
  args: { assessmentId: v.id("uploadAssessments") },
  handler: async (ctx, args) => {
    const assessment = await ctx.runQuery(internal.assessments.getAssessment, {
      assessmentId: args.assessmentId,
    });

    if (!assessment) {
      console.error("Upload assessment not found:", args.assessmentId);
      return;
    }

    if (assessment.status === "succeeded") {
      return;
    }

    try {
      await ctx.runMutation(internal.assessments.updateAssessmentProgress, {
        assessmentId: args.assessmentId,
        status: "running",
        progressPct: 5,
        startedAt: assessment.startedAt ?? Date.now(),
      });

      const images = await ctx.runQuery(internal.assessments.getImagesForUpload, {
        uploadId: assessment.uploadId,
      });

      if (images.length === 0) {
        throw new Error("No uploaded images found for classification.");
      }

      const perImage: ClassifiedImage[] = [];

      for (let i = 0; i < images.length; i += 1) {
        const image = images[i];
        try {
          const imageUrl = await ctx.storage.getUrl(image.storageId);
          if (!imageUrl) {
            throw new Error("Image URL is unavailable.");
          }

          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Image fetch failed with status ${response.status}.`);
          }

          const imageBuffer = await response.arrayBuffer();
          const imageBase64 = arrayBufferToBase64(imageBuffer);

          const classifierResult = await runClassifierForImage({
            fileName: image.fileName,
            mimeType: image.mimeType,
            width: image.width,
            height: image.height,
            imageBase64,
          });

          perImage.push({
            imageId: image._id,
            isRelevant: classifierResult.isRelevant,
            reason: normalizeRequiredString(
              classifierResult.relevanceReason,
              "No relevance reason returned."
            ),
            condition: normalizeOptionalString(classifierResult.condition),
            mainItem: normalizeOptionalString(classifierResult.mainItem),
            modelNumber: normalizeOptionalString(classifierResult.modelNumber),
            specialFindings: uniqueNormalizedStrings(classifierResult.specialFindings),
            confidence: clampConfidence(classifierResult.confidence),
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown classifier error.";
          perImage.push({
            imageId: image._id,
            isRelevant: false,
            reason: `Classifier failed for this image: ${truncate(reason, 240)}`,
            specialFindings: [],
            confidence: 0,
          });
        }

        const progressPct = 10 + Math.round(((i + 1) / images.length) * 45);
        await ctx.runMutation(internal.assessments.updateAssessmentProgress, {
          assessmentId: args.assessmentId,
          progressPct,
        });
      }

      const classificationStage = aggregateClassificationStage(perImage);

      await ctx.runMutation(internal.assessments.setClassification, {
        assessmentId: args.assessmentId,
        classification: classificationStage,
      });

      await ctx.runMutation(internal.assessments.updateAssessmentProgress, {
        assessmentId: args.assessmentId,
        progressPct: 65,
      });

      await ctx.runMutation(internal.assessments.updateAssessmentProgress, {
        assessmentId: args.assessmentId,
        progressPct: 72,
      });

      const researchStage = await runResearchStage(classificationStage);

      await ctx.runMutation(internal.assessments.updateAssessmentProgress, {
        assessmentId: args.assessmentId,
        progressPct: 92,
      });

      await ctx.runMutation(internal.assessments.setResearchAndComplete, {
        assessmentId: args.assessmentId,
        research: researchStage,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown assessment error.";
      console.error("Upload assessment processing failed:", error);
      await ctx.runMutation(internal.assessments.failAssessment, {
        assessmentId: args.assessmentId,
        error: errorMessage,
      });
    }
  },
});

export const getAssessment = internalQuery({
  args: { assessmentId: v.id("uploadAssessments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.assessmentId);
  },
});

export const getImagesForUpload = internalQuery({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("images")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .collect();
  },
});

export const updateAssessmentProgress = internalMutation({
  args: {
    assessmentId: v.id("uploadAssessments"),
    progressPct: v.optional(v.number()),
    status: v.optional(statusValidator),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: {
      progressPct?: number;
      status?: AssessmentStatus;
      error?: string;
      startedAt?: number;
      completedAt?: number;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.progressPct !== undefined) updates.progressPct = args.progressPct;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;
    if (args.startedAt !== undefined) updates.startedAt = args.startedAt;
    if (args.completedAt !== undefined) updates.completedAt = args.completedAt;

    await ctx.db.patch(args.assessmentId, updates);
  },
});

export const setClassification = internalMutation({
  args: {
    assessmentId: v.id("uploadAssessments"),
    classification: classificationValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assessmentId, {
      classification: args.classification,
      updatedAt: Date.now(),
    });
  },
});

export const setResearchAndComplete = internalMutation({
  args: {
    assessmentId: v.id("uploadAssessments"),
    research: researchValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assessmentId, {
      research: args.research,
      status: "succeeded",
      progressPct: 100,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const failAssessment = internalMutation({
  args: {
    assessmentId: v.id("uploadAssessments"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assessmentId, {
      status: "failed",
      progressPct: 0,
      error: args.error,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

async function runClassifierForImage(params: {
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  imageBase64: string;
}): Promise<ClassifierImageResult> {
  const systemPrompt = [
    "You are an upload intake classifier for listing photos.",
    "Identify whether this image is relevant to the primary item being listed.",
    "If relevant, extract visible condition, main item, and model number when possible.",
    "If irrelevant, explain why clearly.",
    "Return only a single JSON object with the requested fields.",
  ].join(" ");

  const userPrompt = [
    "Classify this uploaded image.",
    `File name: ${params.fileName}`,
    `Image size: ${params.width}x${params.height}`,
    "Required JSON fields:",
    "- isRelevant: boolean",
    "- relevanceReason: string",
    "- condition: string | null",
    "- mainItem: string | null",
    "- modelNumber: string | null",
    "- specialFindings: string[]",
    "- confidence: number between 0 and 1",
  ].join("\n");

  return await callOpenRouterWithSchema({
    model: CLASSIFIER_MODEL_ID,
    systemPrompt,
    userPrompt,
    schema: classifierImageSchema,
    image: {
      mimeType: params.mimeType,
      base64: params.imageBase64,
    },
    reasoningEffort: "low",
    stageName: "classification",
  });
}

async function runResearchStage(classification: ClassificationStage): Promise<ResearchStage> {
  if (classification.relevantImageIds.length === 0) {
    return researchStageSchema.parse({
      gemini: {
        summary:
          "Research skipped because the classifier marked every image as unrelated to the primary item.",
        normalizedItemName: undefined,
        inferredManufacturer: undefined,
        inferredModelNumber: undefined,
        alternateModelNumbers: [],
        conditionAssessment: undefined,
        keyFindings: [],
        specialConsiderations: [
          "Upload at least one clear photo of the primary item for automated research.",
        ],
        recommendedQueries: [],
        confidence: "low",
      },
      openai: {
        summary:
          "Research skipped because the classifier marked every image as unrelated to the primary item.",
        normalizedItemName: undefined,
        inferredManufacturer: undefined,
        inferredModelNumber: undefined,
        alternateModelNumbers: [],
        conditionAssessment: undefined,
        keyFindings: [],
        specialConsiderations: [
          "Upload at least one clear photo of the primary item for automated research.",
        ],
        recommendedQueries: [],
        confidence: "low",
      },
      combinedSummary:
        "No relevant product images were detected. Research was not performed until a relevant image is provided.",
      consensusModelNumber: undefined,
      keyFindings: [],
      recommendedQueries: [],
      followUpQuestions: [
        "Can you upload a clear photo focused on the main item?",
        "Can you upload a close-up photo of the model or serial label?",
      ],
      confidence: "low",
    });
  }

  const researchInput = {
    acceptedCondition: classification.acceptedCondition,
    acceptedMainItem: classification.acceptedMainItem,
    acceptedModelNumber: classification.acceptedModelNumber,
    specialFindings: classification.specialFindings,
    relevantImageCount: classification.relevantImageIds.length,
    irrelevantImageCount: classification.irrelevantImages.length,
    perImageSignals: classification.perImage
      .filter((item) => item.isRelevant)
      .map((item) => ({
        condition: item.condition,
        mainItem: item.mainItem,
        modelNumber: item.modelNumber,
        specialFindings: item.specialFindings,
        confidence: item.confidence,
      })),
  };

  const systemPrompt = [
    "You are a product research analyst.",
    "Use the provided classification output to produce listing-relevant research.",
    "Treat acceptedModelNumber and specialFindings from classification as high-priority evidence.",
    "Do not invent exact facts if evidence is weak; call out uncertainty clearly.",
    "Return only valid JSON with the requested fields.",
  ].join(" ");

  const userPrompt = [
    "Research input:",
    JSON.stringify(researchInput, null, 2),
    "",
    "Required JSON fields:",
    "- summary: string",
    "- normalizedItemName: string | null",
    "- inferredManufacturer: string | null",
    "- inferredModelNumber: string | null",
    "- alternateModelNumbers: string[]",
    "- conditionAssessment: string | null",
    "- keyFindings: string[]",
    "- specialConsiderations: string[]",
    "- recommendedQueries: string[]",
    "- confidence: \"low\" | \"medium\" | \"high\"",
  ].join("\n");

  const geminiResult = normalizeResearchModelResult(
    await callOpenRouterWithSchema({
      model: RESEARCH_GEMINI_MODEL_ID,
      systemPrompt,
      userPrompt,
      schema: researchModelResponseSchema,
      reasoningEffort: "high",
      stageName: "research-gemini",
    })
  );

  const openAiResult = normalizeResearchModelResult(
    await callOpenRouterWithSchema({
      model: RESEARCH_OPENAI_MODEL_ID,
      systemPrompt,
      userPrompt,
      schema: researchModelResponseSchema,
      reasoningEffort: "high",
      stageName: "research-openai",
    })
  );

  return mergeResearchResults(classification, geminiResult, openAiResult);
}

async function callOpenRouterWithSchema<T>(params: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  stageName: string;
  image?: { mimeType: string; base64: string };
  reasoningEffort?: ReasoningEffort;
}): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const userContent: unknown = params.image
    ? [
        { type: "text", text: params.userPrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${params.image.mimeType};base64,${params.image.base64}`,
          },
        },
      ]
    : params.userPrompt;

  const body: Record<string, unknown> = {
    model: params.model,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  };

  if (params.reasoningEffort) {
    body.reasoning = { effort: params.reasoningEffort };
  }

  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter ${params.stageName} call failed: ${response.status} ${truncate(errorText, 500)}`
    );
  }

  const payload = await response.json();
  const assistantText = extractAssistantText(payload);
  const parsedJson = parseJsonFromText(assistantText);
  const parsed = params.schema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `Invalid ${params.stageName} response schema: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`
    );
  }

  return parsed.data;
}

function aggregateClassificationStage(perImage: ClassifiedImage[]): ClassificationStage {
  const relevant = perImage.filter((item) => item.isRelevant);
  const irrelevant = perImage.filter((item) => !item.isRelevant);

  const stageCandidate: ClassificationStage = {
    acceptedCondition: pickMostFrequent(relevant.map((item) => item.condition)),
    acceptedMainItem: pickMostFrequent(relevant.map((item) => item.mainItem)),
    acceptedModelNumber: pickMostFrequent(relevant.map((item) => item.modelNumber)),
    specialFindings: uniqueNormalizedStrings(
      relevant.flatMap((item) => item.specialFindings)
    ),
    relevantImageIds: relevant.map((item) => item.imageId),
    irrelevantImages: irrelevant.map((item) => ({
      imageId: item.imageId,
      reason: item.reason,
      confidence: clampConfidence(item.confidence),
    })),
    perImage: perImage.map((item) => ({
      imageId: item.imageId,
      isRelevant: item.isRelevant,
      reason: normalizeRequiredString(item.reason, "No reason provided."),
      condition: item.condition,
      mainItem: item.mainItem,
      modelNumber: item.modelNumber,
      specialFindings: uniqueNormalizedStrings(item.specialFindings),
      confidence: clampConfidence(item.confidence),
    })),
  };

  return classificationStageSchema.parse(stageCandidate);
}

function normalizeResearchModelResult(result: ResearchModelResult) {
  return {
    summary: normalizeRequiredString(result.summary, "No research summary returned."),
    normalizedItemName: normalizeOptionalString(result.normalizedItemName),
    inferredManufacturer: normalizeOptionalString(result.inferredManufacturer),
    inferredModelNumber: normalizeOptionalString(result.inferredModelNumber),
    alternateModelNumbers: uniqueNormalizedStrings(result.alternateModelNumbers),
    conditionAssessment: normalizeOptionalString(result.conditionAssessment),
    keyFindings: uniqueNormalizedStrings(result.keyFindings),
    specialConsiderations: uniqueNormalizedStrings(result.specialConsiderations),
    recommendedQueries: uniqueNormalizedStrings(result.recommendedQueries),
    confidence: result.confidence as ResearchConfidence,
  };
}

function mergeResearchResults(
  classification: ClassificationStage,
  gemini: ReturnType<typeof normalizeResearchModelResult>,
  openai: ReturnType<typeof normalizeResearchModelResult>
): ResearchStage {
  const consensusModelNumber = pickMostFrequent([
    classification.acceptedModelNumber,
    gemini.inferredModelNumber,
    openai.inferredModelNumber,
  ]);

  const recommendedQueries = uniqueNormalizedStrings([
    ...gemini.recommendedQueries,
    ...openai.recommendedQueries,
    classification.acceptedMainItem && consensusModelNumber
      ? `${classification.acceptedMainItem} ${consensusModelNumber} specifications`
      : undefined,
    classification.acceptedMainItem
      ? `${classification.acceptedMainItem} common issues`
      : undefined,
  ]);

  const followUpQuestions = uniqueNormalizedStrings([
    !consensusModelNumber
      ? "Can you upload a close-up of any model or serial label for a definitive model match?"
      : undefined,
    !classification.acceptedCondition
      ? "Can you add a photo that clearly shows cosmetic wear and condition details?"
      : undefined,
    classification.irrelevantImages.length > 0
      ? "Can you remove or replace the images flagged as unrelated to the primary item?"
      : undefined,
  ]);

  const merged: ResearchStage = {
    gemini,
    openai,
    combinedSummary: [
      `Gemini summary: ${gemini.summary}`,
      `OpenAI summary: ${openai.summary}`,
      consensusModelNumber
        ? `Consensus model number: ${consensusModelNumber}.`
        : "No consensus model number was found.",
    ].join(" "),
    consensusModelNumber,
    keyFindings: uniqueNormalizedStrings([
      ...classification.specialFindings,
      ...gemini.keyFindings,
      ...openai.keyFindings,
    ]),
    recommendedQueries,
    followUpQuestions,
    confidence: mergeConfidence(gemini.confidence, openai.confidence),
  };

  return researchStageSchema.parse(merged);
}

function mergeConfidence(
  a: ResearchConfidence,
  b: ResearchConfidence
): ResearchConfidence {
  if (a === "high" && b === "high") return "high";
  if (a === "low" && b === "low") return "low";
  return "medium";
}

function parseJsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Could not locate a JSON object in model output.");
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

function extractAssistantText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Model response payload was not an object.");
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("Model response did not include choices.");
  }

  const firstChoice = choices[0] as { message?: { content?: unknown } };
  const content = firstChoice.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("\n")
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("Model response did not include assistant text content.");
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRequiredString(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeOptionalString(value);
  return normalized ?? fallback;
}

function uniqueNormalizedStrings(values: Array<string | null | undefined>): string[] {
  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) deduped.add(normalized);
  }
  return Array.from(deduped);
}

function pickMostFrequent(values: Array<string | null | undefined>): string | undefined {
  const normalized = values
    .map((value) => normalizeOptionalString(value))
    .filter((value): value is string => value !== undefined);

  if (normalized.length === 0) return undefined;

  const counts = new Map<string, number>();
  for (const value of normalized) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let winner = normalized[0];
  let winnerCount = 0;

  for (const [value, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }

  return winner;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
