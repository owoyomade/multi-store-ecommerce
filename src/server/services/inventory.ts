import "server-only";
import type {
  InventoryMovementReason,
  Prisma,
} from "@/generated/prisma/client";

export async function getDefaultLocationId(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<string> {
  const location = await tx.inventoryLocation.findFirst({
    where: { storeId, isDefault: true },
    select: { id: true },
  });
  if (!location) {
    // createStore always makes one, so this means the data is broken.
    throw new Error(`Store ${storeId} has no default inventory location`);
  }
  return location.id;
}

/**
 * Sets a variant's on-hand stock to an exact number and records the
 * difference in the movement ledger. Must run inside a transaction.
 *
 * The level row is locked with SELECT ... FOR UPDATE so two staff saving at the
 * same moment can't both read the old number and write a wrong ledger delta.
 */
export async function setOnHandStock(
  tx: Prisma.TransactionClient,
  options: {
    storeId: string;
    variantId: string;
    onHand: number;
    reason: InventoryMovementReason;
    actorUserId: string | null;
  },
): Promise<void> {
  const { storeId, variantId, onHand, reason, actorUserId } = options;
  const locationId = await getDefaultLocationId(tx, storeId);

  const [current] = await tx.$queryRaw<{ onHand: number }[]>`
    SELECT "onHand" FROM "inventory_levels"
    WHERE "variantId" = ${variantId} AND "locationId" = ${locationId}
    FOR UPDATE`;
  const previous = current?.onHand ?? 0;
  const delta = onHand - previous;

  await tx.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    update: { onHand },
    create: { storeId, variantId, locationId, onHand },
  });

  if (delta !== 0) {
    await tx.inventoryMovement.create({
      data: { storeId, variantId, locationId, delta, reason, actorUserId },
    });
  }
}

/** Units a shopper can still buy. Untracked variants are treated as always available. */
export function availableToSell(
  variant: { trackInventory: boolean },
  levels: { onHand: number; reserved: number }[],
): number {
  if (!variant.trackInventory) return Number.POSITIVE_INFINITY;
  return Math.max(
    0,
    levels.reduce((sum, level) => sum + level.onHand - level.reserved, 0),
  );
}
