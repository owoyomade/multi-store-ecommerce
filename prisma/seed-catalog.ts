// Demo catalog for the seed script. Products are created through the same
// service functions the dashboard uses, so seeded data follows every rule
// (variants, SKUs, stock ledger, image processing) exactly like real data.
import { db } from "../src/server/db";
import {
  addProductImage,
  createCollection,
  createProduct,
  deleteProductImage,
  setProductCollections,
  updateVariants,
} from "../src/server/services/catalog";
import type { StoreContext } from "../src/server/tenancy/store-context";
import { getStoreContextForUser } from "../src/server/tenancy/store-context";
import { renderProductArt, type ProductArt } from "./seed-art";

function illustrationAlt(title: string): string {
  return `${title}, illustration`;
}

/**
 * Gives a product its drawing, replacing an older image if needed. Runs on
 * every seed, so existing demo stores pick up new artwork without losing
 * their orders or stock history.
 */
async function syncProductArt(
  context: StoreContext,
  productId: string,
  title: string,
  art: ProductArt,
) {
  const images = await db.productImage.findMany({
    where: { productId },
    select: { id: true, altText: true },
  });
  if (images.length === 1 && images[0]?.altText === illustrationAlt(title))
    return;
  for (const image of images) await deleteProductImage(context, image.id);
  await addProductImage(context, productId, {
    bytes: await renderProductArt(art),
    altText: illustrationAlt(title),
  });
}

export type DemoProduct = {
  title: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice?: string;
  skuPrefix: string;
  stock: number;
  status?: "DRAFT" | "PUBLISHED";
  options?: { name: string; values: string[] }[];
  collections: string[];
  /** Flat drawing used as the product image until real photography exists. */
  art: ProductArt;
  /** Per-variant tweaks after creation, keyed by variant title, e.g. a pricier 1 kg bag. */
  variantOverrides?: Record<string, { price?: string; stock?: number }>;
};

export type DemoCatalog = {
  collections: { title: string; slug: string; description: string }[];
  products: DemoProduct[];
};

export async function seedCatalog(
  storeSlug: string,
  ownerUserId: string,
  catalog: DemoCatalog,
) {
  const context = await getStoreContextForUser(ownerUserId, storeSlug);
  if (!context) throw new Error(`Seed owner is not a member of ${storeSlug}`);

  // Each collection and product is looked up by slug first, so a seed that
  // stopped halfway (say, an image upload failed) finishes the job on the
  // next run instead of skipping the store or creating duplicates.
  const collectionIds = new Map<string, string>();
  for (const collection of catalog.collections) {
    const existing = await db.collection.findFirst({
      where: { storeId: context.storeId, slug: collection.slug },
      select: { id: true },
    });
    const id = existing?.id ?? (await createCollection(context, collection)).id;
    collectionIds.set(collection.slug, id);
  }

  const collectionIdsFor = (item: DemoProduct) =>
    item.collections.map((slug) => {
      const id = collectionIds.get(slug);
      if (!id) throw new Error(`Unknown collection ${slug}`);
      return id;
    });

  let created = 0;
  for (const item of catalog.products) {
    const existing = await db.product.findFirst({
      where: { storeId: context.storeId, slug: item.slug },
      select: { id: true, _count: { select: { collections: true } } },
    });
    if (existing) {
      await syncProductArt(context, existing.id, item.title, item.art);
      // A product left over from an interrupted seed never got its
      // collections; ones a merchant has already arranged are left alone.
      if (existing._count.collections === 0)
        await setProductCollections(
          context,
          existing.id,
          collectionIdsFor(item),
        );
      continue;
    }

    const [option1, option2] = item.options ?? [];
    const product = await createProduct(context, {
      title: item.title,
      slug: item.slug,
      description: item.description,
      status: item.status ?? "PUBLISHED",
      price: item.price,
      compareAtPrice: item.compareAtPrice ?? "",
      skuPrefix: item.skuPrefix,
      initialStock: item.stock,
      option1Name: option1?.name ?? "",
      option1Values: option1?.values.join(", ") ?? "",
      option2Name: option2?.name ?? "",
      option2Values: option2?.values.join(", ") ?? "",
    });

    if (item.variantOverrides) {
      const variants = await db.productVariant.findMany({
        where: { productId: product.id },
        include: { inventoryLevels: true },
        orderBy: { position: "asc" },
      });
      await updateVariants(
        context,
        product.id,
        variants.map((variant) => {
          const override = item.variantOverrides?.[variant.title] ?? {};
          return {
            id: variant.id,
            sku: variant.sku,
            price: override.price ?? item.price,
            compareAtPrice: item.compareAtPrice ?? "",
            stock: override.stock ?? item.stock,
            trackInventory: true,
          };
        }),
      );
    }

    await syncProductArt(context, product.id, item.title, item.art);
    await setProductCollections(context, product.id, collectionIdsFor(item));
    created += 1;
  }
  console.log(
    `  ${storeSlug}: ${created} products added, ${catalog.products.length - created} already present (artwork refreshed)`,
  );
}

