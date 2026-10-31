import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { parseStorefrontContent } from "@/lib/validation/storefront-content";
import { db } from "../db";
import { availableToSell } from "./inventory";

// Read-only queries for the public storefront. No StoreContext here because
// shoppers aren't signed in; instead every query is pinned to one storeId and
// only returns PUBLISHED, non-deleted products.

export const STOREFRONT_PAGE_SIZE = 12;

export const SORT_OPTIONS = {
  newest: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "title-asc": "Name: A–Z",
} as const;

export type SortOption = keyof typeof SORT_OPTIONS;

export type ProductListingFilters = {
  search?: string;
  collectionSlug?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
};

/**
 * Finds a store a visitor is allowed to see. Live stores are public. A draft
 * store is only visible to its own staff, as a preview. Suspended or deleted
 * stores are hidden from everyone.
 */
export async function getVisibleStore(
  slug: string,
  viewerUserId: string | null,
) {
  const store = await db.store.findFirst({
    where: { slug, deletedAt: null, status: { in: ["ACTIVE", "DRAFT"] } },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      currency: true,
      contactEmail: true,
      primaryColor: true,
      accentColor: true,
      theme: true,
      tagline: true,
      storefrontContent: true,
    },
  });
  if (!store) return null;
  const { storefrontContent, ...storeFields } = store;
  const visible = {
    ...storeFields,
    content: parseStorefrontContent(storefrontContent),
  };
  if (store.status === "ACTIVE") return { ...visible, isPreview: false };

  if (!viewerUserId) return null;
  const isMember = await db.storeMembership.findUnique({
    where: { storeId_userId: { storeId: store.id, userId: viewerUserId } },
    select: { id: true },
  });
  return isMember ? { ...visible, isPreview: true } : null;
}

export async function listPublicCollections(storeId: string) {
  return db.collection.findMany({
    where: {
      storeId,
      products: { some: { product: { status: "PUBLISHED", deletedAt: null } } },
    },
    orderBy: { title: "asc" },
    select: { id: true, title: true, slug: true, description: true },
  });
}

export async function getPublicCollection(storeId: string, slug: string) {
  return db.collection.findUnique({
    where: { storeId_slug: { storeId, slug } },
    select: { id: true, title: true, slug: true, description: true },
  });
}

type ListingRow = {
  id: string;
  title: string;
  slug: string;
  minPriceCents: number;
  maxPriceCents: number;
  maxCompareAtCents: number | null;
  inStock: boolean;
  totalCount: bigint;
};

// A product is in stock if any of its variants either doesn't track stock or
// has units that aren't reserved by pending checkouts.
const inStockExpression = Prisma.sql`BOOL_OR(NOT v."trackInventory" OR COALESCE(l."onHand" - l."reserved", 0) > 0)`;

/** Escapes % and _ so a search for "50%" matches the text "50%", not everything. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * Product grid for the storefront: search, collection, price range, in-stock
 * filter, sorting and pagination in one query.
 *
 * This is raw SQL because sorting and filtering by a product's *lowest variant
 * price* needs a GROUP BY that Prisma's query builder can't express. All
 * values are passed as parameters (Prisma.sql), never pasted into the string,
 * so this is safe from SQL injection.
 */
export async function listPublicProducts(
  storeId: string,
  filters: ProductListingFilters,
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."storeId" = ${storeId}`,
    Prisma.sql`p."status" = 'PUBLISHED'`,
    Prisma.sql`p."deletedAt" IS NULL`,
  ];
  if (filters.search) {
    const pattern = likePattern(filters.search);
    conditions.push(
      Prisma.sql`(p."title" ILIKE ${pattern} OR p."description" ILIKE ${pattern})`,
    );
  }
  if (filters.collectionSlug) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "collection_products" cp
      JOIN "collections" c ON c."id" = cp."collectionId"
      WHERE cp."productId" = p."id" AND c."storeId" = ${storeId} AND c."slug" = ${filters.collectionSlug})`);
  }

  const having: Prisma.Sql[] = [];
  if (filters.minPriceCents !== undefined)
    having.push(Prisma.sql`MIN(v."priceCents") >= ${filters.minPriceCents}`);
  if (filters.maxPriceCents !== undefined)
    having.push(Prisma.sql`MIN(v."priceCents") <= ${filters.maxPriceCents}`);
  if (filters.inStockOnly) having.push(Prisma.sql`${inStockExpression}`);

  const orderBy = {
    newest: Prisma.sql`p."createdAt" DESC`,
    "price-asc": Prisma.sql`MIN(v."priceCents") ASC`,
    "price-desc": Prisma.sql`MIN(v."priceCents") DESC`,
    "title-asc": Prisma.sql`p."title" ASC`,
  }[filters.sort ?? "newest"];

  const rows = await db.$queryRaw<ListingRow[]>`
    SELECT
      p."id", p."title", p."slug",
      MIN(v."priceCents")::int AS "minPriceCents",
      MAX(v."priceCents")::int AS "maxPriceCents",
      MAX(v."compareAtPriceCents")::int AS "maxCompareAtCents",
      ${inStockExpression} AS "inStock",
      COUNT(*) OVER () AS "totalCount"
    FROM "products" p
    JOIN "product_variants" v ON v."productId" = p."id" AND v."archivedAt" IS NULL
    LEFT JOIN "inventory_levels" l ON l."variantId" = v."id"
    WHERE ${Prisma.join(conditions, " AND ")}
    GROUP BY p."id"
    ${having.length ? Prisma.sql`HAVING ${Prisma.join(having, " AND ")}` : Prisma.empty}
    ORDER BY ${orderBy}, p."id"
    LIMIT ${STOREFRONT_PAGE_SIZE} OFFSET ${(page - 1) * STOREFRONT_PAGE_SIZE}`;

  const images = await db.productImage.findMany({
    where: { productId: { in: rows.map((row) => row.id) }, position: 0 },
    select: {
      productId: true,
      storageKey: true,
      altText: true,
      width: true,
      height: true,
    },
  });
  const imageByProduct = new Map(
    images.map((image) => [image.productId, image]),
  );

  const total = rows.length ? Number(rows[0].totalCount) : 0;
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE)),
    products: rows.map(({ totalCount: _totalCount, ...row }) => ({
      ...row,
      image: imageByProduct.get(row.id) ?? null,
    })),
  };
}

