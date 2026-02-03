import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  cleanlinessSchema,
  conditionSchema,
  targetOutputSchema,
} from "./validators";

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
    cleanlinessLevel: cleanlinessSchema,
    targetOutput: targetOutputSchema,
    retryCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_image", ["imageId"]),

  outputs: defineTable({
    jobId: v.id("jobs"),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_job", ["jobId"]),

  productResearch: defineTable({
    imageId: v.id("images"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed")
    ),
    progressPct: v.number(),
    error: v.optional(v.string()),
    condition: conditionSchema,
    extractModelId: v.string(),
    researchModelId: v.string(),
    extraction: v.optional(v.any()),
    product: v.optional(v.any()),
    pricing: v.optional(v.any()),
    listing: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_image", ["imageId"]),
});
