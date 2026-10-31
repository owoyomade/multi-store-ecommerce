import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type ProductStatus } from "@/generated/prisma/client";
import {
  collectionSchema,
  createProductSchema,
  productDetailsSchema,
  variantRowSchema,
  type CollectionInput,
  type CreateProductInput,
  type ProductDetailsInput,
  type VariantRowInput,
} from "@/lib/validation/catalog";
import { db } from "../db";
import { FieldConflictError, NotFoundError } from "../errors";
import { processUploadedImage } from "../storage/images";
import { storage } from "../storage/storage";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";
import { availableToSell, setOnHandStock } from "./inventory";

const DASHBOARD_PAGE_SIZE = 20;
export const MAX_IMAGES_PER_PRODUCT = 8;

/**
 * If `error` is a unique-constraint violation, returns the name of the
 * database constraint that failed (e.g. "products_storeId_slug_key") so the
 * caller can tell which field clashed. Returns null for any other error.
 *
 * With Prisma's Postgres driver adapter the constraint name lives under
 * meta.driverAdapterError; older setups put the column list in meta.target.
 */
function uniqueViolation(error: unknown): string | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  )
    return null;
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: string } } };
      }
    | undefined;
  return (
    meta?.driverAdapterError?.cause?.constraint?.index ??
    String(meta?.target ?? "")
  );
}

/**
 * Loads a product only if it belongs to the caller's store. Every function
 * below that receives a product ID from the browser goes through this, so
 * editing an ID in the URL to another store's product just gives "not found".
 */
async function findOwnedProduct(context: StoreContext, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, storeId: context.storeId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Product");
  return product;
}

/**
 * Every combination of the option values, in a stable order.
 * [["S","M"], ["Black","White"]] → [["S","Black"], ["S","White"], ["M","Black"], ["M","White"]]
 */
export function combineOptionValues(valueLists: string[][]): string[][] {
  return valueLists.reduce<string[][]>(
    (combinations, values) =>
      combinations.flatMap((combo) => values.map((value) => [...combo, value])),
    [[]],
  );
}

function skuFor(prefix: string, optionValues: string[]): string {
  const suffix = optionValues.map((value) =>
    value.toUpperCase().replace(/[^A-Z0-9]+/g, ""),
  );
  return [prefix, ...suffix].filter(Boolean).join("-");
}

export async function listProductsForDashboard(
  context: StoreContext,
  filters: { status?: ProductStatus; search?: string; page?: number },
) {
  requirePermission(context, "store:view");
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.ProductWhereInput = {
    storeId: context.storeId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * DASHBOARD_PAGE_SIZE,
      take: DASHBOARD_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { storageKey: true, altText: true },
        },
        variants: {
          where: { archivedAt: null },
          select: {
            priceCents: true,
            trackInventory: true,
            inventoryLevels: { select: { onHand: true, reserved: true } },
          },
        },
      },
    }),
    db.product.count({ where }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE)),
    products: products.map(({ variants, images, ...product }) => {
      const prices = variants.map((variant) => variant.priceCents);
      const stock = variants.reduce((sum, variant) => {
        const available = availableToSell(variant, variant.inventoryLevels);
        return Number.isFinite(available) ? sum + available : sum;
      }, 0);
      return {
        ...product,
        image: images[0] ?? null,
        variantCount: variants.length,
        minPriceCents: prices.length ? Math.min(...prices) : null,
        hasPriceRange: new Set(prices).size > 1,
        tracksStock: variants.some((variant) => variant.trackInventory),
        stock,
      };
    }),
  };
}