export async function getPublicProduct(storeId: string, slug: string) {
  const product = await db.product.findFirst({
    where: { storeId, slug, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      options: {
        orderBy: { position: "asc" },
        select: { name: true, values: true },
      },
      images: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          storageKey: true,
          altText: true,
          width: true,
          height: true,
        },
      },
      variants: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          optionValues: true,
          priceCents: true,
          compareAtPriceCents: true,
          trackInventory: true,
          inventoryLevels: { select: { onHand: true, reserved: true } },
        },
      },
    },
  });
  if (!product) return null;

  return {
    ...product,
    variants: product.variants.map(({ inventoryLevels, ...variant }) => {
      const available = availableToSell(variant, inventoryLevels);
      // Infinity can't be sent to the browser as JSON, so untracked stock becomes null.
      return {
        ...variant,
        available: Number.isFinite(available) ? available : null,
      };
    }),
  };
}

/**
 * The product the homepage features: the one the merchant chose, or, if
 * none is chosen (or it was unpublished), the newest published product.
 */
export async function getFeaturedProduct(
  storeId: string,
  preferredSlug: string | undefined,
) {
  if (preferredSlug) {
    const chosen = await getPublicProduct(storeId, preferredSlug);
    if (chosen) return chosen;
  }
  const newest = await db.product.findFirst({
    where: { storeId, status: "PUBLISHED", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { slug: true },
  });
  return newest ? getPublicProduct(storeId, newest.slug) : null;
}

const PRICE_LIST_ITEMS_PER_GROUP = 8;

/**
 * Collections with their published products and lowest prices, for a
 * price-list style overview. Products in no collection are gathered under
 * "More" so nothing for sale is left out.
 */
export async function listPriceListGroups(storeId: string) {
  const products = await db.product.findMany({
    where: { storeId, status: "PUBLISHED", deletedAt: null },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      collections: {
        select: {
          collection: { select: { id: true, title: true, slug: true } },
        },
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
  });

  type Item = {
    slug: string;
    title: string;
    note: string;
    minPriceCents: number;
    hasRange: boolean;
    inStock: boolean;
  };
  const groups = new Map<
    string,
    { title: string; slug: string | null; items: Item[] }
  >();

  for (const product of products) {
    if (product.variants.length === 0) continue;
    const prices = product.variants.map((variant) => variant.priceCents);
    const item: Item = {
      slug: product.slug,
      title: product.title,
      // The first sentence of the description makes a one-line note.
      note: product.description.split(/(?<=\.)\s/)[0]?.slice(0, 90) ?? "",
      minPriceCents: Math.min(...prices),
      hasRange: new Set(prices).size > 1,
      inStock: product.variants.some(
        (variant) => availableToSell(variant, variant.inventoryLevels) > 0,
      ),
    };
    const targets = product.collections.length
      ? product.collections.map(({ collection }) => collection)
      : [{ id: "more", title: "More", slug: null }];
    for (const target of targets) {
      const group = groups.get(target.id) ?? {
        title: target.title,
        slug: target.slug,
        items: [],
      };
      if (group.items.length < PRICE_LIST_ITEMS_PER_GROUP)
        group.items.push(item);
      groups.set(target.id, group);
    }
  }
  // Named collections first (alphabetically), the catch-all last.
  return [...groups.values()].sort((a, b) =>
    a.slug === null ? 1 : b.slug === null ? -1 : a.title.localeCompare(b.title),
  );
}
