import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, RuleViolationError } from "@/server/errors";
import {
  addToCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/server/services/cart";
import {
  createCollection,
  createProduct,
  setProductCollections,
  updateVariants,
} from "@/server/services/catalog";
import {
  getPublicProduct,
  getVisibleStore,
  listPublicProducts,
} from "@/server/services/storefront";
import { createStore } from "@/server/services/stores";
import {
  contextFor,
  createUser,
  productInput,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

async function liveStoreWithProducts() {
  const owner = await createUser("Owner");
  const store = await createStore(owner.id, storeInput({ slug: "shop" }));
  await db.store.update({
    where: { id: store.id },
    data: { status: "ACTIVE" },
  });
  const context = await contextFor(owner.id, "shop");

  const mug = await createProduct(
    context,
    productInput({
      title: "Blue Mug",
      slug: "blue-mug",
      skuPrefix: "MUG",
      price: "15",
    }),
  );
  const tee = await createProduct(
    context,
    productInput({
      title: "Classic Tee",
      slug: "tee",
      skuPrefix: "TEE",
      price: "30",
    }),
  );
  const draft = await createProduct(
    context,
    productInput({
      title: "Secret Hoodie",
      slug: "hoodie",
      skuPrefix: "HOOD",
      status: "DRAFT",
    }),
  );
  const soldOut = await createProduct(
    context,
    productInput({
      title: "Rare Poster",
      slug: "poster",
      skuPrefix: "POST",
      price: "50",
      initialStock: 0,
    }),
  );
  return { owner, store, context, mug, tee, draft, soldOut };
}

async function firstVariantId(productId: string) {
  return (await db.productVariant.findFirstOrThrow({ where: { productId } }))
    .id;
}

describe("storefront visibility", () => {
  it("never lists or shows draft products", async () => {
    const { store } = await liveStoreWithProducts();
    const listing = await listPublicProducts(store.id, {});
    expect(listing.products.map((product) => product.title)).not.toContain(
      "Secret Hoodie",
    );
    expect(await getPublicProduct(store.id, "hoodie")).toBeNull();
  });

  it("hides draft stores from shoppers but shows a preview to their staff", async () => {
    const owner = await createUser("Owner");
    const stranger = await createUser("Stranger");
    await createStore(owner.id, storeInput({ slug: "draft-shop" }));

    expect(await getVisibleStore("draft-shop", null)).toBeNull();
    expect(await getVisibleStore("draft-shop", stranger.id)).toBeNull();
    expect(await getVisibleStore("draft-shop", owner.id)).toMatchObject({
      isPreview: true,
    });
  });

  it("doesn't show one store's products in another store", async () => {
    const { store } = await liveStoreWithProducts();
    const otherOwner = await createUser("Other");
    const other = await createStore(
      otherOwner.id,
      storeInput({ slug: "other" }),
    );

    expect(await getPublicProduct(other.id, "blue-mug")).toBeNull();
    expect((await listPublicProducts(other.id, {})).total).toBe(0);
    expect((await listPublicProducts(store.id, {})).total).toBe(3);
  });
});

describe("listPublicProducts", () => {
  it("searches, filters by price and stock, and sorts by lowest price", async () => {
    const { store } = await liveStoreWithProducts();

    const byPrice = await listPublicProducts(store.id, { sort: "price-asc" });
    expect(byPrice.products.map((product) => product.title)).toEqual([
      "Blue Mug",
      "Classic Tee",
      "Rare Poster",
    ]);

    const search = await listPublicProducts(store.id, { search: "mug" });
    expect(search.products.map((product) => product.title)).toEqual([
      "Blue Mug",
    ]);

    const range = await listPublicProducts(store.id, {
      minPriceCents: 2000,
      maxPriceCents: 4000,
    });
    expect(range.products.map((product) => product.title)).toEqual([
      "Classic Tee",
    ]);

    const inStock = await listPublicProducts(store.id, { inStockOnly: true });
    expect(inStock.products.map((product) => product.title)).not.toContain(
      "Rare Poster",
    );
  });

  it("treats % in a search as a literal character", async () => {
    const { store } = await liveStoreWithProducts();
    expect((await listPublicProducts(store.id, { search: "%" })).total).toBe(0);
  });

  it("filters by collection", async () => {
    const { store, context, mug } = await liveStoreWithProducts();
    const collection = await createCollection(context, {
      title: "Kitchen",
      slug: "kitchen",
    });
    await setProductCollections(context, mug.id, [collection.id]);

    const listing = await listPublicProducts(store.id, {
      collectionSlug: "kitchen",
    });
    expect(listing.products.map((product) => product.title)).toEqual([
      "Blue Mug",
    ]);
  });
});

describe("cart", () => {
  it("creates a cart on first add and prices it from the live catalog", async () => {
    const { store, context, mug } = await liveStoreWithProducts();
    const variantId = await firstVariantId(mug.id);

    const { newToken } = await addToCart(store.id, null, variantId, 2);
    expect(newToken).toBeTruthy();
    expect((await getCart(store.id, newToken)).subtotalCents).toBe(3000);

    // The merchant changes the price: the cart follows, because it stores no prices.
    await updateVariants(context, mug.id, [
      {
        id: variantId,
        sku: "MUG",
        price: "12",
        compareAtPrice: "",
        stock: 10,
        trackInventory: true,
      },
    ]);
    expect((await getCart(store.id, newToken)).subtotalCents).toBe(2400);
  });

  it("refuses draft products and products from another store", async () => {
    const { store, draft } = await liveStoreWithProducts();
    const otherOwner = await createUser("Other");
    await createStore(otherOwner.id, storeInput({ slug: "other" }));
    const otherContext = await contextFor(otherOwner.id, "other");
    const foreign = await createProduct(
      otherContext,
      productInput({ skuPrefix: "FOREIGN" }),
    );

    await expect(
      addToCart(store.id, null, await firstVariantId(draft.id), 1),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      addToCart(store.id, null, await firstVariantId(foreign.id), 1),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("won't add more than is in stock", async () => {
    const { store, mug, soldOut } = await liveStoreWithProducts();
    await expect(
      addToCart(store.id, null, await firstVariantId(soldOut.id), 1),
    ).rejects.toThrow("sold out");
    await expect(
      addToCart(store.id, null, await firstVariantId(mug.id), 11),
    ).rejects.toBeInstanceOf(Error);

    const { newToken } = await addToCart(
      store.id,
      null,
      await firstVariantId(mug.id),
      8,
    );
    await expect(
      addToCart(store.id, newToken, await firstVariantId(mug.id), 3),
    ).rejects.toBeInstanceOf(RuleViolationError);
  });

  it("ignores a cart token from a different store", async () => {
    const { store, mug } = await liveStoreWithProducts();
    const { newToken } = await addToCart(
      store.id,
      null,
      await firstVariantId(mug.id),
      1,
    );
    const otherOwner = await createUser("Other");
    const other = await createStore(
      otherOwner.id,
      storeInput({ slug: "other" }),
    );

    expect((await getCart(other.id, newToken)).lines).toEqual([]);
  });

  it("only lets a shopper change or remove lines in their own cart", async () => {
    const { store, mug, tee } = await liveStoreWithProducts();
    const shopperA = await addToCart(
      store.id,
      null,
      await firstVariantId(mug.id),
      1,
    );
    const shopperB = await addToCart(
      store.id,
      null,
      await firstVariantId(tee.id),
      1,
    );
    const lineB = (await getCart(store.id, shopperB.newToken)).lines[0];
    if (!lineB) throw new Error("expected a line in shopper B's cart");

    await expect(
      updateCartItemQuantity(store.id, shopperA.newToken, lineB.id, 5),
    ).rejects.toBeInstanceOf(NotFoundError);
    await removeCartItem(store.id, shopperA.newToken, lineB.id);
    expect((await getCart(store.id, shopperB.newToken)).lines).toHaveLength(1);
  });
});
