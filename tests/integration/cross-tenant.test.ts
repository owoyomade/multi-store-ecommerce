// One place that checks every kind of store data against the same attack:
// a signed-in owner of store B who knows (or guesses) the IDs of store A's
// records. Each check must find nothing, change nothing, or be refused.
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, RuleViolationError } from "@/server/errors";
import { addToCart } from "@/server/services/cart";
import {
  addProductImage,
  createCollection,
  createProduct,
  deleteCollection,
  deleteProductImage,
  getProductForEdit,
  listCollections,
  listProductsForDashboard,
  updateCollection,
} from "@/server/services/catalog";
import {
  processPaymentWebhook,
  startCheckout,
} from "@/server/services/checkout";
import {
  createDiscount,
  findUsableDiscount,
  listDiscounts,
  setDiscountActive,
} from "@/server/services/discounts";
import {
  deleteAddressForShopper,
  getOrderByCheckoutSession,
  getOrderForDashboard,
  getOrderForShopper,
  listAddressesForShopper,
  listOrders,
  listOrdersForShopper,
} from "@/server/services/orders";
import {
  exportOrdersCsv,
  getStoreMetrics,
  listActivity,
} from "@/server/services/reports";
import { listStaff } from "@/server/services/staff";
import { listStock } from "@/server/services/stock-control";
import { createStore } from "@/server/services/stores";
import type { StoreContext } from "@/server/tenancy/store-context";
import { FakePaymentProvider } from "../support/fake-payment-provider";
import {
  contextFor,
  createUser,
  productInput,
  resetDatabase,
  storeInput,
} from "../support/factories";

type World = Awaited<ReturnType<typeof buildWorld>>;
let world: World;

/** Store A with one of everything, and an empty store B owned by someone else. */
async function buildWorld() {
  const ownerA = await createUser("Alice");
  const ownerB = await createUser("Bob");
  const shopper = await createUser("Shopper");
  const storeA = await createStore(ownerA.id, storeInput({ slug: "alpha" }));
  const storeB = await createStore(ownerB.id, storeInput({ slug: "beta" }));
  const contextA = await contextFor(ownerA.id, "alpha");
  const contextB = await contextFor(ownerB.id, "beta");

  const product = await createProduct(
    contextA,
    productInput({ title: "Alpha Mug", slug: "alpha-mug", skuPrefix: "AM" }),
  );
  const image = await addProductImage(contextA, product.id, {
    bytes: await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer(),
    altText: "Mug",
  });
  const collection = await createCollection(contextA, {
    title: "Mugs",
    slug: "mugs",
    description: "",
  });
  const discount = await createDiscount(contextA, {
    code: "ALPHA10",
    kind: "PERCENT",
    amount: "10",
  });

  // A signed-in shopper buys from store A and saves their address there.
  const variant = await db.productVariant.findFirstOrThrow({
    where: { productId: product.id },
  });
  const provider = new FakePaymentProvider();
  const { newToken } = await addToCart(storeA.id, null, variant.id, 1);
  await startCheckout({
    store: { id: storeA.id, slug: "alpha", currency: "CAD" },
    cartToken: newToken,
    viewerUserId: shopper.id,
    input: {
      email: "shopper@example.test",
      saveAddress: true,
      address: {
        name: "Sam Shopper",
        line1: "1 King St",
        city: "Toronto",
        postalCode: "M5H 1A1",
        country: "CA",
      },
    },
    idempotencyKey: crypto.randomUUID(),
    storefrontUrl: "http://localhost:3210/s/alpha",
    provider,
  });
  await processPaymentWebhook(provider.completedEvent(), provider.name);
  const order = await db.order.findFirstOrThrow({
    where: { storeId: storeA.id },
  });
  const address = await db.address.findFirstOrThrow({
    where: { storeId: storeA.id },
  });
  const payment = await db.payment.findFirstOrThrow({
    where: { orderId: order.id },
  });

  return {
    storeA,
    storeB,
    contextA,
    contextB,
    shopper,
    product,
    image,
    collection,
    discount,
    order,
    address,
    payment,
    variant,
  };
}

beforeAll(async () => {
  await resetDatabase();
  world = await buildWorld();
});

const asB = (): StoreContext => world.contextB;

