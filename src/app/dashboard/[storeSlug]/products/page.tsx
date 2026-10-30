import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Pagination } from "@/components/pagination";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  firstParam,
  oneOf,
  pageParam,
  toQueryString,
} from "@/lib/search-params";
import { PRODUCT_STATUSES } from "@/lib/validation/catalog";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { listProductsForDashboard } from "@/server/services/catalog";
import { getStoreDetails } from "@/server/services/stores";
import { ProductStatusBadge } from "./product-status-badge";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[storeSlug]/products">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "catalog:edit")) {
    return (
      <NoAccess
        title="Products"
        message="Your role doesn't include managing products."
      />
    );
  }

  const query = await searchParams;
  const status = oneOf(query.status, PRODUCT_STATUSES);
  const search = firstParam(query.q);
  const [store, listing] = await Promise.all([
    getStoreDetails(context),
    listProductsForDashboard(context, {
      status,
      search,
      page: pageParam(query.page),
    }),
  ]);
  const basePath = `/dashboard/${storeSlug}/products`;
  const isFiltered = Boolean(status || search);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href={`${basePath}/new`} className={buttonClasses()}>
          Add product
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="product-search">
          Search products
        </label>
        <input
          id="product-search"
          name="q"
          defaultValue={search}
          placeholder="Search by title"
          className="w-full max-w-xs rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <label className="sr-only" htmlFor="product-status">
          Status
        </label>
        <select
          id="product-status"
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="submit" className={buttonClasses("secondary")}>
          Filter
        </button>
      </form>

      {listing.products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          {isFiltered ? (
            <>
              <h2 className="font-medium">No products match these filters</h2>
              <Link
                href={basePath}
                className="mt-2 inline-block text-sm underline"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-medium">No products yet</h2>
              <p className="mt-1 text-sm text-stone-600">
                Add your first product to start building your catalog.
              </p>
              <Link
                href={`${basePath}/new`}
                className={`${buttonClasses()} mt-4`}
              >
                Add product
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-stone-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Product
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Stock
                </th>
                <th scope="col" className="px-4 py-3">
                  Price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {listing.products.map((product) => (
                <tr key={product.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`${basePath}/${product.id}`}
                      className="flex items-center gap-3 font-medium"
                    >
                      {product.image ? (
                        <Image
                          src={`/media/${product.image.storageKey}`}
                          alt=""
                          width={40}
                          height={40}
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="size-10 rounded-md bg-stone-100"
                        />
                      )}
                      {product.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ProductStatusBadge status={product.status} />
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {product.tracksStock
                      ? `${product.stock} in stock`
                      : "Not tracked"}
                    {product.variantCount > 1 &&
                      ` · ${product.variantCount} variants`}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {product.minPriceCents === null
                      ? "—"
                      : `${product.hasPriceRange ? "From " : ""}${formatMoney(product.minPriceCents, store.currency)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={listing.page}
        pageCount={listing.pageCount}
        hrefForPage={(page) =>
          `${basePath}${toQueryString({ q: search, status, page })}`
        }
      />
    </div>
  );
}
