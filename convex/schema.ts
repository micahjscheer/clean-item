import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  uploads: defineTable({
    clientSessionId: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_session", ["clientSessionId"]),

  images: defineTable({
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    sha256: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
    mimeType: v.string(),
    createdAt: v.number(),
  }).index("by_upload", ["uploadId"]),

  jobs: defineTable({
    imageId: v.id("images"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed")
    ),
    progressPct: v.number(),
    error: v.optional(v.string()),
    modelId: v.string(),
    promptVersion: v.number(),
    cleanlinessLevel: v.union(
      v.literal("light"),
      v.literal("standard"),
      v.literal("deep")
    ),
    targetOutput: v.union(
      v.literal("match"),
      v.literal("2k"),
      v.literal("4k")
    ),
    retryCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_image", ["imageId"]),

  uploadAssessments: defineTable({
    uploadId: v.id("uploads"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed")
    ),
    progressPct: v.number(),
    error: v.optional(v.string()),
    classifierModelId: v.string(),
    researchGeminiModelId: v.string(),
    researchOpenAiModelId: v.string(),
    classification: v.optional(
      v.object({
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
        perImage: v.array(
          v.object({
            imageId: v.id("images"),
            isRelevant: v.boolean(),
            reason: v.string(),
            condition: v.optional(v.string()),
            mainItem: v.optional(v.string()),
            modelNumber: v.optional(v.string()),
            specialFindings: v.array(v.string()),
            confidence: v.number(),
          })
        ),
      })
    ),
    research: v.optional(
      v.object({
        gemini: v.object({
          summary: v.string(),
          normalizedItemName: v.optional(v.string()),
          inferredManufacturer: v.optional(v.string()),
          inferredModelNumber: v.optional(v.string()),
          alternateModelNumbers: v.array(v.string()),
          conditionAssessment: v.optional(v.string()),
          keyFindings: v.array(v.string()),
          specialConsiderations: v.array(v.string()),
          recommendedQueries: v.array(v.string()),
          confidence: v.union(
            v.literal("low"),
            v.literal("medium"),
            v.literal("high")
          ),
        }),
        openai: v.object({
          summary: v.string(),
          normalizedItemName: v.optional(v.string()),
          inferredManufacturer: v.optional(v.string()),
          inferredModelNumber: v.optional(v.string()),
          alternateModelNumbers: v.array(v.string()),
          conditionAssessment: v.optional(v.string()),
          keyFindings: v.array(v.string()),
          specialConsiderations: v.array(v.string()),
          recommendedQueries: v.array(v.string()),
          confidence: v.union(
            v.literal("low"),
            v.literal("medium"),
            v.literal("high")
          ),
        }),
        combinedSummary: v.string(),
        consensusModelNumber: v.optional(v.string()),
        keyFindings: v.array(v.string()),
        recommendedQueries: v.array(v.string()),
        followUpQuestions: v.array(v.string()),
        confidence: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high")
        ),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_upload", ["uploadId"]),

  outputs: defineTable({
    jobId: v.id("jobs"),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_job", ["jobId"]),
});
