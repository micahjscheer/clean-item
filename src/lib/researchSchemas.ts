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

const toObject = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
};

const parseWithSchema = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown
) => schema.parse(toObject(value));

export const parseProduct = (value: unknown) =>
  parseWithSchema(productSchema, value);

export const parsePricing = (value: unknown) =>
  parseWithSchema(pricingSchema, value);

export const parseListing = (value: unknown) =>
  parseWithSchema(listingSchema, value);

export const parseExtraction = (value: unknown) =>
  parseWithSchema(extractionSchema, value);
