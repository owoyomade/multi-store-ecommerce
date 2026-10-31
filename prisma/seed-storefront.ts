// Homepage content for the demo stores: pictures from open collections
// (credited), short facts, a featured product and the founder's letter.
// The words are sample copy for the demo; a real merchant writes their own.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/server/db";
import {
  updateStorefrontContent,
  uploadStorefrontImage,
} from "../src/server/services/storefront-content";
import { getStoreContextForUser } from "../src/server/tenancy/store-context";

type ManifestEntry = {
  file: string;
  alt: string;
  caption: string;
  credit: string;
};

type DemoStorefront = {
  assetDir: string;
  facts: string[];
  summary: string;
  actionLabel: string;
  featuredProductSlug: string;
  hero: string;
  plates: string[];
  footer: string;
  letter: {
    paragraphs: string[];
    signedBy: string;
    role: string;
    image?: string;
  };
};

export async function seedStorefront(
  storeSlug: string,
  ownerUserId: string,
  demo: DemoStorefront,
) {
  const context = await getStoreContextForUser(ownerUserId, storeSlug);
  if (!context) throw new Error(`Seed owner is not a member of ${storeSlug}`);

  // Never overwrite content a merchant has already set up.
  const store = await db.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { storefrontContent: true },
  });
  if (store.storefrontContent) {
    console.log(`  ${storeSlug}: storefront content already present, skipping`);
    return;
  }

  const dir = join(import.meta.dirname, "seed-assets", demo.assetDir);
  const manifest: ManifestEntry[] = JSON.parse(
    readFileSync(join(dir, "credits.json"), "utf8"),
  );
  const upload = async (file: string) => {
    const entry = manifest.find((item) => item.file === file);
    if (!entry)
      throw new Error(`${file} is missing from ${demo.assetDir}/credits.json`);
    return uploadStorefrontImage(context, {
      bytes: readFileSync(join(dir, file)),
      ...entry,
    });
  };

  await updateStorefrontContent(context, {
    heroImage: await upload(demo.hero),
    facts: demo.facts,
    summary: demo.summary,
    actionLabel: demo.actionLabel,
    featuredProductSlug: demo.featuredProductSlug,
    letter: {
      paragraphs: demo.letter.paragraphs,
      signedBy: demo.letter.signedBy,
      role: demo.letter.role,
      image: demo.letter.image ? await upload(demo.letter.image) : undefined,
    },
    plates: await Promise.all(demo.plates.map(upload)),
    footerImage: await upload(demo.footer),
  });
  console.log(`  ${storeSlug}: storefront content added`);
}

export const northbrewStorefront: DemoStorefront = {
  assetDir: "northbrew",
  facts: [
    "Roasted in Toronto",
    "Ships across Canada",
    "Free shipping over $75",
  ],
  summary:
    "Single-origin beans roasted in small batches every week, and the gear to brew them well at home.",
  actionLabel: "Shop the roasts",
  featuredProductSlug: "ethiopia-yirgacheffe",
  hero: "hero-roasted-beans.webp",
  plates: ["plate-coffea-arabica.webp", "plate-las-nubes-1875.webp"],
  footer: "footer-toronto-postcard.webp",
  letter: {
    paragraphs: [
      "I started roasting in a garage off Roncesvalles with a machine that held one kilo and a notebook of mistakes.",
      "Every coffee we sell comes from a farm or a washing station we can name. The label on the bag says where it grew, how high, and how it was processed, because that is what you taste.",
      "We roast twice a week in small batches and ship within days, so the beans reach you while they still have something to say.",
      "If a bag isn't right for you, write to me and we'll make it right.",
    ],
    signedBy: "Maya Okafor",
    role: "Founder and head roaster",
    image: "letter-pissarro.webp",
  },
};

export const lumenStorefront: DemoStorefront = {
  assetDir: "lumen",
  facts: [
    "Cut and sewn in the USA",
    "Free shipping over $100",
    "Free repairs for a year",
  ],
  summary:
    "Heavyweight tees, merino knits and waxed outerwear, made to be worn hard and mended, not replaced.",
  actionLabel: "Shop the collection",
  featuredProductSlug: "heavyweight-tee",
  hero: "hero-moser-poppyheads.webp",
  plates: ["plate-lowell-mill-1941.webp", "plate-hogarth-looms.webp"],
  footer: "plate-mill-workers.webp",
  letter: {
    paragraphs: [
      "Lumen started with one shirt I kept repairing because nothing I could buy replaced it.",
      "We make fewer things and make them heavier: 280 gram cotton, extra-fine merino, waxed canvas that gets better with every season.",
      "Every piece is cut and sewn by people we know by name, and every seam is made to be opened and mended.",
      "If something of ours wears through in the first year, send it back and we'll repair it for free.",
    ],
    signedBy: "Theo Lindqvist",
    role: "Founder",
  },
};
