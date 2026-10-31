import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addToCart } from "@/server/services/cart";
import { createProduct } from "@/server/services/catalog";
import {
  processPaymentWebhook,
  startCheckout,
} from "@/server/services/checkout";
import { refundOrder } from "@/server/services/order-operations";
import {
  exportOrdersCsv,
  getStoreMetrics,
  listActivity,
} from "@/server/services/reports";
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

/** A store with one paid order: 2 mugs at $20, no tax or shipping, so the total is $40. */
async function storeWithPaidOrder(customerName = "Ada") {
  const owner = await createUser("Owner");
  const store = await createStore(owner.id, storeInput({ slug: "shop" }));
  await db.storeSettings.update({
    where: { storeId: store.id },
    data: {
      demoTaxRateBps: 0,
      flatShippingCents: 0,
      freeShippingOverCents: null,
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
    input: {
      email: "ada@example.test",
      address: { ...address, name: customerName },
    },
    idempotencyKey: crypto.randomUUID(),
    storefrontUrl: "http://localhost:3210/s/shop",
    provider,
  });
  await processPaymentWebhook(provider.completedEvent(), provider.name);
  const order = await db.order.findFirstOrThrow();
  return { store, context, provider, order };
}

describe("store metrics", () => {
  it("counts paid orders, subtracts refunds and ranks products", async () => {
    const { context, order, provider } = await storeWithPaidOrder();
    expect(order.totalCents).toBe(4000);
    await refundOrder(
      context,
      order.id,
      { amountCents: 1000, reason: "Chipped", restock: false },
      provider,
    );

    const metrics = await getStoreMetrics(context, 30);
    expect(metrics).toMatchObject({
      orderCount: 1,
      grossSalesCents: 4000,
      refundedCents: 1000,
      netSalesCents: 3000,
      averageOrderCents: 4000,
      topProducts: [{ title: "Mug", quantity: 2, revenueCents: 4000 }],
    });
  });

  it("ignores checkouts that were never paid", async () => {
    const owner = await createUser("Owner");
    await createStore(owner.id, storeInput({ slug: "empty" }));
    const metrics = await getStoreMetrics(await contextFor(owner.id, "empty"));
    expect(metrics.orderCount).toBe(0);
    expect(metrics.averageOrderCents).toBe(0);
  });

  it("is hidden from roles without reports", async () => {
    const { store } = await storeWithPaidOrder();
    const agent = await createUser("Agent");
    await addMember(store.id, agent.id, "FULFILLMENT_AGENT");
    const agentContext = await contextFor(agent.id, "shop");

    await expect(getStoreMetrics(agentContext)).rejects.toThrow(ForbiddenError);
    await expect(listActivity(agentContext)).rejects.toThrow(ForbiddenError);
    await expect(
      exportOrdersCsv(agentContext, { from: new Date(0), to: new Date() }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("order export", () => {
  it("writes one row per order with formula cells neutralised", async () => {
    const { context } = await storeWithPaidOrder(
      '=HYPERLINK("http://evil.example")',
    );
    const csv = await exportOrdersCsv(context, {
      from: new Date(Date.now() - 86_400_000),
      to: new Date(Date.now() + 86_400_000),
    });
    const lines = csv.trimEnd().split("\r\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Order,Placed,Paid,Status,Customer,Email/);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    expect(lines[1]).toContain("40.00");
  });

  it("only includes the store's own orders", async () => {
    await storeWithPaidOrder();
    const other = await createUser("Other");
    await createStore(other.id, storeInput({ slug: "other" }));
    const csv = await exportOrdersCsv(await contextFor(other.id, "other"), {
      from: new Date(0),
      to: new Date(Date.now() + 86_400_000),
    });
    expect(csv.trimEnd().split("\r\n")).toHaveLength(1);
  });
});

describe("activity", () => {
  it("lists audit entries with who made them", async () => {
    const { context, order, provider } = await storeWithPaidOrder();
    await refundOrder(
      context,
      order.id,
      { amountCents: 500, reason: "Late", restock: false },
      provider,
    );

    const { entries, names } = await listActivity(context);
    const refund = entries.find((entry) => entry.action === "order.refunded");
    expect(refund?.actorUserId).toBe(context.userId);
    expect(names[context.userId]).toBe("Owner");
  });
});
