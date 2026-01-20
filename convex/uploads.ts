import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const createUpload = mutation({
  args: {
    clientSessionId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("uploads", {
      clientSessionId: args.clientSessionId,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const addImage = mutation({
  args: {
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    width: v.number(),
    height: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("images", {
      uploadId: args.uploadId,
      storageId: args.storageId,
      fileName: args.fileName,
      width: args.width,
      height: args.height,
      mimeType: args.mimeType,
      createdAt: Date.now(),
    });
  },
});

export const getImagesByUpload = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("images")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .collect();
    
    return Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await ctx.storage.getUrl(image.storageId),
      }))
    );
  },
});

export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
