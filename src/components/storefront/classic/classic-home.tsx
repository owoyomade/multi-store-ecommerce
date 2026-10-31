import "./classic.css";
import type { StorefrontContent } from "@/lib/validation/storefront-content";
import {
  getFeaturedProduct,
  listPriceListGroups,
} from "@/server/services/storefront";
import { FeaturedProduct } from "../featured-product";
import { ClassicHero } from "./classic-hero";
import { ClassicLetter } from "./classic-letter";
import { ClassicPriceSheet } from "./classic-price-sheet";

type ClassicHomeProps = {
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    contactEmail: string;
    tagline: string | null;
    content: StorefrontContent;
  };
  base: string;
};

/**
 * Classic homepage, in the order the page makes its case: the store's label
 * (what it is), one product in full (buy it now), the whole catalogue as a
 * price list, and the founder's letter (why trust it). Each part appears
 * only when the store has the content for it.
 */
export async function ClassicHome({ store, base }: ClassicHomeProps) {
  const { content } = store;
  const [featured, groups] = await Promise.all([
    getFeaturedProduct(store.id, content.featuredProductSlug),
    listPriceListGroups(store.id),
  ]);
  const [firstPlate, secondPlate] = content.plates;

  return (
    // Cancels the page column's top and bottom padding so the full-width
    // sections meet the header and the footer without a gap.
    <div className="-mt-10 -mb-10">
      <ClassicHero
        storeName={store.name}
        summary={content.summary || store.tagline || ""}
        facts={content.facts}
        photo={content.heroImage}
        shopHref={`${base}/products`}
        actionLabel={content.actionLabel}
        storyHref={content.letter ? "#story" : null}
      />

      {featured && (
        <FeaturedProduct
          layout="split"
          storeSlug={store.slug}
          currency={store.currency}
          detailHref={`${base}/products/${featured.slug}`}
          cartHref={`${base}/cart`}
          product={{
            title: featured.title,
            description: featured.description,
            options: featured.options,
            variants: featured.variants,
            image: featured.images[0] ?? null,
          }}
        />
      )}

      <ClassicPriceSheet
        storeName={store.name}
        currency={store.currency}
        base={base}
        groups={groups}
        contactEmail={store.contactEmail}
      />

      {content.letter && (
        <ClassicLetter
          letter={content.letter}
          backdrop={secondPlate}
          plate={firstPlate}
          contactEmail={store.contactEmail}
        />
      )}
    </div>
  );
}
