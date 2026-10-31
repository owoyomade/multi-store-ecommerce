import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { RuleViolationError } from "@/server/errors";
import { addToCart } from "@/server/services/cart";
import { createProduct } from "@/server/services/catalog";
import {
  processPaymentWebhook,
  releaseExpiredReservations,
  startCheckout,
} from "@/server/services/checkout";
import {
  createDiscount,
  discountAmount,
  setDiscountActive,
} from "@/server/services/discounts";
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

async function shop() {
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
      slug: "mug",
      skuPrefix: "MUG",
      price: "50.00",
      initialStock: 20,
    }),
  );
  const variant = await db.productVariant.findFirstOrThrow({
    where: { productId: product.id },
  });
  return {
    owner,
    store: { id: store.id, slug: "shop", currency: "CAD" },
    context,
    variant,
  };
}

async function checkoutWith(
  store: { id: string; slug: string; currency: string },
  variantId: string,
  discountCode: string,
  provider = new FakePaymentProvider(),
) {
  const { newToken } = await addToCart(store.id, null, variantId, 1);
  await startCheckout({
    store,
    cartToken: newToken,
    viewerUserId: null,
    input: {
      email: `shopper-${crypto.randomUUID()}@example.test`,
      address,
      discountCode,
    },
    idempotencyKey: crypto.randomUUID(),
    storefrontUrl: "http://localhost:3210/s/shop",
    provider,
  });
  return provider;
}

describe("discountAmount", () => {
  it("rounds percentages down and never exceeds the subtotal", () => {
    expect(discountAmount({ kind: "PERCENT", value: 1500 }, 3333)).toBe(499);
    expect(discountAmount({ kind: "FIXED", value: 2000 }, 1500)).toBe(1500);
  });
});

describe("discount codes at checkout", () => {
  it("takes the discount off the order and the amount charged", async () => {
    const { store, context, variant } = await shop();
    await createDiscount(context, {
      code: "welcome10",
      kind: "PERCENT",
      amount: "10",
    });

    const provider = await checkoutWith(store, variant.id, "WELCOME10");

    const order = await db.order.findFirstOrThrow({
      include: { redemption: true },
    });
    expect(order).toMatchObject({
      subtotalCents: 5000,
      discountCents: 500,
      totalCents: 4500,
      discountCode: "WELCOME10",
    });
    expect(order.redemption?.amountCents).toBe(500);
    expect(provider.lastSession().discount).toEqual({
      label: "WELCOME10",
      amountCents: 500,
    });
    expect(
      await processPaymentWebhook(provider.completedEvent(), provider.name),
    ).toBe("processed");
    expect((await db.order.findFirstOrThrow()).status).toBe("PAID");
  });

  it("is case-insensitive but only works in its own store", async () => {
    const { store, context, variant } = await shop();
    await createDiscount(context, {
      code: "SAVE5",
      kind: "FIXED",
      amount: "5",
    });
    const otherOwner = await createUser("Other");
    const other = await createStore(
      otherOwner.id,
      storeInput({ slug: "other" }),
    );
    const otherContext = await contextFor(otherOwner.id, "other");
    const otherProduct = await createProduct(
      otherContext,
      productInput({ slug: "other-mug", skuPrefix: "OTHER" }),
    );
    const otherVariant = await db.productVariant.findFirstOrThrow({
      where: { productId: otherProduct.id },
    });

    await checkoutWith(store, variant.id, "save5");
    await expect(
      checkoutWith(
        { id: other.id, slug: "other", currency: "CAD" },
        otherVariant.id,
        "SAVE5",
      ),
    ).rejects.toThrow("We don't recognise that code.");
  });

  it("stops exactly at its usage limit, even when shoppers race for the last use", async () => {
    const { store, context, variant } = await shop();
    await createDiscount(context, {
      code: "LAST2",
      kind: "FIXED",
      amount: "5",
      usageLimit: "2",
    });

    await checkoutWith(store, variant.id, "LAST2");
    const results = await Promise.allSettled([
      checkoutWith(store, variant.id, "LAST2"),
      checkoutWith(store, variant.id, "LAST2"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const discount = await db.discount.findFirstOrThrow();
    expect(discount.usageCount).toBe(2);
    expect(await db.discountRedemption.count()).toBe(2);
    await expect(checkoutWith(store, variant.id, "LAST2")).rejects.toThrow(
      "used up",
    );
  });

  it("gives the use back when the checkout is abandoned", async () => {
    const { store, context, variant } = await shop();
    await createDiscount(context, {
      code: "ONCE",
      kind: "FIXED",
      amount: "5",
      usageLimit: "1",
    });
    await checkoutWith(store, variant.id, "ONCE");
    await db.order.updateMany({
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    await releaseExpiredReservations(store.id);

    expect((await db.discount.findFirstOrThrow()).usageCount).toBe(0);
    await expect(
      checkoutWith(store, variant.id, "ONCE"),
    ).resolves.toBeDefined();
  });

  it("explains why a code can't be used", async () => {
    const { store, context, variant } = await shop();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await createDiscount(context, {
      code: "SOON",
      kind: "PERCENT",
      amount: "10",
      startsAt: tomorrow,
    });
    await createDiscount(context, {
      code: "OVER",
      kind: "PERCENT",
      amount: "10",
      endsAt: yesterday,
    });
    await createDiscount(context, {
      code: "BIGSPEND",
      kind: "PERCENT",
      amount: "10",
      minSubtotal: "100",
    });
    const paused = await createDiscount(context, {
      code: "PAUSED",
      kind: "PERCENT",
      amount: "10",
    });
    await setDiscountActive(context, paused.id, false);

    await expect(checkoutWith(store, variant.id, "SOON")).rejects.toThrow(
      "isn't active yet",
    );
    await expect(checkoutWith(store, variant.id, "OVER")).rejects.toThrow(
      "expired",
    );
    await expect(checkoutWith(store, variant.id, "BIGSPEND")).rejects.toThrow(
      "Spend $100.00 or more",
    );
    await expect(checkoutWith(store, variant.id, "PAUSED")).rejects.toThrow(
      "don't recognise",
    );
  });
});

describe("managing discounts", () => {
  it("rejects bad input and duplicate codes", async () => {
    const { context } = await shop();
    await expect(
      createDiscount(context, { code: "BAD", kind: "PERCENT", amount: "150" }),
    ).rejects.toThrow();
    await expect(
      createDiscount(context, {
        code: "DATES",
        kind: "FIXED",
        amount: "5",
        startsAt: "2026-12-10",
        endsAt: "2026-12-01",
      }),
    ).rejects.toThrow();
    await createDiscount(context, { code: "DUPE", kind: "FIXED", amount: "5" });
    await expect(
      createDiscount(context, { code: "dupe", kind: "FIXED", amount: "5" }),
    ).rejects.toThrow("already have");
  });

  it("is refused for roles without discount access", async () => {
    const { store, context } = await shop();
    const agent = await createUser("Agent");
    await addMember(store.id, agent.id, "FULFILLMENT_AGENT");
    const agentContext = await contextFor(agent.id, "shop");
    await expect(
      createDiscount(agentContext, {
        code: "NOPE",
        kind: "FIXED",
        amount: "5",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(context.role).toBe("OWNER");
  });
});

it("treats an unknown code as a shopper-facing error", async () => {
  const { store, variant } = await shop();
  await expect(
    checkoutWith(store, variant.id, "NOSUCH"),
  ).rejects.toBeInstanceOf(RuleViolationError);
});
