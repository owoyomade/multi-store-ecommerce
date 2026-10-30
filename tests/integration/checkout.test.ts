import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, RuleViolationError } from "@/server/errors";
import { WebhookSignatureError } from "@/server/payments/provider";
import { StripePaymentProvider } from "@/server/payments/stripe-provider";
import { addToCart, getCart } from "@/server/services/cart";
import { createProduct, updateVariants } from "@/server/services/catalog";
import {
  cancelCheckout,
  processPaymentWebhook,
  releaseExpiredReservations,
  startCheckout,
} from "@/server/services/checkout";
import {
  getOrderByCheckoutSession,
  getOrderForDashboard,
  getOrderForShopper,
  listOrdersForShopper,
} from "@/server/services/orders";
import { createStore } from "@/server/services/stores";
import { FakePaymentProvider } from "../support/fake-payment-provider";
import {
  contextFor,
  createUser,
  productInput,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

const address = {
  name: "Ada Shopper",
  line1: "1 Queen St W",
  city: "Toronto",
  region: "ON",
  postalCode: "M5H 2N2",
  country: "CA",
};

async function setUp(options: { stock?: number; price?: string } = {}) {
  const owner = await createUser("Owner");
  const store = await createStore(
    owner.id,
    storeInput({ slug: "shop", currency: "CAD" }),
  );
  await db.store.update({
    where: { id: store.id },
    data: { status: "ACTIVE" },
  });
  // 13% demo tax, $9 shipping, free over $75.
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
      price: options.price ?? "20.00",
      initialStock: options.stock ?? 5,
    }),
  );
  const variant = await db.productVariant.findFirstOrThrow({
    where: { productId: product.id },
  });
  return {
    owner,
    store: { id: store.id, slug: "shop", currency: "CAD" },
    context,
    product,
    variant,
  };
}

async function cartWith(storeId: string, variantId: string, quantity: number) {
  const { newToken } = await addToCart(storeId, null, variantId, quantity);
  if (!newToken) throw new Error("expected a new cart");
  return newToken;
}

async function stockOf(variantId: string) {
  return db.inventoryLevel.findFirstOrThrow({
    where: { variantId },
    select: { onHand: true, reserved: true },
  });
}

function checkout(
  store: { id: string; slug: string; currency: string },
  cartToken: string,
  provider: FakePaymentProvider,
  overrides: Partial<Parameters<typeof startCheckout>[0]> = {},
) {
  return startCheckout({
    store,
    cartToken,
    viewerUserId: null,
    input: { email: "ada@example.test", address },
    idempotencyKey: crypto.randomUUID(),
    storefrontUrl: "http://localhost:3210/s/shop",
    provider,
    ...overrides,
  });
}

