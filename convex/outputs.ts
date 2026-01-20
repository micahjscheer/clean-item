import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createOutput = internalMutation({
  args: {
    jobId: v.id("jobs"),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outputs", {
      jobId: args.jobId,
      storageId: args.storageId,
      width: args.width,
      height: args.height,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const getOutputsByUpload = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    // Get all images for this upload
    const images = await ctx.db
      .query("images")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .collect();

    const imageIds = images.map((img) => img._id);

    // Get all jobs for these images
    const jobs = await Promise.all(
      imageIds.map((imageId) =>
        ctx.db
          .query("jobs")
          .withIndex("by_image", (q) => q.eq("imageId", imageId))
          .first()
      )
    );

    const validJobs = jobs.filter((job) => job !== null);

    // Get all outputs for these jobs
    const outputs = await Promise.all(
      validJobs.map(async (job) => {
        const output = await ctx.db
          .query("outputs")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .first();

        if (!output) return null;

        const url = await ctx.storage.getUrl(output.storageId);
        return {
          ...output,
          url,
          imageId: job.imageId,
        };
      })
    );

    return outputs.filter((output) => output !== null);
  },
});

export const getOutputUrl = query({
  args: { outputId: v.id("outputs") },
  handler: async (ctx, args) => {
    const output = await ctx.db.get(args.outputId);
    if (!output) return null;
    return await ctx.storage.getUrl(output.storageId);
  },
});
