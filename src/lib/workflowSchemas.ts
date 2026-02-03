import { z } from "zod";

export const workflowSchema = z.enum(["listing", "clean", "research"]);
export const cleanlinessSchema = z.enum(["light", "standard", "deep"]);
export const targetOutputSchema = z.enum(["match", "2k", "4k"]);
export const conditionSchema = z.enum([
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
]);

export type ProcessingMode = z.infer<typeof workflowSchema>;
export type CleanlinessLevel = z.infer<typeof cleanlinessSchema>;
export type TargetOutput = z.infer<typeof targetOutputSchema>;
export type ItemCondition = z.infer<typeof conditionSchema>;
