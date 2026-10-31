import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, RuleViolationError } from "@/server/errors";
import { createProduct } from "@/server/services/catalog";
import {
  adjustStock,
  listLowStock,
  listStock,
  listStockMovements,
} from "@/server/services/stock-control";
import { createStore } from "@/server/services/stores";
import { ForbiddenError } from "@/server/tenancy/store-context";
import {
  addMember,
  contextFor,
  createUser,
  productInput,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

async function storeWithMug(initialStock = 10) {
  const owner = await createUser("Owner");
  const store = await createStore(owner.id, storeInput({ slug: "shop" }));
  const context = await contextFor(owner.id, "shop");
  const product = await createProduct(
    context,
    productInput({ title: "Mug", slug: "mug", skuPrefix: "MUG", initialStock }),
  );
  const variant = await db.productVariant.findFirstOrThrow({
    where: { productId: product.id },
  });
  return { owner, store, context, variant };
}

describe("stock adjustments", () => {
  it("adds received stock and records it with a note", async () => {
    const { context, variant } = await storeWithMug(10);

    const result = await adjustStock(context, variant.id, {
      change: "24",
      reason: "RESTOCK",
      note: "PO 1042",
    });
    expect(result.onHand).toBe(34);

    const [latest] = await listStockMovements(context, variant.id);
    expect(latest).toMatchObject({
      delta: 24,
      reason: "RESTOCK",
      note: "PO 1042",
      actorUserId: context.userId,
    });
    expect(
      await db.auditLog.count({ where: { action: "inventory.adjusted" } }),
    ).toBe(1);
  });

  it("removes units for a correction", async () => {
    const { context, variant } = await storeWithMug(10);
    await adjustStock(context, variant.id, {
      change: "-3",
      reason: "ADJUSTMENT",
    });
    expect(
      (
        await db.inventoryLevel.findFirstOrThrow({
          where: { variantId: variant.id },
        })
      ).onHand,
    ).toBe(7);
  });

  it("won't drop below the units held for checkouts in progress", async () => {
    const { context, variant } = await storeWithMug(10);
    await db.inventoryLevel.updateMany({
      where: { variantId: variant.id },
      data: { reserved: 4 },
    });

    await expect(
      adjustStock(context, variant.id, { change: "-7", reason: "ADJUSTMENT" }),
    ).rejects.toThrow(/4 are held/);
    await adjustStock(context, variant.id, {
      change: "-6",
      reason: "ADJUSTMENT",
    });
  });

  it("rejects zero, fractions and unknown reasons", async () => {
    const { context, variant } = await storeWithMug();
    await expect(
      adjustStock(context, variant.id, { change: "0", reason: "RESTOCK" }),
    ).rejects.toThrow();
    await expect(
      adjustStock(context, variant.id, { change: "1.5", reason: "RESTOCK" }),
    ).rejects.toThrow();
    // SALE is only ever written by checkout.
    await expect(
      adjustStock(context, variant.id, { change: "5", reason: "SALE" }),
    ).rejects.toThrow();
  });

  it("refuses roles without inventory access", async () => {
    const { store, variant } = await storeWithMug();
    const agent = await createUser("Agent");
    await addMember(store.id, agent.id, "FULFILLMENT_AGENT");
    const agentContext = await contextFor(agent.id, "shop");

    await expect(
      adjustStock(agentContext, variant.id, { change: "5", reason: "RESTOCK" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("can't reach another store's variants", async () => {
    const { variant } = await storeWithMug();
    const other = await createUser("Other");
    await createStore(other.id, storeInput({ slug: "other" }));
    const otherContext = await contextFor(other.id, "other");

    await expect(
      adjustStock(otherContext, variant.id, { change: "5", reason: "RESTOCK" }),
    ).rejects.toThrow(NotFoundError);
    expect(await listStockMovements(otherContext, variant.id)).toEqual([]);
  });
});

describe("stock lists", () => {
  it("lists the fewest available first and filters low stock", async () => {
    const { context } = await storeWithMug(2);
    await createProduct(
      context,
      productInput({ title: "Tee", slug: "tee", initialStock: 50 }),
    );

    const all = await listStock(context);
    expect(all.map((row) => row.productTitle)).toEqual(["Mug", "Tee"]);
    expect(
      (await listStock(context, { lowOnly: true })).map(
        (row) => row.productTitle,
      ),
    ).toEqual(["Mug"]);
    expect(await listLowStock(context, 5)).toHaveLength(1);
  });

  it("explains an adjustment that would go below zero", async () => {
    const { context, variant } = await storeWithMug(3);
    await expect(
      adjustStock(context, variant.id, { change: "-5", reason: "ADJUSTMENT" }),
    ).rejects.toThrow(RuleViolationError);
  });
});
