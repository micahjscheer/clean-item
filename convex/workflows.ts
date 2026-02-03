import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  cleanlinessSchema,
  conditionSchema,
  targetOutputSchema,
} from "./validators";

export const startListingWorkflow = mutation({
  args: {
    imageIds: v.array(v.id("images")),
    cleanlinessLevel: cleanlinessSchema,
    targetOutput: targetOutputSchema,
    condition: conditionSchema,
  },
  handler: async (ctx, args) => {
    await Promise.all(
      args.imageIds.map((imageId) =>
        ctx.runMutation(internal.jobs.queueEdit, {
          imageId,
          cleanlinessLevel: args.cleanlinessLevel,
          targetOutput: args.targetOutput,
        })
      )
    );

    await Promise.all(
      args.imageIds.map((imageId) =>
        ctx.runMutation(internal.research.queueResearch, {
          imageId,
          condition: args.condition,
        })
      )
    );

    return { ok: true };
  },
});