describe("startCheckout", () => {
  it("creates a pending order from live prices, reserves stock and opens a session", async () => {
    const { store, variant } = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 2);

    const { checkoutUrl } = await checkout(store, cartToken, provider);

    expect(checkoutUrl).toMatch(/^https:\/\/pay\.example\.test\//);
    const order = await db.order.findFirstOrThrow({ include: { items: true } });
    expect(order).toMatchObject({
      status: "PENDING",
      orderNumber: 1001,
      subtotalCents: 4000,
      shippingCents: 900,
      taxCents: 520,
      totalCents: 5420,
    });
    expect(order.items[0]).toMatchObject({
      productTitle: "Mug",
      sku: "MUG",
      unitPriceCents: 2000,
      quantity: 2,
    });
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 2 });
    // The provider is asked for exactly the server-computed total.
    const charged = provider
      .lastSession()
      .lines.reduce(
        (sum, line) => sum + line.unitAmountCents * line.quantity,
        0,
      );
    expect(charged).toBe(5420);
  });

  it("ignores any price the browser tries to send", async () => {
    const { store, variant } = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 1);
    const tamperedInput = {
      email: "ada@example.test",
      address,
      totalCents: 1,
      priceCents: 1,
    } as unknown as Parameters<typeof startCheckout>[0]["input"];

    await checkout(store, cartToken, provider, { input: tamperedInput });

    expect((await db.order.findFirstOrThrow()).subtotalCents).toBe(2000);
  });

  it("uses the price at checkout time, not when the item was added to the cart", async () => {
    const { store, context, product, variant } = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 1);
    await updateVariants(context, product.id, [
      {
        id: variant.id,
        sku: "MUG",
        price: "25.00",
        compareAtPrice: "",
        stock: 5,
        trackInventory: true,
      },
    ]);

    await checkout(store, cartToken, provider);

    expect((await db.order.findFirstOrThrow()).subtotalCents).toBe(2500);
  });

  it("lets only one of two shoppers buy the last unit", async () => {
    const { store, variant } = await setUp({ stock: 1 });
    const provider = new FakePaymentProvider();
    const cartA = await cartWith(store.id, variant.id, 1);
    const cartB = await cartWith(store.id, variant.id, 1);

    const results = await Promise.allSettled([
      checkout(store, cartA, provider),
      checkout(store, cartB, provider),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
      RuleViolationError,
    );
    expect(await stockOf(variant.id)).toEqual({ onHand: 1, reserved: 1 });
    expect(await db.order.count()).toBe(1);
  });

  it("returns the same checkout when the form is submitted twice", async () => {
    const { store, variant } = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 1);
    const idempotencyKey = crypto.randomUUID();

    const first = await checkout(store, cartToken, provider, {
      idempotencyKey,
    });
    const second = await checkout(store, cartToken, provider, {
      idempotencyKey,
    });

    expect(second.checkoutUrl).toBe(first.checkoutUrl);
    expect(await db.order.count()).toBe(1);
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 1 });
  });

  it("releases stock and cancels the order if the payment provider is down", async () => {
    const { store, variant } = await setUp();
    const provider = new FakePaymentProvider();
    provider.failNextCheckout = true;
    const cartToken = await cartWith(store.id, variant.id, 2);

    await expect(checkout(store, cartToken, provider)).rejects.toThrow(
      "Payments are temporarily unavailable",
    );

    expect((await db.order.findFirstOrThrow()).status).toBe("CANCELLED");
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 0 });
    expect((await getCart(store.id, cartToken)).itemCount).toBe(2); // cart kept for a retry
  });

  it("refuses an empty cart", async () => {
    const { store } = await setUp();
    await expect(
      checkout(store, "no-such-cart", new FakePaymentProvider()),
    ).rejects.toThrow("Your cart is empty.");
  });
});

describe("payment webhooks", () => {
  async function pendingOrder() {
    const setup = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(setup.store.id, setup.variant.id, 2);
    await checkout(setup.store, cartToken, provider);
    return { ...setup, provider, cartToken };
  }

  it("marks the order paid, turns the reservation into a sale and empties the cart", async () => {
    const { store, variant, provider, cartToken } = await pendingOrder();

    expect(
      await processPaymentWebhook(provider.completedEvent(), provider.name),
    ).toBe("processed");

    const order = await db.order.findFirstOrThrow({
      include: { statusHistory: true, payments: true },
    });
    expect(order.status).toBe("PAID");
    expect(order.paidAt).not.toBeNull();
    expect(order.payments[0]?.status).toBe("SUCCEEDED");
    expect(order.statusHistory.map((entry) => entry.toStatus)).toEqual([
      "PENDING",
      "PAID",
    ]);
    expect(await stockOf(variant.id)).toEqual({ onHand: 3, reserved: 0 });
    expect(
      await db.inventoryMovement.count({
        where: { reason: "SALE", orderId: order.id, delta: -2 },
      }),
    ).toBe(1);
    expect((await getCart(store.id, cartToken)).itemCount).toBe(0);
  });

  it("processes a repeated delivery of the same event only once", async () => {
    const { variant, provider } = await pendingOrder();
    const event = provider.completedEvent();

    await processPaymentWebhook(event, provider.name);
    expect(await processPaymentWebhook(event, provider.name)).toBe("duplicate");

    expect(await stockOf(variant.id)).toEqual({ onHand: 3, reserved: 0 });
    expect(
      await db.inventoryMovement.count({ where: { reason: "SALE" } }),
    ).toBe(1);
  });

  it("doesn't mark the order paid when the charged amount doesn't match", async () => {
    const { provider } = await pendingOrder();

    await processPaymentWebhook(
      provider.completedEvent({ amountCents: 100 }),
      provider.name,
    );

    expect((await db.order.findFirstOrThrow()).status).toBe("PENDING");
    expect(
      await db.paymentEvent.count({ where: { type: "amount_mismatch" } }),
    ).toBe(1);
  });

  it("cancels the order and releases stock when the checkout expires", async () => {
    const { variant, provider } = await pendingOrder();

    await processPaymentWebhook(provider.expiredEvent(), provider.name);

    expect((await db.order.findFirstOrThrow()).status).toBe("CANCELLED");
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 0 });
  });

  it("honours a payment that arrives after the reservation was released", async () => {
    const { variant, provider } = await pendingOrder();
    await processPaymentWebhook(provider.expiredEvent(), provider.name);

    await processPaymentWebhook(provider.completedEvent(), provider.name);

    const order = await db.order.findFirstOrThrow({
      include: { statusHistory: { orderBy: { createdAt: "asc" } } },
    });
    expect(order.status).toBe("PAID");
    expect(order.statusHistory.at(-1)?.note).toContain("Check stock");
    expect(await stockOf(variant.id)).toEqual({ onHand: 3, reserved: 0 });
  });
});

