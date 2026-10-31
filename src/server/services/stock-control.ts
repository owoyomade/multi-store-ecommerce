import "server-only";
import {
  stockAdjustmentSchema,
  type StockAdjustmentInput,
} from "@/lib/validation/stock";
import { db } from "../db";
import { NotFoundError, RuleViolationError } from "../errors";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";
import { getDefaultLocationId } from "./inventory";

/** At or below this many sellable units, a variant shows up as low stock. */
export const LOW_STOCK_THRESHOLD = 5;

export type StockRow = {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
};

/**
 * Every stock-tracked variant of the store's live products, fewest available
 * first, so the items that need reordering are at the top.
 */
export async function listStock(
  context: StoreContext,
  options: { lowOnly?: boolean } = {},
): Promise<StockRow[]> {
  requirePermission(context, "inventory:adjust");
  return queryStockRows(context.storeId, options.lowOnly ?? false);
}

/** Low-stock rows for the overview page, which only needs store:view. */
export async function listLowStock(
  context: StoreContext,
  limit: number,
): Promise<StockRow[]> {
  requirePermission(context, "store:view");
  return (await queryStockRows(context.storeId, true)).slice(0, limit);
}

async function queryStockRows(
  storeId: string,
  lowOnly: boolean,
): Promise<StockRow[]> {
  const variants = await db.productVariant.findMany({
    where: {
      storeId,
      archivedAt: null,
      trackInventory: true,
      product: { deletedAt: null, status: { not: "ARCHIVED" } },
    },
    select: {
      id: true,
      title: true,
      sku: true,
      product: { select: { id: true, title: true } },
      inventoryLevels: { select: { onHand: true, reserved: true } },
    },
  });
  const rows = variants.map((variant) => {
    const onHand = variant.inventoryLevels.reduce(
      (sum, level) => sum + level.onHand,
      0,
    );
    const reserved = variant.inventoryLevels.reduce(
      (sum, level) => sum + level.reserved,
      0,
    );
    return {
      variantId: variant.id,
      productId: variant.product.id,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
    };
  });
  return rows
    .filter((row) => !lowOnly || row.available <= LOW_STOCK_THRESHOLD)
    .sort(
      (a, b) =>
        a.available - b.available ||
        a.productTitle.localeCompare(b.productTitle),
    );
}

/**
 * Adds or removes units with a reason, e.g. +24 "Received stock" or −2
 * "Correction". Unlike the product editor, which sets an exact count, this
 * records the change itself, which is what a stockroom works from.
 */
export async function adjustStock(
  context: StoreContext,
  variantId: string,
  input: StockAdjustmentInput,
) {
  requirePermission(context, "inventory:adjust");
  const { change, reason, note } = stockAdjustmentSchema.parse(input);

  return db.$transaction(async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, storeId: context.storeId, archivedAt: null },
      select: { id: true, trackInventory: true },
    });
    if (!variant) throw new NotFoundError("Variant");
    if (!variant.trackInventory)
      throw new RuleViolationError("This variant doesn't track stock.");

    const locationId = await getDefaultLocationId(tx, context.storeId);
    // Lock the row so a checkout reserving units at the same moment can't
    // slip between our read and write.
    const [level] = await tx.$queryRaw<{ onHand: number; reserved: number }[]>`
      SELECT "onHand", "reserved" FROM "inventory_levels"
      WHERE "variantId" = ${variantId} AND "locationId" = ${locationId}
      FOR UPDATE`;
    const onHand = (level?.onHand ?? 0) + change;
    const reserved = level?.reserved ?? 0;
    if (onHand < reserved) {
      throw new RuleViolationError(
        reserved > 0
          ? `That would leave ${onHand} on hand, but ${reserved} are held for checkouts in progress.`
          : `There are only ${level?.onHand ?? 0} on hand.`,
      );
    }

    await tx.inventoryLevel.upsert({
      where: { variantId_locationId: { variantId, locationId } },
      update: { onHand },
      create: { storeId: context.storeId, variantId, locationId, onHand },
    });
    await tx.inventoryMovement.create({
      data: {
        storeId: context.storeId,
        variantId,
        locationId,
        delta: change,
        reason,
        note: note || null,
        actorUserId: context.userId,
      },
    });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "inventory.adjusted",
      entityType: "variant",
      entityId: variantId,
      metadata: { delta: change, reason },
    });
    return { onHand };
  });
}

/** The most recent ledger rows for one variant, newest first. */
export async function listStockMovements(
  context: StoreContext,
  variantId: string,
  limit = 20,
) {
  requirePermission(context, "inventory:adjust");
  return db.inventoryMovement.findMany({
    where: { storeId: context.storeId, variantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      delta: true,
      reason: true,
      note: true,
      orderId: true,
      actorUserId: true,
      createdAt: true,
    },
  });
}
