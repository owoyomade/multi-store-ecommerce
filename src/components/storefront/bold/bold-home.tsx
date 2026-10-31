import "./bold.css";
import Image from "next/image";
import type {
  StoreImage,
  StorefrontContent,
} from "@/lib/validation/storefront-content";
import {
  getFeaturedProduct,
  listPublicCollections,
} from "@/server/services/storefront";
import { FeaturedProduct } from "../featured-product";
import { BoldCard } from "./bold-card";
import { BoldCollections } from "./bold-collections";
import { BoldLetter } from "./bold-letter";

type BoldHomeProps = {
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    tagline: string | null;
    content: StorefrontContent;
  };
  base: string;
};

/**
 * Bold homepage: the split stage. On wide screens the right half holds the
 * store's pictures, still and slowly crossfading, while the left half scrolls
 * through the card, one product in full, the founder's letter and the
 * collections. On phones the picture comes first and everything follows.
 */
export async function BoldHome({ store, base }: BoldHomeProps) {
  const { content } = store;
  const [featured, collections] = await Promise.all([
    getFeaturedProduct(store.id, content.featuredProductSlug),
    listPublicCollections(store.id),
  ]);
  const [stagePlate, letterPlate] = content.plates;
  const stagePhotos = [content.heroImage, stagePlate].filter(
    (photo): photo is StoreImage => Boolean(photo),
  );

  return (
    // Cancels the page column so the stage runs from the header to the footer.
    <div className="sf-bleed -mt-10 -mb-10 grid gap-3 p-3 md:grid-cols-2">
      <div className="md:order-2">
        <div className="bold-stage h-[38svh]" data-count={stagePhotos.length}>
          {stagePhotos.map((photo, index) => (
            <figure
              key={photo.storageKey}
              className="bold-stage__frame"
              style={{ ["--frame" as string]: index }}
            >
              <Image
                src={`/media/${photo.storageKey}`}
                alt={photo.alt}
                fill
                priority={index === 0}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="bold-stage__photo"
              />
              {photo.caption && (
                <figcaption className="absolute top-3 left-3 bg-[var(--sf-paper)] px-3 py-1.5 text-base text-[var(--sf-ink)]">
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:order-1">
        <BoldCard
          storeName={store.name}
          tagline={store.tagline ?? ""}
          summary={content.summary}
          actionLabel={content.actionLabel}
          shopHref={`${base}/products`}
          links={collections.map((c) => ({
            href: `${base}/collections/${c.slug}`,
            label: c.title,
          }))}
        />
        {featured && (
          <FeaturedProduct
            layout="stacked"
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
        {content.letter && (
          <BoldLetter letter={content.letter} plate={letterPlate} />
        )}
        <BoldCollections base={base} collections={collections} />
      </div>
    </div>
  );
}