describe("store B can't reach store A's products", () => {
  it("doesn't list or open them", async () => {
    const listing = await listProductsForDashboard(asB(), {});
    expect(listing.products).toEqual([]);
    await expect(getProductForEdit(asB(), world.product.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("can't delete their images", async () => {
    await expect(deleteProductImage(asB(), world.image.id)).rejects.toThrow(
      NotFoundError,
    );
    expect(
      await db.productImage.findUnique({ where: { id: world.image.id } }),
    ).not.toBeNull();
  });

  it("stores uploads under the owning store's own folder", () => {
    expect(world.image.storageKey).toMatch(
      new RegExp(`^stores/${world.storeA.id}/products/`),
    );
  });

  it("can't list, rename or delete their collections", async () => {
    expect(await listCollections(asB())).toEqual([]);
    await expect(
      updateCollection(asB(), world.collection.id, {
        title: "Taken",
        slug: "taken",
        description: "",
      }),
    ).rejects.toThrow(NotFoundError);
    await expect(deleteCollection(asB(), world.collection.id)).rejects.toThrow(
      NotFoundError,
    );
    expect(
      await db.collection.findUniqueOrThrow({
        where: { id: world.collection.id },
      }),
    ).toMatchObject({ title: "Mugs" });
  });

  it("doesn't see their stock", async () => {
    expect(await listStock(asB())).toEqual([]);
  });
});

describe("store B can't reach store A's orders and customers", () => {
  it("doesn't list or open orders", async () => {
    expect((await listOrders(asB(), {})).orders).toEqual([]);
    await expect(getOrderForDashboard(asB(), world.order.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("can't find an order by a payment session from another store", async () => {
    expect(
      await getOrderByCheckoutSession(
        world.storeB.id,
        world.payment.providerSessionId ?? "",
      ),
    ).toBeNull();
  });

  it("shows a shopper only their orders and addresses in the store they're in", async () => {
    const { storeB, shopper, order, address } = world;
    expect(await listOrdersForShopper(storeB.id, shopper.id)).toEqual([]);
    expect(
      await getOrderForShopper(storeB.id, shopper.id, order.id),
    ).toBeNull();
    expect(await listAddressesForShopper(storeB.id, shopper.id)).toEqual([]);

    await deleteAddressForShopper(storeB.id, shopper.id, address.id);
    expect(
      await db.address.findUnique({ where: { id: address.id } }),
    ).not.toBeNull();
  });

  it("won't show one shopper's order to another signed-in shopper", async () => {
    const stranger = await createUser("Stranger");
    expect(
      await getOrderForShopper(world.storeA.id, stranger.id, world.order.id),
    ).toBeNull();
  });
});

describe("store B can't reach store A's discounts", () => {
  it("doesn't list or pause them", async () => {
    expect(await listDiscounts(asB())).toEqual([]);
    await expect(
      setDiscountActive(asB(), world.discount.id, false),
    ).rejects.toThrow(NotFoundError);
    expect(
      (
        await db.discount.findUniqueOrThrow({
          where: { id: world.discount.id },
        })
      ).active,
    ).toBe(true);
  });

  it("doesn't accept store A's code at store B's checkout", async () => {
    await expect(
      findUsableDiscount(world.storeB.id, "ALPHA10", 5000, "CAD"),
    ).rejects.toThrow(RuleViolationError);
  });
});

describe("store B can't reach store A's reports or team", () => {
  it("reports only its own sales", async () => {
    expect((await getStoreMetrics(asB())).orderCount).toBe(0);
    expect((await getStoreMetrics(world.contextA)).orderCount).toBe(1);
  });

  it("exports only its own orders", async () => {
    const csv = await exportOrdersCsv(asB(), {
      from: new Date(0),
      to: new Date(Date.now() + 86_400_000),
    });
    expect(csv).not.toContain("shopper@example.test");
  });

  it("shows only its own activity", async () => {
    const { entries } = await listActivity(asB());
    const storeAEntityIds = new Set([
      world.product.id,
      world.discount.id,
      world.order.id,
    ]);
    expect(entries.some((entry) => storeAEntityIds.has(entry.entityId))).toBe(
      false,
    );
  });

  it("lists only its own team", async () => {
    const { members } = await listStaff(asB());
    expect(members.map((member) => member.user.name)).toEqual(["Bob"]);
  });
});
