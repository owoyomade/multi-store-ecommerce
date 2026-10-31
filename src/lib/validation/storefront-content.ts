import { z } from "zod";

// A picture placed on the storefront by the merchant: their own photograph,
// or an openly licensed one from a museum or archive. `credit` is shown in
// the footer, and is required because most open licences ask for it.
export const storeImageSchema = z.object({
  storageKey: z
    .string()
    .regex(/^stores\/[a-z0-9]+\/content\/[a-f0-9-]+\.webp$/),
  alt: z.string().trim().min(1).max(200),
  // What the picture shows, printed beside it, e.g. "Coffea arabica, engraving, 1801".
  caption: z.string().trim().max(160).default(""),
  credit: z.string().trim().max(300).default(""),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type StoreImage = z.output<typeof storeImageSchema>;

/**
 * Optional homepage content. Every part may be missing: a new store gets a
 * complete-looking homepage from its products alone, and each part appears
 * as the merchant fills it in.
 */
export const storefrontContentSchema = z.object({
  heroImage: storeImageSchema.optional(),
  // Up to three short facts shown with the store name, e.g. "Roasted in Toronto".
  facts: z.array(z.string().trim().min(1).max(40)).max(3).default([]),
  // One sentence under the headline that says plainly what the store sells.
  summary: z.string().trim().max(160).default(""),
  // The hero button, named for what the shopper does, e.g. "Shop the roasts".
  actionLabel: z.string().trim().min(1).max(30).default("Shop now"),
  featuredProductSlug: z.string().optional(),
  letter: z
    .object({
      paragraphs: z.array(z.string().trim().min(1).max(600)).min(1).max(6),
      signedBy: z.string().trim().min(1).max(80),
      role: z.string().trim().max(80).default(""),
      image: storeImageSchema.optional(),
    })
    .optional(),
  // Supporting pictures of the store's world, placed through the page.
  plates: z.array(storeImageSchema).max(6).default([]),
  footerImage: storeImageSchema.optional(),
});

export type StorefrontContent = z.output<typeof storefrontContentSchema>;

/**
 * Reads the JSON column safely. Bad or missing data falls back to empty
 * content instead of breaking the storefront.
 */
export function parseStorefrontContent(value: unknown): StorefrontContent {
  const parsed = storefrontContentSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : storefrontContentSchema.parse({});
}

/** Every picture on the homepage that carries a credit, for the footer. */
export function contentCredits(content: StorefrontContent): string[] {
  const images = [
    content.heroImage,
    content.letter?.image,
    ...content.plates,
    content.footerImage,
  ];
  return [
    ...new Set(
      images.flatMap((image) => (image?.credit ? [image.credit] : [])),
    ),
  ];
}
