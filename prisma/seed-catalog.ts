// Demo catalog for the seed script. Products are created through the same
// service functions the dashboard uses, so seeded data follows every rule
// (variants, SKUs, stock ledger, image processing) exactly like real data.
import sharp from "sharp";
import { db } from "../src/server/db";
import {
  addProductImage,
  createCollection,
  createProduct,
  setProductCollections,
  updateVariants,
} from "../src/server/services/catalog";
import { getStoreContextForUser } from "../src/server/tenancy/store-context";

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
  /** Background colour for the generated product image. */
  imageColor: string;
  /** Per-variant tweaks after creation, keyed by variant title, e.g. a pricier 1 kg bag. */
  variantOverrides?: Record<string, { price?: string; stock?: number }>;
};

export type DemoCatalog = {
  collections: { title: string; slug: string; description: string }[];
  products: DemoProduct[];
  imageStyle: "classic" | "bold";
};

function escapeXml(text: string): string {
  return text.replace(
    /[<>&"']/g,
    (character) => `&#${character.charCodeAt(0)};`,
  );
}

/**
 * Draws a simple product "photo" as an SVG and renders it to PNG, so the demo
 * has visuals without shipping stock photography. Clearly placeholder art.
 */
async function generateProductImage(
  title: string,
  color: string,
  style: DemoCatalog["imageStyle"],
) {
  // Wrap the title onto lines of about 12 characters so it fills the image.
  const lines = title.split(" ").reduce<string[]>((wrapped, word) => {
    const last = wrapped.at(-1);
    if (last && `${last} ${word}`.length <= 12)
      wrapped[wrapped.length - 1] = `${last} ${word}`;
    else wrapped.push(word);
    return wrapped;
  }, []);
  const isBold = style === "bold";
  const fontSize = isBold ? 76 : 70;
  const lineHeight = fontSize * 1.15;
  const text = lines
    .map(
      (line, index) =>
        `<text x="400" y="${400 + fontSize / 3 + (index - (lines.length - 1) / 2) * lineHeight}" text-anchor="middle" font-family="${isBold ? "Helvetica, Arial, sans-serif" : "Georgia, serif"}" font-size="${fontSize}" font-weight="${isBold ? 800 : 500}" fill="#ffffff">${escapeXml(isBold ? line.toUpperCase() : line)}</text>`,
    )
    .join("");
  const shape = isBold
    ? `<rect x="80" y="80" width="640" height="640" fill="#000000" fill-opacity="0.18"/>`
    : `<rect x="110" y="110" width="580" height="580" rx="64" fill="#ffffff" fill-opacity="0.12"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0.75"/>
    </linearGradient></defs>
    <rect width="800" height="800" fill="#1a1a1a"/><rect width="800" height="800" fill="url(#g)"/>
    ${shape}${text}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function seedCatalog(
  storeSlug: string,
  ownerUserId: string,
  catalog: DemoCatalog,
) {
  const context = await getStoreContextForUser(ownerUserId, storeSlug);
  if (!context) throw new Error(`Seed owner is not a member of ${storeSlug}`);

  if ((await db.product.count({ where: { storeId: context.storeId } })) > 0) {
    console.log(`  ${storeSlug}: catalog already present, skipping`);
    return;
  }

  const collectionIds = new Map<string, string>();
  for (const collection of catalog.collections) {
    const created = await createCollection(context, collection);
    collectionIds.set(collection.slug, created.id);
  }

  for (const item of catalog.products) {
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

    await addProductImage(context, product.id, {
      bytes: await generateProductImage(
        item.title,
        item.imageColor,
        catalog.imageStyle,
      ),
      altText: `${item.title} product image`,
    });
    await setProductCollections(
      context,
      product.id,
      item.collections.map((slug) => {
        const id = collectionIds.get(slug);
        if (!id) throw new Error(`Unknown collection ${slug}`);
        return id;
      }),
    );
  }
  console.log(
    `  ${storeSlug}: ${catalog.products.length} products, ${catalog.collections.length} collections`,
  );
}

const coffeeSizes = { name: "Size", values: ["250 g", "1 kg"] };
const grinds = { name: "Grind", values: ["Whole bean", "Filter", "Espresso"] };
const oneKiloPrices = (price: string) =>
  Object.fromEntries(
    grinds.values.map((grind) => [`1 kg / ${grind}`, { price }]),
  );

export const northbrewCatalog: DemoCatalog = {
  imageStyle: "classic",
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
      imageColor: "#8a5a3c",
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
      imageColor: "#6b4226",
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
      imageColor: "#7c2d12",
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
      imageColor: "#3b2416",
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
      imageColor: "#57534e",
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
      imageColor: "#b45309",
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
      imageColor: "#44403c",
    },
    {
      title: "Glass Carafe",
      slug: "glass-carafe",
      description: "600 ml borosilicate glass carafe with a cork collar.",
      price: "29.00",
      skuPrefix: "CARAFE",
      stock: 20,
      collections: ["brewing-gear"],
      imageColor: "#92400e",
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
      imageColor: "#a16207",
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
      imageColor: "#78350f",
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
      imageColor: "#9a3412",
    },
  ],
};

const apparelSizes = { name: "Size", values: ["S", "M", "L", "XL"] };

export const lumenCatalog: DemoCatalog = {
  imageStyle: "bold",
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
      imageColor: "#111827",
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
      imageColor: "#374151",
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
      imageColor: "#9f1239",
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
      imageColor: "#1e293b",
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
      imageColor: "#e11d48",
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
      imageColor: "#475569",
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
      imageColor: "#0f172a",
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
      imageColor: "#be123c",
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
      imageColor: "#1f2937",
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
      imageColor: "#334155",
    },
  ],
};
