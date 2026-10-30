import { z } from "zod";
import { parseMoneyToCents } from "../money";

export const PRODUCT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const catalogSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "At least 2 characters")
  .max(80, "At most 80 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Lowercase letters, numbers and single hyphens only",
  );

/** A price typed by a merchant ("12.50") becomes integer cents (1250). */
const priceSchema = z.string().transform((value, context) => {
  const cents = parseMoneyToCents(value);
  if (cents === null || cents <= 0) {
    context.addIssue({ code: "custom", message: "Enter a price like 12.50" });
    return z.NEVER;
  }
  return cents;
});

/** Empty means "no compare-at price". */
const optionalPriceSchema = z.string().transform((value, context) => {
  if (value.trim() === "") return null;
  const cents = parseMoneyToCents(value);
  if (cents === null || cents <= 0) {
    context.addIssue({
      code: "custom",
      message: "Enter a price like 19.99, or leave empty",
    });
    return z.NEVER;
  }
  return cents;
});

const stockSchema = z.coerce
  .number({ message: "Enter a whole number" })
  .int("Enter a whole number")
  .min(0, "Stock can't be negative")
  .max(1_000_000);

const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Required")
  .max(64)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Letters, numbers, - and _ only");

/** "S, M, L" → ["S", "M", "L"], dropping blanks and duplicates. */
const optionValuesSchema = z.string().transform((value) => [
  ...new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  ),
]);

export const productDetailsSchema = z.object({
  title: z.string().trim().min(2, "At least 2 characters").max(120),
  slug: catalogSlugSchema,
  description: z.string().trim().max(5000).default(""),
  status: z.enum(PRODUCT_STATUSES),
  seoTitle: z
    .string()
    .trim()
    .max(70, "Search engines show about 60–70 characters")
    .default(""),
  seoDescription: z
    .string()
    .trim()
    .max(160, "Search engines show about 160 characters")
    .default(""),
});

export type ProductDetailsInput = z.input<typeof productDetailsSchema>;

export const createProductSchema = productDetailsSchema
  .extend({
    price: priceSchema,
    compareAtPrice: optionalPriceSchema.prefault(""),
    skuPrefix: skuSchema,
    initialStock: stockSchema,
    trackInventory: z.boolean().default(true),
    option1Name: z.string().trim().max(30).default(""),
    option1Values: optionValuesSchema.prefault(""),
    option2Name: z.string().trim().max(30).default(""),
    option2Values: optionValuesSchema.prefault(""),
  })
  .superRefine((input, context) => {
    if (input.compareAtPrice !== null && input.compareAtPrice <= input.price) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "The compare-at price must be higher than the price",
      });
    }
    for (const index of [1, 2] as const) {
      const name = input[`option${index}Name`];
      const values = input[`option${index}Values`];
      if (name && values.length === 0) {
        context.addIssue({
          code: "custom",
          path: [`option${index}Values`],
          message: "Add at least one value",
        });
      }
      if (!name && values.length > 0) {
        context.addIssue({
          code: "custom",
          path: [`option${index}Name`],
          message: "Name this option, e.g. Size",
        });
      }
    }
    if (
      input.option1Values.length * Math.max(input.option2Values.length, 1) >
      100
    ) {
      context.addIssue({
        code: "custom",
        path: ["option2Values"],
        message: "At most 100 variants per product",
      });
    }
  });

export type CreateProductInput = z.input<typeof createProductSchema>;

export const variantRowSchema = z
  .object({
    id: z.string().min(1),
    sku: skuSchema,
    price: priceSchema,
    compareAtPrice: optionalPriceSchema,
    stock: stockSchema,
    trackInventory: z.boolean(),
  })
  .refine(
    (row) => row.compareAtPrice === null || row.compareAtPrice > row.price,
    {
      path: ["compareAtPrice"],
      message: "Must be higher than the price",
    },
  );

export type VariantRowInput = z.input<typeof variantRowSchema>;

export const collectionSchema = z.object({
  title: z.string().trim().min(2, "At least 2 characters").max(80),
  slug: catalogSlugSchema,
  description: z.string().trim().max(1000).default(""),
});

export type CollectionInput = z.input<typeof collectionSchema>;