const coffeeSizes = { name: "Size", values: ["250 g", "1 kg"] };
const grinds = { name: "Grind", values: ["Whole bean", "Filter", "Espresso"] };
const oneKiloPrices = (price: string) =>
  Object.fromEntries(
    grinds.values.map((grind) => [`1 kg / ${grind}`, { price }]),
  );

export const northbrewCatalog: DemoCatalog = {
  collections: [
    {
      title: "Single origin",
      slug: "single-origin",
      description: "Traceable coffees from one farm or region.",
    },
    {
      title: "Brewing gear",
      slug: "brewing-gear",
      description: "Everything you need for a better cup at home.",
    },
    {
      title: "Gifts",
      slug: "gifts",
      description: "Thoughtful presents for coffee lovers.",
    },
  ],
  products: [
    {
      title: "Ethiopia Yirgacheffe",
      slug: "ethiopia-yirgacheffe",
      description:
        "Floral and bright, with notes of bergamot, peach and black tea.\n\nWashed process · 1,900 m",
      price: "21.00",
      skuPrefix: "ETH",
      stock: 30,
      options: [coffeeSizes, grinds],
      collections: ["single-origin"],
      art: {
        kind: "bag",
        ground: "#d9cfc0",
        body: "#6b3f2a",
        detail: "#ecebe6",
        label: ["Yirgacheffe", "Ethiopia, washed"],
      },
      variantOverrides: oneKiloPrices("68.00"),
    },
    {
      title: "Colombia Huila",
      slug: "colombia-huila",
      description: "Sweet and balanced: caramel, red apple and milk chocolate.",
      price: "19.00",
      skuPrefix: "COL",
      stock: 40,
      options: [coffeeSizes, grinds],
      collections: ["single-origin"],
      art: {
        kind: "bag",
        ground: "#cfc6b6",
        body: "#4a2c1d",
        detail: "#ecebe6",
        label: ["Huila", "Colombia"],
      },
      variantOverrides: oneKiloPrices("62.00"),
    },
    {
      title: "Kenya Nyeri",
      slug: "kenya-nyeri",
      description:
        "Juicy blackcurrant and grapefruit acidity with a syrupy body. On sale while this lot lasts.",
      price: "22.00",
      compareAtPrice: "26.00",
      skuPrefix: "KEN",
      stock: 12,
      options: [grinds],
      collections: ["single-origin"],
      art: {
        kind: "bag",
        ground: "#d8cbb8",
        body: "#7c2d12",
        detail: "#ecebe6",
        label: ["Nyeri", "Kenya"],
      },
      variantOverrides: { Espresso: { stock: 0 } },
    },
    {
      title: "Northbrew House Blend",
      slug: "house-blend",
      description:
        "Our everyday coffee. Chocolate, hazelnut and a long, sweet finish.",
      price: "17.00",
      skuPrefix: "HOUSE",
      stock: 60,
      options: [coffeeSizes, grinds],
      collections: ["gifts"],
      art: {
        kind: "bag",
        ground: "#c9bfae",
        body: "#3b2416",
        detail: "#ecebe6",
        label: ["House Blend", "Northbrew"],
      },
      variantOverrides: oneKiloPrices("54.00"),
    },
    {
      title: "Swiss Water Decaf",
      slug: "swiss-water-decaf",
      description:
        "All of the flavour, none of the caffeine. Chemical-free decaffeination.",
      price: "18.50",
      skuPrefix: "DECAF",
      stock: 0,
      collections: ["single-origin"],
      art: {
        kind: "bag",
        ground: "#d4d0c8",
        body: "#57534e",
        detail: "#ecebe6",
        label: ["Decaf", "Swiss Water"],
      },
    },
    {
      title: "Ceramic Pour-Over Dripper",
      slug: "ceramic-dripper",
      description:
        "Hand-glazed ceramic dripper that fits most mugs. Uses #2 cone filters.",
      price: "34.00",
      skuPrefix: "DRIP",
      stock: 15,
      options: [{ name: "Colour", values: ["Cream", "Charcoal"] }],
      collections: ["brewing-gear", "gifts"],
      art: {
        kind: "dripper",
        ground: "#d8cbb8",
        body: "#ecebe6",
        detail: "#3b2416",
      },
    },
    {
      title: "Burr Hand Grinder",
      slug: "hand-grinder",
      description:
        "Stainless steel conical burrs and 30 grind settings, from espresso to cold brew.",
      price: "89.00",
      skuPrefix: "GRIND",
      stock: 4,
      collections: ["brewing-gear"],
      art: {
        kind: "grinder",
        ground: "#d4cdc2",
        body: "#5c5650",
        detail: "#2a2622",
      },
    },
    {
      title: "Glass Carafe",
      slug: "glass-carafe",
      description: "600 ml borosilicate glass carafe with a cork collar.",
      price: "29.00",
      skuPrefix: "CARAFE",
      stock: 20,
      collections: ["brewing-gear"],
      art: {
        kind: "carafe",
        ground: "#d2d6d4",
        body: "#a9bcc0",
        detail: "#3b2416",
      },
    },
    {
      title: "Enamel Camp Mug",
      slug: "enamel-mug",
      description: "Speckled enamel mug, 350 ml. Tough enough for the trail.",
      price: "16.00",
      skuPrefix: "MUG",
      stock: 50,
      options: [{ name: "Colour", values: ["Forest", "Rust", "Midnight"] }],
      collections: ["gifts", "brewing-gear"],
      art: {
        kind: "mug",
        ground: "#c9d3c4",
        body: "#2f4a3a",
        detail: "#ecebe6",
      },
    },
    {
      title: "Coffee Lover's Gift Box",
      slug: "gift-box",
      description:
        "Two 250 g bags of our favourite coffees and an enamel mug, wrapped and ready to give.",
      price: "55.00",
      skuPrefix: "GIFT",
      stock: 10,
      collections: ["gifts"],
      art: {
        kind: "giftbox",
        ground: "#3b2416",
        body: "#d97706",
        detail: "#ecebe6",
      },
    },
    {
      title: "Holiday Spice Blend",
      slug: "holiday-blend",
      description:
        "Coming in December. Not visible to shoppers until it's published.",
      price: "20.00",
      skuPrefix: "HOLIDAY",
      stock: 0,
      status: "DRAFT",
      collections: [],
      art: {
        kind: "bag",
        ground: "#d8cbb8",
        body: "#9a3412",
        detail: "#ecebe6",
        label: ["Holiday", "Spice blend"],
      },
    },
  ],
};

