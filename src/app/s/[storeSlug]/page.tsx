import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import {
  listPublicCollections,
  listPublicProducts,
} from "@/server/services/storefront";
import { storefrontBasePath } from "@/server/storefront-path";
import { loadStorefront } from "./load-store";

export default async function StorefrontHomePage({
  params,
}: PageProps<"/s/[storeSlug]">) {
  const { storeSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const [base, collections, newest] = await Promise.all([
    storefrontBasePath(storeSlug),
    listPublicCollections(store.id),
    listPublicProducts(store.id, { sort: "newest" }),
  ]);
  const featured = newest.products.slice(0, 8);

  return (
    <div className="space-y-16">
      <section className="-mx-4 -mt-10 bg-[var(--sf-primary)] px-4 pt-6 pb-16 text-[var(--sf-on-primary)] sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="sf-heading max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
            {store.tagline || `Welcome to ${store.name}`}
          </h1>
          <Link
            href={`${base}/products`}
            className="mt-8 inline-block rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-6 py-3 font-medium text-[var(--sf-on-accent)]"
          >
            Shop now
          </Link>
        </div>
      </section>

      {collections.length > 0 && (
        <section aria-labelledby="collections-heading">
          <h2
            id="collections-heading"
            className="sf-heading mb-6 text-2xl font-semibold"
          >
            Shop by collection
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`${base}/collections/${collection.slug}`}
                  className="block h-full rounded-[var(--sf-radius)] border border-current/15 p-6 transition-colors hover:border-[var(--sf-accent)]"
                >
                  <span className="sf-heading text-xl font-semibold">
                    {collection.title}
                  </span>
                  {collection.description && (
                    <span className="mt-2 block text-sm opacity-75">
                      {collection.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="new-heading">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 id="new-heading" className="sf-heading text-2xl font-semibold">
            New arrivals
          </h2>
          <Link href={`${base}/products`} className="text-sm underline">
            View all
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="opacity-70">
            New products are on their way. Check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard
                  href={`${base}/products/${product.slug}`}
                  currency={store.currency}
                  product={product}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
