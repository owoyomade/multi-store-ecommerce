import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  FieldConflictError,
  NotFoundError,
  RuleViolationError,
} from "@/server/errors";
import {
  addProductImage,
  createCollection,
  createProduct,
  getProductForEdit,
  setProductCollections,
  updateProductDetails,
  updateVariants,
} from "@/server/services/catalog";
import { createStore } from "@/server/services/stores";
import { storage } from "@/server/storage/storage";
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

async function twoStoresWithOwners() {
  const alice = await createUser("Alice");
  const bob = await createUser("Bob");
  await createStore(alice.id, storeInput({ slug: "store-a" }));
  await createStore(bob.id, storeInput({ slug: "store-b" }));
  return {
    alice,
    bob,
    contextA: await contextFor(alice.id, "store-a"),
    contextB: await contextFor(bob.id, "store-b"),
  };
}

function pngBytes(width = 64, height = 48) {
  return sharp({
    create: { width, height, channels: 3, background: "#cc5500" },
  })
    .png()
    .toBuffer();
}

describe("createProduct", () => {
  it("creates one variant per option combination, with stock in the ledger", async () => {
    const { contextA } = await twoStoresWithOwners();
    const product = await createProduct(
      contextA,
      productInput({
        option1Name: "Size",
        option1Values: "S, M",
        option2Name: "Colour",
        option2Values: "Black, White",
      }),
    );

    const loaded = await getProductForEdit(contextA, product.id);
    expect(loaded.variants.map((variant) => variant.title)).toEqual([
      "S / Black",
      "S / White",
      "M / Black",
      "M / White",
    ]);
    expect(loaded.variants.map((variant) => variant.sku)).toContain(
      "TEE-S-BLACK",
    );
    expect(
      loaded.variants.every(
        (variant) => variant.inventoryLevels[0]?.onHand === 10,
      ),
    ).toBe(true);
    expect(
      await db.inventoryMovement.count({
        where: { reason: "INITIAL_STOCK", delta: 10 },
      }),
    ).toBe(4);
  });

  it("lets two stores use the same product URL, but not one store twice", async () => {
    const { contextA, contextB } = await twoStoresWithOwners();
    await createProduct(contextA, productInput());
    await expect(
      createProduct(contextB, productInput()),
    ).resolves.toBeDefined();
    await expect(
      createProduct(contextA, productInput({ skuPrefix: "OTHER" })),
    ).rejects.toBeInstanceOf(FieldConflictError);
  });

  it("is refused for roles without catalog access", async () => {
    const { contextA } = await twoStoresWithOwners();
    const agent = await createUser("Agent");
    await addMember(contextA.storeId, agent.id, "FULFILLMENT_AGENT");
    const agentContext = await contextFor(agent.id, "store-a");
    await expect(
      createProduct(agentContext, productInput()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("catalog tenant isolation", () => {
  it("can't read or edit another store's product by its ID", async () => {
    const { contextA, contextB } = await twoStoresWithOwners();
    const productB = await createProduct(
      contextB,
      productInput({ title: "Bob's Tee" }),
    );

    await expect(
      getProductForEdit(contextA, productB.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateProductDetails(contextA, productB.id, {
        title: "Hacked",
        slug: "hacked",
        status: "DRAFT",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const unchanged = await db.product.findUniqueOrThrow({
      where: { id: productB.id },
    });
    expect(unchanged.title).toBe("Bob's Tee");
  });

  it("can't change another store's variant by sneaking its ID into the variants form", async () => {
    const { contextA, contextB } = await twoStoresWithOwners();
    const productA = await createProduct(contextA, productInput());
    const productB = await createProduct(contextB, productInput());
    const variantB = await db.productVariant.findFirstOrThrow({
      where: { productId: productB.id },
    });

    await expect(
      updateVariants(contextA, productA.id, [
        {
          id: variantB.id,
          sku: "STOLEN",
          price: "1.00",
          compareAtPrice: "",
          stock: 0,
          trackInventory: true,
        },
      ]),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(
      (
        await db.productVariant.findUniqueOrThrow({
          where: { id: variantB.id },
        })
      ).priceCents,
    ).toBe(2500);
  });

  it("can't attach another store's collection to a product", async () => {
    const { contextA, contextB } = await twoStoresWithOwners();
    const productA = await createProduct(contextA, productInput());
    const collectionB = await createCollection(contextB, {
      title: "Sale",
      slug: "sale",
    });

    await expect(
      setProductCollections(contextA, productA.id, [collectionB.id]),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("can't upload an image to another store's product", async () => {
    const { contextA, contextB } = await twoStoresWithOwners();
    const productB = await createProduct(contextB, productInput());
    await expect(
      addProductImage(contextA, productB.id, {
        bytes: await pngBytes(),
        altText: "",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateVariants", () => {
  it("records stock changes as ledger adjustments", async () => {
    const { contextA } = await twoStoresWithOwners();
    const product = await createProduct(contextA, productInput());
    const variant = await db.productVariant.findFirstOrThrow({
      where: { productId: product.id },
    });

    await updateVariants(contextA, product.id, [
      {
        id: variant.id,
        sku: "TEE",
        price: "30",
        compareAtPrice: "40",
        stock: 4,
        trackInventory: true,
      },
    ]);

    const updated = await getProductForEdit(contextA, product.id);
    expect(updated.variants[0]).toMatchObject({
      priceCents: 3000,
      compareAtPriceCents: 4000,
    });
    expect(updated.variants[0]?.inventoryLevels[0]?.onHand).toBe(4);
    const adjustment = await db.inventoryMovement.findFirstOrThrow({
      where: { reason: "ADJUSTMENT" },
    });
    expect(adjustment.delta).toBe(-6);
  });
});

describe("addProductImage", () => {
  it("stores a valid upload as WebP under the store's folder", async () => {
    const { contextA } = await twoStoresWithOwners();
    const product = await createProduct(contextA, productInput());

    const image = await addProductImage(contextA, product.id, {
      bytes: await pngBytes(),
      altText: "Front",
    });

    expect(image.storageKey).toMatch(
      new RegExp(`^stores/${contextA.storeId}/products/[a-f0-9-]+\\.webp$`),
    );
    const saved = await storage.get(image.storageKey);
    expect((await sharp(saved ?? Buffer.alloc(0)).metadata()).format).toBe(
      "webp",
    );
  });

  it("rejects a file that only pretends to be an image", async () => {
    const { contextA } = await twoStoresWithOwners();
    const product = await createProduct(contextA, productInput());
    const fakeImage = Buffer.from("<html><script>alert('xss')</script></html>");

    await expect(
      addProductImage(contextA, product.id, { bytes: fakeImage, altText: "" }),
    ).rejects.toBeInstanceOf(RuleViolationError);
    expect(await db.productImage.count()).toBe(0);
  });

  it("rejects SVG, which can contain scripts", async () => {
    const { contextA } = await twoStoresWithOwners();
    const product = await createProduct(contextA, productInput());
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );

    await expect(
      addProductImage(contextA, product.id, { bytes: svg, altText: "" }),
    ).rejects.toThrow("Upload a JPEG, PNG, WebP or AVIF image.");
  });

  it("rejects files over 5 MB before decoding them", async () => {
    const { contextA } = await twoStoresWithOwners();
    const product = await createProduct(contextA, productInput());
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);

    await expect(
      addProductImage(contextA, product.id, { bytes: oversized, altText: "" }),
    ).rejects.toThrow("Images must be 5 MB or smaller.");
  });
});
