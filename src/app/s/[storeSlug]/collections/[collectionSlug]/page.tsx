import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/storefront/product-listing";
import { getPublicCollection } from "@/server/services/storefront";
import { storefrontBasePath } from "@/server/storefront-path";
import { loadStorefront } from "../../load-store";

export async function generateMetadata({
  params,
}: PageProps<"/s/[storeSlug]/collections/[collectionSlug]">): Promise<Metadata> {
  const { storeSlug, collectionSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const collection = await getPublicCollection(store.id, collectionSlug);
  return {
    title: collection?.title ?? "Collection",
    description: collection?.description || undefined,
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/s/[storeSlug]/collections/[collectionSlug]">) {
  const { storeSlug, collectionSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const [collection, base, query] = await Promise.all([
    getPublicCollection(store.id, collectionSlug),
    storefrontBasePath(storeSlug),
    searchParams,
  ]);
  if (!collection) notFound();

  return (
    <>
      <h1 className="sf-heading text-3xl font-semibold">{collection.title}</h1>
      {collection.description && (
        <p className="mt-2 mb-6 max-w-2xl opacity-80">
          {collection.description}
        </p>
      )}
      <div className="mt-6">
        <ProductListing
          storeId={store.id}
          currency={store.currency}
          base={base}
          listingPath={`${base}/collections/${collection.slug}`}
          searchParams={query}
          collectionSlug={collection.slug}
        />
      </div>
    </>
  );
}
