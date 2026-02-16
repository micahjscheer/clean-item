import { z } from "zod";
import * as R from "remeda";

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

const objectValue = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value;
  }, schema);

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

const relevanceSchema = z.object({
  is_relevant: z.boolean(),
  reason: stringValue,
  distracting_elements: stringArrayValue,
});

export const extractionSchema = z.object({
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
  relevance: relevanceSchema,
});

export const productSchema = z.object({
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

export const pricingSchema = z.object({
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

export const listingSchema = z.object({
  title: stringValue,
  description: stringValue,
  reason_for_selling: stringValue,
  issues: stringArrayValue,
  loved: stringArrayValue,
  highlights: stringArrayValue,
  condition: stringValue,
  recommended_price: numberValue,
});

const defaultProduct = {
  name: null,
  brand: null,
  model: null,
  category: null,
  variant: null,
  confidence: null,
  confidence_label: null,
  evidence: null,
};

const defaultPricing = {
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
};

const defaultListing = {
  title: null,
  description: null,
  reason_for_selling: null,
  issues: null,
  loved: null,
  highlights: null,
  condition: null,
  recommended_price: null,
};

const defaultExtraction = {
  item_name: null,
  brand: null,
  model: null,
  category: null,
  variant: null,
  materials: null,
  colors: null,
  condition: null,
  visible_wear: null,
  issues: null,
  missing_parts: null,
  included_items: null,
  markings: null,
  serial_numbers: null,
  accessories: null,
  dimensions: null,
  notes: null,
  main_item: null,
  model_number: null,
  special_findings: null,
  confidence: null,
  confidence_label: null,
  relevance: {
    is_relevant: true,
    reason: null,
    distracting_elements: null,
  },
};

const safeParse = (schema: z.ZodTypeAny, fallback: unknown, value: unknown) =>
  schema.catch(fallback).parse(value);

export const parseProduct = (value: unknown) =>
  safeParse(productSchema, defaultProduct, value);

export const parsePricing = (value: unknown) =>
  safeParse(pricingSchema, defaultPricing, value);

export const parseListing = (value: unknown) =>
  safeParse(listingSchema, defaultListing, value);

export const parseExtraction = (value: unknown) =>
  safeParse(extractionSchema, defaultExtraction, value);
