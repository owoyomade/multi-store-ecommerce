import type { Metadata } from "next";
import { ProductListing } from "@/components/storefront/product-listing";
import { firstParam } from "@/lib/search-params";
import { storefrontBasePath } from "@/server/storefront-path";
import { loadStorefront } from "../load-store";

export const metadata: Metadata = { title: "Shop all" };

export default async function AllProductsPage({
  params,
  searchParams,
}: PageProps<"/s/[storeSlug]/products">) {
  const { storeSlug } = await params;
  const [store, base, query] = await Promise.all([
    loadStorefront(storeSlug),
    storefrontBasePath(storeSlug),
    searchParams,
  ]);
  const search = firstParam(query.q);

  return (
    <>
      <h1 className="sf-heading mb-6 text-3xl font-semibold">
        {search ? `Results for “${search}”` : "Shop all"}
      </h1>
      <ProductListing
        storeId={store.id}
        currency={store.currency}
        base={base}
        listingPath={`${base}/products`}
        searchParams={query}
      />
    </>
  );
}