export async function getProductForEdit(
  context: StoreContext,
  productId: string,
) {
  requirePermission(context, "store:view");
  const product = await db.product.findFirst({
    where: { id: productId, storeId: context.storeId, deletedAt: null },
    include: {
      options: { orderBy: { position: "asc" } },
      variants: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        include: {
          inventoryLevels: { select: { onHand: true, reserved: true } },
        },
      },
      images: { orderBy: { position: "asc" } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!product) throw new NotFoundError("Product");
  return product;
}

/**
 * Creates a product with its options and one variant per option combination.
 * Every variant starts with the same price and stock; the merchant fine-tunes
 * them afterwards in the variants table.
 */
export async function createProduct(
  context: StoreContext,
  input: CreateProductInput,
) {
  requirePermission(context, "catalog:edit");
  const data = createProductSchema.parse(input);

  const options = [
    { name: data.option1Name, values: data.option1Values },
    { name: data.option2Name, values: data.option2Values },
  ].filter((option) => option.name && option.values.length > 0);

  const combinations = options.length
    ? combineOptionValues(options.map((option) => option.values))
    : [[]];

  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId: context.storeId,
          title: data.title,
          slug: data.slug,
          description: data.description,
          status: data.status,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          options: {
            create: options.map((option, index) => ({
              storeId: context.storeId,
              name: option.name,
              values: option.values,
              position: index,
            })),
          },
        },
        select: { id: true },
      });

      for (const [position, optionValues] of combinations.entries()) {
        const variant = await tx.productVariant.create({
          data: {
            storeId: context.storeId,
            productId: product.id,
            title: optionValues.length ? optionValues.join(" / ") : "Default",
            optionValues,
            sku: skuFor(data.skuPrefix, optionValues),
            priceCents: data.price,
            compareAtPriceCents: data.compareAtPrice,
            trackInventory: data.trackInventory,
            position,
          },
          select: { id: true },
        });
        await setOnHandStock(tx, {
          storeId: context.storeId,
          variantId: variant.id,
          onHand: data.initialStock,
          reason: "INITIAL_STOCK",
          actorUserId: context.userId,
        });
      }

      await recordAudit(tx, {
        storeId: context.storeId,
        actorUserId: context.userId,
        action: "product.created",
        entityType: "product",
        entityId: product.id,
        metadata: { variantCount: combinations.length },
      });
      return product;
    });
  } catch (error) {
    const constraint = uniqueViolation(error);
    if (constraint?.includes("slug")) {
      throw new FieldConflictError(
        "slug",
        "Another product in this store already uses this URL",
      );
    }
    if (constraint?.includes("sku")) {
      throw new FieldConflictError(
        "skuPrefix",
        "One of the generated SKUs is already used in this store",
      );
    }
    throw error;
  }
}

export async function updateProductDetails(
  context: StoreContext,
  productId: string,
  input: ProductDetailsInput,
) {
  requirePermission(context, "catalog:edit");
  const data = productDetailsSchema.parse(input);
  await findOwnedProduct(context, productId);

  try {
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          ...data,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        },
      });
      await recordAudit(tx, {
        storeId: context.storeId,
        actorUserId: context.userId,
        action: "product.updated",
        entityType: "product",
        entityId: productId,
        metadata: { status: data.status },
      });
    });
  } catch (error) {
    if (uniqueViolation(error)?.includes("slug")) {
      throw new FieldConflictError(
        "slug",
        "Another product in this store already uses this URL",
      );
    }
    throw error;
  }
}

/**
 * Saves the variants table: price, compare-at price, SKU, stock and tracking
 * for each row. Stock changes are written to the inventory ledger.
 */
export async function updateVariants(
  context: StoreContext,
  productId: string,
  rows: VariantRowInput[],
) {
  requirePermission(context, "catalog:edit");
  const parsedRows = rows.map((row) => variantRowSchema.parse(row));
  await findOwnedProduct(context, productId);

  // Only variants of this product (and therefore this store) may be touched,
  // even if the browser sends other IDs.
  const ownedVariantIds = new Set(
    (
      await db.productVariant.findMany({
        where: { productId, storeId: context.storeId, archivedAt: null },
        select: { id: true },
      })
    ).map((variant) => variant.id),
  );
  if (parsedRows.some((row) => !ownedVariantIds.has(row.id))) {
    throw new NotFoundError("Variant");
  }

  try {
    await db.$transaction(async (tx) => {
      for (const row of parsedRows) {
        await tx.productVariant.update({
          where: { id: row.id },
          data: {
            sku: row.sku,
            priceCents: row.price,
            compareAtPriceCents: row.compareAtPrice,
            trackInventory: row.trackInventory,
          },
        });
        await setOnHandStock(tx, {
          storeId: context.storeId,
          variantId: row.id,
          onHand: row.stock,
          reason: "ADJUSTMENT",
          actorUserId: context.userId,
        });
      }
      await recordAudit(tx, {
        storeId: context.storeId,
        actorUserId: context.userId,
        action: "product.variants_updated",
        entityType: "product",
        entityId: productId,
        metadata: { variantCount: parsedRows.length },
      });
    });
  } catch (error) {
    if (uniqueViolation(error)?.includes("sku")) {
      throw new FieldConflictError(
        "sku",
        "Each SKU must be unique within the store",
      );
    }
    throw error;
  }
}

