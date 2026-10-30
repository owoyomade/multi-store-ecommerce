import { z } from "zod";

// Kept short for the demo. Adding a currency here is all that is needed to offer it.
export const SUPPORTED_CURRENCIES = [
  "CAD",
  "USD",
  "GBP",
  "EUR",
  "NGN",
] as const;

export const SUPPORTED_COUNTRIES = {
  CA: "Canada",
  US: "United States",
  GB: "United Kingdom",
  IE: "Ireland",
  NG: "Nigeria",
} as const;

// Slugs that would clash with platform routes or subdomains.
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "www",
  "s",
  "mail",
  "static",
]);

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1f2937");

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(40, "At most 40 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Lowercase letters, numbers and single hyphens only",
  )
  .refine((slug) => !RESERVED_SLUGS.has(slug), "This address is reserved");

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  slug: storeSlugSchema,
  currency: z.enum(SUPPORTED_CURRENCIES),
  country: z.enum(
    Object.keys(SUPPORTED_COUNTRIES) as [keyof typeof SUPPORTED_COUNTRIES],
  ),
  contactEmail: z.email("Enter a valid email"),
  primaryColor: hexColor,
  accentColor: hexColor,
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const updateStoreBrandingSchema = createStoreSchema.pick({
  name: true,
  contactEmail: true,
  primaryColor: true,
  accentColor: true,
});

export type UpdateStoreBrandingInput = z.infer<
  typeof updateStoreBrandingSchema
>;

/** Turns "Northbrew Coffee Co." into "northbrew-coffee-co" as a starting suggestion. */
export function suggestSlug(storeName: string): string {
  return storeName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
