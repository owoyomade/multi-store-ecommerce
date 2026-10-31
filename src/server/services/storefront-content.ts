import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  homepageTextSchema,
  parseStorefrontContent,
  pictureDetailsSchema,
  splitParagraphs,
  storefrontContentSchema,
  type HomepageTextInput,
  type PictureDetailsInput,
  type PictureSlot,
  type StoreImage,
  type StorefrontContent,
} from "@/lib/validation/storefront-content";
import { db } from "../db";
import { FieldConflictError, RuleViolationError } from "../errors";
import { processUploadedImage } from "../storage/images";
import { storage } from "../storage/storage";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";

/**
 * Stores a picture for the storefront homepage and returns its description,
 * ready to place in the store's content. The file is decoded and re-encoded
 * the same way as product photos, so the same upload protections apply.
 */
export async function uploadStorefrontImage(
  context: StoreContext,
  upload: { bytes: Buffer; alt: string; caption?: string; credit?: string },
): Promise<StoreImage> {
  requirePermission(context, "store:settings");
  const image = await processUploadedImage(upload.bytes);
  const storageKey = `stores/${context.storeId}/content/${randomUUID()}.webp`;
  await storage.put(storageKey, image.data);
  return {
    storageKey,
    alt: upload.alt.trim().slice(0, 200),
    caption: (upload.caption ?? "").trim().slice(0, 160),
    credit: (upload.credit ?? "").trim().slice(0, 300),
    width: image.width,
    height: image.height,
  };
}

export async function getStorefrontContent(
  context: StoreContext,
): Promise<StorefrontContent> {
  requirePermission(context, "store:view");
  const store = await db.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { storefrontContent: true },
  });
  return parseStorefrontContent(store.storefrontContent);
}

/** Replaces the store's homepage content after validating it. */
export async function updateStorefrontContent(
  context: StoreContext,
  input: unknown,
) {
  requirePermission(context, "store:settings");
  const content = storefrontContentSchema.parse(input);

  // A picture reference must point into this store's own folder, so one
  // merchant can't display (or claim) another store's uploads.
  const images = [
    content.heroImage,
    content.letter?.image,
    ...content.plates,
    content.footerImage,
  ];
  const ownPrefix = `stores/${context.storeId}/content/`;
  if (
    images.some((image) => image && !image.storageKey.startsWith(ownPrefix))
  ) {
    throw new RuleViolationError(
      "One of the pictures doesn't belong to this store.",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: context.storeId },
      data: { storefrontContent: content as Prisma.InputJsonValue },
    });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "store.storefront_content_updated",
      entityType: "store",
      entityId: context.storeId,
    });
  });
  return content;
}

/** Which picture of the content sits in each slot. */
function pictureInSlot(
  content: StorefrontContent,
  slot: PictureSlot,
): StoreImage | undefined {
  switch (slot) {
    case "hero":
      return content.heroImage;
    case "plate-1":
      return content.plates[0];
    case "plate-2":
      return content.plates[1];
    case "letter":
      return content.letter?.image;
    case "footer":
      return content.footerImage;
  }
}

/** A copy of the content with `image` placed in (or, if undefined, removed from) a slot. */
function withPictureInSlot(
  content: StorefrontContent,
  slot: PictureSlot,
  image: StoreImage | undefined,
): StorefrontContent {
  switch (slot) {
    case "hero":
      return { ...content, heroImage: image };
    case "footer":
      return { ...content, footerImage: image };
    case "letter":
      return content.letter
        ? { ...content, letter: { ...content.letter, image } }
        : content;
    case "plate-1":
    case "plate-2": {
      const plates: (StoreImage | undefined)[] = [
        content.plates[0],
        content.plates[1],
      ];
      plates[slot === "plate-1" ? 0 : 1] = image;
      // Keep the order stable: an empty first slot is filled by the second picture.
      return {
        ...content,
        plates: plates.filter((plate): plate is StoreImage => Boolean(plate)),
      };
    }
  }
}

/**
 * Puts a picture in a homepage slot. With a file, the picture is replaced
 * (and the old file deleted); without one, only its alt text, caption and
 * credit are updated.
 */
export async function setHomepagePicture(
  context: StoreContext,
  slot: PictureSlot,
  input: { bytes: Buffer | null } & PictureDetailsInput,
): Promise<void> {
  requirePermission(context, "store:settings");
  const details = pictureDetailsSchema.parse(input);
  const content = await getStorefrontContent(context);
  const current = pictureInSlot(content, slot);

  if (slot === "letter" && !content.letter) {
    throw new RuleViolationError(
      "Write the founder's letter first, then add its picture.",
    );
  }
  if (!input.bytes && !current) {
    throw new RuleViolationError("Choose a picture to upload.");
  }

  const next = input.bytes
    ? await uploadStorefrontImage(context, { bytes: input.bytes, ...details })
    : { ...(current as StoreImage), ...details };

  try {
    await updateStorefrontContent(
      context,
      withPictureInSlot(content, slot, next),
    );
  } catch (error) {
    // The new file was never referenced; don't leave it behind.
    if (input.bytes) await storage.delete(next.storageKey);
    throw error;
  }
  if (input.bytes && current) await storage.delete(current.storageKey);
}

export async function removeHomepagePicture(
  context: StoreContext,
  slot: PictureSlot,
): Promise<void> {
  requirePermission(context, "store:settings");
  const content = await getStorefrontContent(context);
  const current = pictureInSlot(content, slot);
  if (!current) return;
  await updateStorefrontContent(
    context,
    withPictureInSlot(content, slot, undefined),
  );
  await storage.delete(current.storageKey);
}

/**
 * Saves the homepage words and the featured product. Pictures are left as
 * they are, except the letter's picture, which goes if the letter is removed.
 */
export async function updateHomepageText(
  context: StoreContext,
  input: HomepageTextInput,
): Promise<void> {
  requirePermission(context, "store:settings");
  const text = homepageTextSchema.parse(input);
  const content = await getStorefrontContent(context);

  if (text.featuredProductSlug) {
    const product = await db.product.findFirst({
      where: {
        storeId: context.storeId,
        slug: text.featuredProductSlug,
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!product)
      throw new FieldConflictError(
        "featuredProductSlug",
        "Choose one of your published products",
      );
  }

  const paragraphs = splitParagraphs(text.letterText);
  const letter =
    paragraphs.length > 0
      ? {
          paragraphs,
          signedBy: text.letterSignedBy,
          role: text.letterRole,
          image: content.letter?.image,
        }
      : undefined;

  await updateStorefrontContent(context, {
    ...content,
    summary: text.summary,
    actionLabel: text.actionLabel || "Shop now",
    facts: text.facts.filter(Boolean),
    featuredProductSlug: text.featuredProductSlug || undefined,
    letter,
  });
  if (!letter && content.letter?.image)
    await storage.delete(content.letter.image.storageKey);
}

/** Published products the merchant can feature on the homepage. */
export async function listFeaturableProducts(context: StoreContext) {
  requirePermission(context, "store:view");
  return db.product.findMany({
    where: { storeId: context.storeId, status: "PUBLISHED", deletedAt: null },
    orderBy: { title: "asc" },
    select: { slug: true, title: true },
  });
}
