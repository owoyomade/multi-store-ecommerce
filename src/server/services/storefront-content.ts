import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  parseStorefrontContent,
  storefrontContentSchema,
  type StoreImage,
  type StorefrontContent,
} from "@/lib/validation/storefront-content";
import { db } from "../db";
import { RuleViolationError } from "../errors";
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
