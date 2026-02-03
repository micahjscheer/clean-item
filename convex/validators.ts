import { v } from "convex/values";

export const cleanlinessSchema = v.union(
  v.literal("light"),
  v.literal("standard"),
  v.literal("deep")
);

export const targetOutputSchema = v.union(
  v.literal("match"),
  v.literal("2k"),
  v.literal("4k")
);

export const conditionSchema = v.union(
  v.literal("new"),
  v.literal("like_new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("poor")
);
