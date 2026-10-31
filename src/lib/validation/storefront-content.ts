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

// The homepage editor in the dashboard

/** The places a picture can go on the homepage. */
export const PICTURE_SLOTS = [
  "hero",
  "plate-1",
  "plate-2",
  "letter",
  "footer",
] as const;
export type PictureSlot = (typeof PICTURE_SLOTS)[number];

/** What the merchant types for a picture. Alt text is required for screen readers. */
export const pictureDetailsSchema = z.object({
  alt: z
    .string()
    .trim()
    .min(1, "Describe the picture for people who can't see it")
    .max(200),
  caption: z.string().trim().max(160).default(""),
  credit: z.string().trim().max(300).default(""),
});

export type PictureDetailsInput = z.input<typeof pictureDetailsSchema>;

/** The words on the homepage, as typed into the editor's form. */
export const homepageTextSchema = z
  .object({
    summary: z.string().trim().max(160).default(""),
    actionLabel: z.string().trim().max(30).default(""),
    facts: z
      .array(z.string().trim().max(40, "At most 40 characters"))
      .max(3)
      .default([]),
    featuredProductSlug: z.string().trim().default(""),
    // One paragraph per block of text separated by an empty line.
    letterText: z.string().trim().max(3000).default(""),
    letterSignedBy: z.string().trim().max(80).default(""),
    letterRole: z.string().trim().max(80).default(""),
  })
  .superRefine((input, context) => {
    if (input.letterText && !input.letterSignedBy) {
      context.addIssue({
        code: "custom",
        path: ["letterSignedBy"],
        message: "Add who the letter is from",
      });
    }
    const paragraphs = splitParagraphs(input.letterText);
    if (paragraphs.length > 6) {
      context.addIssue({
        code: "custom",
        path: ["letterText"],
        message: "Keep the letter to six paragraphs or fewer",
      });
    }
    if (paragraphs.some((paragraph) => paragraph.length > 600)) {
      context.addIssue({
        code: "custom",
        path: ["letterText"],
        message: "Each paragraph can be up to 600 characters",
      });
    }
  });

export type HomepageTextInput = z.input<typeof homepageTextSchema>;

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