const apparelSizes = { name: "Size", values: ["S", "M", "L", "XL"] };

export const lumenCatalog: DemoCatalog = {
  collections: [
    { title: "Tops", slug: "tops", description: "Tees, shirts and knits." },
    {
      title: "Outerwear",
      slug: "outerwear",
      description: "Layers built for changing weather.",
    },
    {
      title: "Accessories",
      slug: "accessories",
      description: "The finishing touches.",
    },
  ],
  products: [
    {
      title: "Heavyweight Tee",
      slug: "heavyweight-tee",
      description:
        "280 gsm organic cotton with a boxy fit and a reinforced collar that keeps its shape.",
      price: "38.00",
      skuPrefix: "TEE",
      stock: 25,
      options: [
        apparelSizes,
        { name: "Colour", values: ["Black", "White", "Sand"] },
      ],
      collections: ["tops"],
      art: {
        kind: "tee",
        ground: "#e7e5e1",
        body: "#0f172a",
        detail: "#1f2a44",
      },
    },
    {
      title: "Merino Crewneck",
      slug: "merino-crewneck",
      description:
        "Fine-gauge extra-fine merino. Warm, breathable and naturally odour resistant.",
      price: "120.00",
      skuPrefix: "MERINO",
      stock: 10,
      options: [apparelSizes, { name: "Colour", values: ["Charcoal", "Oat"] }],
      collections: ["tops"],
      art: {
        kind: "crewneck",
        ground: "#e2e0dc",
        body: "#4b4f57",
        detail: "#3a3e45",
      },
    },
    {
      title: "Linen Camp Shirt",
      slug: "linen-camp-shirt",
      description:
        "Breezy European linen with a relaxed camp collar. Sold out — restocking soon.",
      price: "110.00",
      skuPrefix: "LINEN",
      stock: 0,
      options: [apparelSizes],
      collections: ["tops"],
      art: {
        kind: "shirt",
        ground: "#efe3e5",
        body: "#9f1239",
        detail: "#7f0e2e",
      },
    },
    {
      title: "Ripstop Overshirt",
      slug: "ripstop-overshirt",
      description:
        "Water-resistant cotton ripstop with snap pockets. Wear it as a shirt or a light jacket.",
      price: "145.00",
      skuPrefix: "OVER",
      stock: 8,
      options: [apparelSizes, { name: "Colour", values: ["Olive", "Black"] }],
      collections: ["outerwear"],
      art: {
        kind: "shirt",
        ground: "#e4e3dc",
        body: "#5b5a3a",
        detail: "#3f3e28",
      },
    },
    {
      title: "Waxed Field Jacket",
      slug: "waxed-field-jacket",
      description:
        "Waxed cotton shell, corduroy collar and a quilted lining. Our end-of-season sale.",
      price: "260.00",
      compareAtPrice: "320.00",
      skuPrefix: "FIELD",
      stock: 5,
      options: [apparelSizes],
      collections: ["outerwear"],
      art: {
        kind: "jacket",
        ground: "#e7e5e1",
        body: "#4a3b2a",
        detail: "#2f251a",
      },
      variantOverrides: { XL: { stock: 0 } },
    },
    {
      title: "Relaxed Chino",
      slug: "relaxed-chino",
      description: "Garment-dyed cotton twill with a tapered leg.",
      price: "98.00",
      skuPrefix: "CHINO",
      stock: 14,
      options: [{ name: "Waist", values: ["30", "32", "34", "36"] }],
      collections: [],
      art: {
        kind: "chino",
        ground: "#e7e5e1",
        body: "#8a7e6a",
        detail: "#6e6455",
      },
    },
    {
      title: "Canvas Tote",
      slug: "canvas-tote",
      description:
        "16 oz canvas tote with an inside pocket. Holds a week of groceries.",
      price: "42.00",
      skuPrefix: "TOTE",
      stock: 40,
      collections: ["accessories"],
      art: {
        kind: "tote",
        ground: "#0f172a",
        body: "#e7e2d6",
        detail: "#c9c2b2",
      },
    },
    {
      title: "Ribbed Beanie",
      slug: "ribbed-beanie",
      description: "Chunky rib-knit beanie in recycled wool.",
      price: "32.00",
      skuPrefix: "BEANIE",
      stock: 30,
      options: [{ name: "Colour", values: ["Black", "Red", "Grey"] }],
      collections: ["accessories"],
      art: {
        kind: "beanie",
        ground: "#e7e5e1",
        body: "#be123c",
        detail: "#9b0f31",
      },
    },
    {
      title: "Logo Cap",
      slug: "logo-cap",
      description:
        "Six-panel cotton cap with an embroidered logo and brass buckle.",
      price: "36.00",
      skuPrefix: "CAP",
      stock: 22,
      collections: ["accessories"],
      art: {
        kind: "cap",
        ground: "#e7e5e1",
        body: "#1f2937",
        detail: "#e11d48",
      },
    },
    {
      title: "Archive Sample Jacket",
      slug: "archive-sample",
      description:
        "Internal sample — kept as a draft and never shown to shoppers.",
      price: "300.00",
      skuPrefix: "SAMPLE",
      stock: 1,
      status: "DRAFT",
      collections: [],
      art: {
        kind: "jacket",
        ground: "#e2e0dc",
        body: "#334155",
        detail: "#1e293b",
      },
    },
  ],
};
