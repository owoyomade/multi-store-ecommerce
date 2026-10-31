import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, RuleViolationError } from "@/server/errors";
import { addToCart } from "@/server/services/cart";
import { createProduct } from "@/server/services/catalog";
import {
  processPaymentWebhook,
  startCheckout,
} from "@/server/services/checkout";
import {
  addOrderNote,
  cancelOrder,
  markOrderDelivered,
  markOrderProcessing,
  refundOrder,
  shipOrder,
} from "@/server/services/order-operations";
import { createStore } from "@/server/services/stores";
import { ForbiddenError } from "@/server/tenancy/store-context";
import { FakePaymentProvider } from "../support/fake-payment-provider";
import {
  addMember,
  contextFor,
  createUser,
  productInput,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

const address = {
  name: "Ada",
  line1: "1 Queen St",
  city: "Toronto",
  postalCode: "M5H 2N2",
  country: "CA",
};

/** A store with one paid order for 2 mugs at $20 (total $54.20 with demo tax and shipping). */
async function paidOrder() {
  const owner = await createUser("Owner");
  const store = await createStore(owner.id, storeInput({ slug: "shop" }));
  await db.storeSettings.update({
    where: { storeId: store.id },
    data: {
      demoTaxRateBps: 1300,
      flatShippingCents: 900,
      freeShippingOverCents: 7500,
    },
  });
  const context = await contextFor(owner.id, "shop");
  const product = await createProduct(
    context,
    productInput({
      title: "Mug",
      slug: "mug",
      skuPrefix: "MUG",
      price: "20.00",
      initialStock: 5,
    }),
  );
  const variant = await db.productVariant.findFirstOrThrow({
    where: { productId: product.id },
  });
  const provider = new FakePaymentProvider();
  const { newToken } = await addToCart(store.id, null, variant.id, 2);
  await startCheckout({
    store: { id: store.id, slug: "shop", currency: "CAD" },
    cartToken: newToken,
    viewerUserId: null,
    input: { email: "ada@example.test", address },
    idempotencyKey: crypto.randomUUID(),
    storefrontUrl: "http://localhost:3210/s/shop",
    provider,
  });
  await processPaymentWebhook(provider.completedEvent(), provider.name);
  const order = await db.order.findFirstOrThrow();
  return { owner, store, context, provider, order, variant };
}

const onHand = async (variantId: string) =>
  (await db.inventoryLevel.findFirstOrThrow({ where: { variantId } })).onHand;

describe("fulfilment", () => {
  it("moves an order through processing, shipped and delivered with history", async () => {
    const { context, order } = await paidOrder();

    await markOrderProcessing(context, order.id);
    await shipOrder(context, order.id, {
      carrier: "Canada Post",
      trackingNumber: "CP123456",
      trackingUrl: "https://example.test/track",
    });
    await markOrderDelivered(context, order.id);

    const saved = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        statusHistory: { orderBy: { createdAt: "asc" } },
        shipments: true,
      },
    });
    expect(saved.status).toBe("DELIVERED");
    expect(saved.statusHistory.map((entry) => entry.toStatus)).toEqual([
      "PENDING",
      "PAID",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
    ]);
    expect(saved.statusHistory.at(-1)?.actorUserId).toBe(context.userId);
    expect(saved.shipments[0]).toMatchObject({
      carrier: "Canada Post",
      trackingNumber: "CP123456",
    });
    expect(saved.shipments[0]?.deliveredAt).not.toBeNull();
  });

  it("refuses to ship an order twice or skip backwards", async () => {
    const { context, order } = await paidOrder();
    await shipOrder(context, order.id, {
      carrier: "UPS",
      trackingNumber: "1Z999",
    });
    await expect(
      shipOrder(context, order.id, { carrier: "UPS", trackingNumber: "1Z999" }),
    ).rejects.toBeInstanceOf(RuleViolationError);
    await expect(markOrderProcessing(context, order.id)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
  });

  it("rejects tracking links that aren't web addresses", async () => {
    const { context, order } = await paidOrder();
    await expect(
      shipOrder(context, order.id, {
        carrier: "UPS",
        trackingNumber: "1Z999",
        trackingUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow();
  });

  it("lets a fulfillment agent ship but not refund or cancel", async () => {
    const { store, order, provider } = await paidOrder();
    const agent = await createUser("Agent");
    await addMember(store.id, agent.id, "FULFILLMENT_AGENT");
    const agentContext = await contextFor(agent.id, "shop");

    await shipOrder(agentContext, order.id, {
      carrier: "UPS",
      trackingNumber: "1Z999",
    });
    await expect(
      refundOrder(
        agentContext,
        order.id,
        { amountCents: 100, reason: "Damaged" },
        provider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      cancelOrder(agentContext, order.id, "", provider),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("refunds", () => {
  it("refunds part of an order, then the rest, ending as refunded", async () => {
    const { context, order, provider } = await paidOrder();

    await refundOrder(
      context,
      order.id,
      { amountCents: 2000, reason: "One mug arrived chipped" },
      provider,
    );
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("PAID");

    await refundOrder(
      context,
      order.id,
      { amountCents: order.totalCents - 2000, reason: "Returned the rest" },
      provider,
    );

    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("REFUNDED");
    expect(provider.refunds.map((refund) => refund.amountCents)).toEqual([
      2000,
      order.totalCents - 2000,
    ]);
    expect(
      new Set(provider.refunds.map((refund) => refund.idempotencyKey)).size,
    ).toBe(2);
    expect(
      await db.auditLog.count({ where: { action: "order.refunded" } }),
    ).toBe(2);
  });

  it("never refunds more than was paid, even when two refunds race", async () => {
    const { context, order, provider } = await paidOrder();
    const results = await Promise.allSettled([
      refundOrder(
        context,
        order.id,
        { amountCents: order.totalCents, reason: "First" },
        provider,
      ),
      refundOrder(
        context,
        order.id,
        { amountCents: order.totalCents, reason: "Second" },
        provider,
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(provider.refunds).toHaveLength(1);
    const payment = await db.payment.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(payment.refundedCents).toBe(order.totalCents);
  });

  it("gives the amount back and records a failure when the provider errors", async () => {
    const { context, order, provider } = await paidOrder();
    provider.failNextRefund = true;

    await expect(
      refundOrder(
        context,
        order.id,
        { amountCents: 1000, reason: "Late" },
        provider,
      ),
    ).rejects.toBeInstanceOf(RuleViolationError);

    expect(
      (await db.payment.findFirstOrThrow({ where: { orderId: order.id } }))
        .refundedCents,
    ).toBe(0);
    expect(await db.refund.count({ where: { status: "FAILED" } })).toBe(1);
  });

  it("puts items back in stock once when asked", async () => {
    const { context, order, provider, variant } = await paidOrder();
    expect(await onHand(variant.id)).toBe(3);

    await refundOrder(
      context,
      order.id,
      { amountCents: 1000, reason: "Returned", restock: true },
      provider,
    );
    await refundOrder(
      context,
      order.id,
      { amountCents: 1000, reason: "Goodwill", restock: true },
      provider,
    );

    expect(await onHand(variant.id)).toBe(5);
    expect(
      await db.inventoryMovement.count({ where: { reason: "RETURN" } }),
    ).toBe(1);
  });
});

describe("cancellation", () => {
  it("cancels a paid order with a full refund and restock", async () => {
    const { context, order, provider, variant } = await paidOrder();

    await cancelOrder(
      context,
      order.id,
      "Customer changed their mind",
      provider,
    );

    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("CANCELLED");
    expect(provider.refunds[0]?.amountCents).toBe(order.totalCents);
    expect(await onHand(variant.id)).toBe(5);
  });

  it("won't cancel a shipped order", async () => {
    const { context, order, provider } = await paidOrder();
    await shipOrder(context, order.id, {
      carrier: "UPS",
      trackingNumber: "1Z999",
    });
    await expect(cancelOrder(context, order.id, "", provider)).rejects.toThrow(
      "Refund them instead",
    );
  });
});

describe("order isolation and notes", () => {
  it("can't touch another store's order", async () => {
    const { order, provider } = await paidOrder();
    const other = await createUser("Other");
    await createStore(other.id, storeInput({ slug: "other" }));
    const otherContext = await contextFor(other.id, "other");

    await expect(
      shipOrder(otherContext, order.id, {
        carrier: "UPS",
        trackingNumber: "1Z999",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      refundOrder(
        otherContext,
        order.id,
        { amountCents: 100, reason: "x y" },
        provider,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      addOrderNote(otherContext, order.id, "Hello"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("adds an internal note", async () => {
    const { context, order } = await paidOrder();
    await addOrderNote(context, order.id, "Customer asked for gift wrap.");
    expect((await db.orderNote.findFirstOrThrow()).body).toBe(
      "Customer asked for gift wrap.",
    );
  });
});