describe("abandoned checkouts", () => {
  it("releases reservations once they expire", async () => {
    const { store, variant } = await setUp();
    const cartToken = await cartWith(store.id, variant.id, 2);
    await checkout(store, cartToken, new FakePaymentProvider());
    await db.order.updateMany({
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    expect(await releaseExpiredReservations(store.id)).toBe(1);
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 0 });
  });

  it("releases stock when the shopper cancels on the payment page", async () => {
    const { store, variant } = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 1);
    await checkout(store, cartToken, provider);

    await cancelCheckout(store.id, provider.lastSession().sessionId, provider);

    expect(provider.expiredSessionIds).toHaveLength(1);
    expect((await db.order.findFirstOrThrow()).status).toBe("CANCELLED");
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 0 });
  });

  it("leaves the order alone if the session can't be expired because it was paid", async () => {
    const { store, variant } = await setUp();
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 1);
    await checkout(store, cartToken, provider);
    provider.failExpire = true;

    await cancelCheckout(store.id, provider.lastSession().sessionId, provider);

    expect((await db.order.findFirstOrThrow()).status).toBe("PENDING");
    expect(await stockOf(variant.id)).toEqual({ onHand: 5, reserved: 1 });
  });
});

describe("order access", () => {
  it("keeps orders inside their store and with their shopper", async () => {
    const { store, variant } = await setUp();
    const shopper = await createUser("Shopper");
    const stranger = await createUser("Stranger");
    const provider = new FakePaymentProvider();
    const cartToken = await cartWith(store.id, variant.id, 1);
    await checkout(store, cartToken, provider, { viewerUserId: shopper.id });
    await processPaymentWebhook(provider.completedEvent(), provider.name);
    const order = await db.order.findFirstOrThrow();

    const otherOwner = await createUser("Other owner");
    const otherStore = await createStore(
      otherOwner.id,
      storeInput({ slug: "other" }),
    );
    const otherContext = await contextFor(otherOwner.id, "other");

    expect(await listOrdersForShopper(store.id, shopper.id)).toHaveLength(1);
    expect(
      await getOrderForShopper(store.id, stranger.id, order.id),
    ).toBeNull();
    expect(await listOrdersForShopper(otherStore.id, shopper.id)).toHaveLength(
      0,
    );
    expect(
      await getOrderByCheckoutSession(
        otherStore.id,
        provider.lastSession().sessionId,
      ),
    ).toBeNull();
    await expect(
      getOrderForDashboard(otherContext, order.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("StripePaymentProvider.parseWebhook", () => {
  const webhookSecret = "whsec_test_secret";
  const provider = new StripePaymentProvider(
    "sk_test_not_used_for_parsing",
    webhookSecret,
  );
  const payload = JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        amount_total: 5420,
        currency: "cad",
        payment_status: "paid",
        payment_intent: "pi_1",
      },
    },
  });

  it("accepts a correctly signed event", async () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
    expect(await provider.parseWebhook(payload, signature)).toEqual({
      kind: "checkout_completed",
      eventId: "evt_1",
      sessionId: "cs_test_1",
      paymentId: "pi_1",
      amountCents: 5420,
      currency: "CAD",
      paid: true,
    });
  });

  it("rejects a missing, forged or tampered signature", async () => {
    const forged = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_attacker",
    });
    const genuine = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    await expect(provider.parseWebhook(payload, null)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(provider.parseWebhook(payload, forged)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(
      provider.parseWebhook(payload.replace("5420", "1"), genuine),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});