export async function addProductImage(
  context: StoreContext,
  productId: string,
  upload: { bytes: Buffer; altText: string },
) {
  requirePermission(context, "catalog:edit");
  await findOwnedProduct(context, productId);

  const imageCount = await db.productImage.count({ where: { productId } });
  if (imageCount >= MAX_IMAGES_PER_PRODUCT) {
    throw new FieldConflictError(
      "image",
      `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`,
    );
  }

  const image = await processUploadedImage(upload.bytes);
  // The key is generated here, never taken from the upload's file name.
  const storageKey = `stores/${context.storeId}/products/${randomUUID()}.webp`;
  await storage.put(storageKey, image.data);

  try {
    return await db.productImage.create({
      data: {
        storeId: context.storeId,
        productId,
        storageKey,
        altText: upload.altText.trim().slice(0, 200),
        width: image.width,
        height: image.height,
        position: imageCount,
      },
      select: { id: true, storageKey: true },
    });
  } catch (error) {
    // Don't leave an orphaned file behind if the database write fails.
    await storage.delete(storageKey);
    throw error;
  }
}

export async function deleteProductImage(
  context: StoreContext,
  imageId: string,
) {
  requirePermission(context, "catalog:edit");
  const image = await db.productImage.findFirst({
    where: { id: imageId, storeId: context.storeId },
    select: { id: true, storageKey: true },
  });
  if (!image) throw new NotFoundError("Image");

  await db.productImage.delete({ where: { id: image.id } });
  await storage.delete(image.storageKey);
}

export async function listCollections(context: StoreContext) {
  requirePermission(context, "store:view");
  return db.collection.findMany({
    where: { storeId: context.storeId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      _count: { select: { products: true } },
    },
  });
}

export async function createCollection(
  context: StoreContext,
  input: CollectionInput,
) {
  requirePermission(context, "catalog:edit");
  const data = collectionSchema.parse(input);
  try {
    return await db.collection.create({
      data: { ...data, storeId: context.storeId },
      select: { id: true },
    });
  } catch (error) {
    if (uniqueViolation(error)?.includes("slug")) {
      throw new FieldConflictError(
        "slug",
        "Another collection already uses this URL",
      );
    }
    throw error;
  }
}

export async function updateCollection(
  context: StoreContext,
  collectionId: string,
  input: CollectionInput,
) {
  requirePermission(context, "catalog:edit");
  const data = collectionSchema.parse(input);
  // updateMany with storeId in the filter: a collection from another store matches nothing.
  try {
    const { count } = await db.collection.updateMany({
      where: { id: collectionId, storeId: context.storeId },
      data,
    });
    if (count === 0) throw new NotFoundError("Collection");
  } catch (error) {
    if (uniqueViolation(error)?.includes("slug")) {
      throw new FieldConflictError(
        "slug",
        "Another collection already uses this URL",
      );
    }
    throw error;
  }
}

export async function deleteCollection(
  context: StoreContext,
  collectionId: string,
) {
  requirePermission(context, "catalog:edit");
  const { count } = await db.collection.deleteMany({
    where: { id: collectionId, storeId: context.storeId },
  });
  if (count === 0) throw new NotFoundError("Collection");
}

/** Replaces the set of collections a product appears in. */
export async function setProductCollections(
  context: StoreContext,
  productId: string,
  collectionIds: string[],
) {
  requirePermission(context, "catalog:edit");
  await findOwnedProduct(context, productId);

  const uniqueIds = [...new Set(collectionIds)];
  const owned = await db.collection.count({
    where: { id: { in: uniqueIds }, storeId: context.storeId },
  });
  if (owned !== uniqueIds.length) throw new NotFoundError("Collection");

  await db.$transaction([
    db.collectionProduct.deleteMany({ where: { productId } }),
    db.collectionProduct.createMany({
      data: uniqueIds.map((collectionId) => ({ collectionId, productId })),
    }),
  ]);
}
