import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { cleanlinessSchema, targetOutputSchema } from "./validators";

const MODEL_ID = "gemini-2.0-flash-exp";

export const startEdit = mutation({
  args: {
    imageId: v.id("images"),
    cleanlinessLevel: cleanlinessSchema,
    targetOutput: targetOutputSchema,
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      imageId: args.imageId,
      status: "queued",
      progressPct: 0,
      modelId: MODEL_ID,
      promptVersion: 1,
      cleanlinessLevel: args.cleanlinessLevel,
      targetOutput: args.targetOutput,
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });

    return jobId;
  },
});

export const queueEdit = internalMutation({
  args: {
    imageId: v.id("images"),
    cleanlinessLevel: cleanlinessSchema,
    targetOutput: targetOutputSchema,
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      imageId: args.imageId,
      status: "queued",
      progressPct: 0,
      modelId: MODEL_ID,
      promptVersion: 1,
      cleanlinessLevel: args.cleanlinessLevel,
      targetOutput: args.targetOutput,
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });

    return jobId;
  },
});

export const getJobsByUpload = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("images")
      .withIndex("by_upload", (q) => q.eq("uploadId", args.uploadId))
      .collect();

    const imageIds = images.map((img) => img._id);
    
    const allJobs = await Promise.all(
      imageIds.map((imageId) =>
        ctx.db
          .query("jobs")
          .withIndex("by_image", (q) => q.eq("imageId", imageId))
          .first()
      )
    );

    return allJobs.filter((job) => job !== null);
  },
});

export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("jobs"),
    progressPct: v.number(),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed")
      )
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates = {
      progressPct: args.progressPct,
      updatedAt: Date.now(),
      ...(args.status ? { status: args.status } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
    };

    await ctx.db.patch(args.jobId, updates);
  },
});

export const updateJobForRetry = internalMutation({
  args: {
    jobId: v.id("jobs"),
    promptVersion: v.number(),
    retryCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      promptVersion: args.promptVersion,
      retryCount: args.retryCount,
      status: "running",
      progressPct: 10,
      updatedAt: Date.now(),
    });
  },
});

export const processJob = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getJob, { jobId: args.jobId });
    if (!job) {
      console.error("Job not found:", args.jobId);
      return;
    }

    const image = await ctx.runQuery(internal.jobs.getImage, { imageId: job.imageId });
    if (!image) {
      await ctx.runMutation(internal.jobs.updateJobProgress, {
        jobId: args.jobId,
        progressPct: 0,
        status: "failed",
        error: "Image not found",
      });
      return;
    }

    // Update to running
    await ctx.runMutation(internal.jobs.updateJobProgress, {
      jobId: args.jobId,
      progressPct: 10,
      status: "running",
    });

    try {
      // Get the image bytes from storage
      const imageUrl = await ctx.storage.getUrl(image.storageId);
      if (!imageUrl) {
        throw new Error("Could not get image URL");
      }

      const imageResponse = await fetch(imageUrl);
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = arrayBufferToBase64(imageArrayBuffer);

      await ctx.runMutation(internal.jobs.updateJobProgress, {
        jobId: args.jobId,
        progressPct: 30,
      });

      // Build the prompt
      const prompt = buildPrompt(job.promptVersion, job.cleanlinessLevel, job.targetOutput);

      // Call Gemini API
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY not configured");
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${job.modelId}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: image.mimeType,
                      data: imageBase64,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      await ctx.runMutation(internal.jobs.updateJobProgress, {
        jobId: args.jobId,
        progressPct: 70,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Extract the image from the response
      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("No candidates in response");
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error("No parts in response");
      }

      // Find the image part
      const imagePart = parts.find(
        (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart?.inlineData) {
        // Check if this is a scene drift issue (model refused or returned only text)
        const textPart = parts.find((p: { text?: string }) => p.text);
        if (textPart && job.retryCount < 1) {
          // Retry with stricter prompt
          await ctx.runMutation(internal.jobs.updateJobForRetry, {
            jobId: args.jobId,
            promptVersion: 2,
            retryCount: job.retryCount + 1,
          });
          // Re-run the action
          await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId: args.jobId });
          return;
        }
        throw new Error("No image in response - scene drift or model limitation");
      }

      await ctx.runMutation(internal.jobs.updateJobProgress, {
        jobId: args.jobId,
        progressPct: 85,
      });

      // Store the edited image
      const editedImageData = base64ToArrayBuffer(imagePart.inlineData.data);
      const blob = new Blob([editedImageData], { type: imagePart.inlineData.mimeType });
      const storageId = await ctx.storage.store(blob);

      // Get dimensions from the new image (approximate based on data size, or use original)
      // For now, we'll use original dimensions as Gemini typically preserves aspect ratio
      const editedWidth = image.width;
      const editedHeight = image.height;

      // Create output record
      await ctx.runMutation(internal.outputs.createOutput, {
        jobId: args.jobId,
        storageId,
        width: editedWidth,
        height: editedHeight,
      });

      // Mark job as succeeded
      await ctx.runMutation(internal.jobs.updateJobProgress, {
        jobId: args.jobId,
        progressPct: 100,
        status: "succeeded",
      });
    } catch (error) {
      console.error("Job processing failed:", error);
      
      // If we haven't retried yet, try with stricter prompt
      if (job.retryCount < 1) {
        await ctx.runMutation(internal.jobs.updateJobForRetry, {
          jobId: args.jobId,
          promptVersion: 2,
          retryCount: job.retryCount + 1,
        });
        await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId: args.jobId });
        return;
      }

      await ctx.runMutation(internal.jobs.updateJobProgress, {
        jobId: args.jobId,
        progressPct: 0,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

export const getJob = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getImage = internalQuery({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
  },
});

function buildPrompt(
  promptVersion: number,
  cleanlinessLevel: string,
  targetOutput: string
) {
  const baseParts = [
    "Edit this real photo. Keep the scene identical: camera position, framing, perspective, background, shadows, reflections, and every object's position.",
    "Do not add, remove, resize, or reshape anything. Do not change colours, materials, branding, or labels.",
    "Only change cleanliness: remove dust, dirt, crumbs, and light smudges as if professionally cleaned.",
    "Preserve all real wear and defects exactly as they are (scratches, dents, stains, chips).",
    "Result must look like the same photo taken minutes later after cleaning.",
  ];

  // Add cleanliness level modifier
  const cleanlinessModifiers: Record<string, string> = {
    light: "Light cleaning: remove surface dust only.",
    standard: "Standard cleaning: vacuum fabric and wipe all reachable surfaces.",
    deep: "Deep cleaning: standard plus remove grime in seams and high-touch areas (still no repairs).",
  };
  baseParts.push(cleanlinessModifiers[cleanlinessLevel] || cleanlinessModifiers.standard);

  // Add resolution guidance
  const resolutionModifiers: Record<string, string> = {
    match: "Return the highest available resolution while keeping the same aspect ratio.",
    "2k": "Output at approximately 2048 pixels on the longer side, maintaining aspect ratio.",
    "4k": "Output at approximately 3840 pixels on the longer side, maintaining aspect ratio.",
  };
  baseParts.push(resolutionModifiers[targetOutput] || resolutionModifiers.match);

  // For retry (promptVersion 2), add stricter constraints
  if (promptVersion >= 2) {
    baseParts.unshift(
      "CRITICAL: This is a precision edit. The scene MUST remain EXACTLY identical."
    );
    baseParts.push(
      "Under no circumstances change the background, lighting, shadows, reflections, or framing.",
      "If you cannot perform this edit while preserving the exact scene, return the original image unchanged."
    );
  }

  return baseParts.join(" ");
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
