import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { centsToInputValue, parseMoneyToCents } from "@/lib/money";
import {
  firstParam,
  oneOf,
  pageParam,
  toQueryString,
} from "@/lib/search-params";
import {
  listPublicProducts,
  SORT_OPTIONS,
  type SortOption,
} from "@/server/services/storefront";
import { ProductCard } from "./product-card";

type RawSearchParams = Record<string, string | string[] | undefined>;

type ProductListingProps = {
  storeId: string;
  currency: string;
  /** Prefix for product links, e.g. "/s/northbrew" or "" on a store subdomain. */
  base: string;
  /** URL of the current listing page, used for the filter form and pagination. */
  listingPath: string;
  searchParams: RawSearchParams;
  collectionSlug?: string;
};

/**
 * Filters, product grid and pagination. Filters live in the URL (?q=&sort=...),
 * so results can be bookmarked and shared, and the form works without JavaScript.
 */
export async function ProductListing({
  storeId,
  currency,
  base,
  listingPath,
  searchParams,
  collectionSlug,
}: ProductListingProps) {
  const search = firstParam(searchParams.q);
  const sort =
    oneOf(searchParams.sort, Object.keys(SORT_OPTIONS) as SortOption[]) ??
    "newest";
  const minPriceCents =
    parseMoneyToCents(firstParam(searchParams.min) ?? "") ?? undefined;
  const maxPriceCents =
    parseMoneyToCents(firstParam(searchParams.max) ?? "") ?? undefined;
  const inStockOnly = firstParam(searchParams.inStock) === "1";

  const listing = await listPublicProducts(storeId, {
    search,
    collectionSlug,
    sort,
    minPriceCents,
    maxPriceCents,
    inStockOnly,
    page: pageParam(searchParams.page),
  });

  const activeFilters = {
    q: search,
    sort: sort === "newest" ? undefined : sort,
    min:
      minPriceCents === undefined
        ? undefined
        : centsToInputValue(minPriceCents),
    max:
      maxPriceCents === undefined
        ? undefined
        : centsToInputValue(maxPriceCents),
    inStock: inStockOnly ? "1" : undefined,
  };
  const hasFilters = Object.values(activeFilters).some(Boolean);
  const fieldClasses =
    "rounded-[var(--sf-radius)] border border-current/20 bg-white px-3 py-2 text-sm text-stone-900";

  return (
    <div>
      <form
        action={listingPath}
        className="mb-8 flex flex-wrap items-end gap-3"
        aria-label="Filter products"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-q" className="text-xs opacity-70">
            Search
          </label>
          <input
            id="filter-q"
            name="q"
            defaultValue={search}
            className={`${fieldClasses} w-48`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-min" className="text-xs opacity-70">
            Min price
          </label>
          <input
            id="filter-min"
            name="min"
            inputMode="decimal"
            defaultValue={activeFilters.min}
            className={`${fieldClasses} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-max" className="text-xs opacity-70">
            Max price
          </label>
          <input
            id="filter-max"
            name="max"
            inputMode="decimal"
            defaultValue={activeFilters.max}
            className={`${fieldClasses} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-sort" className="text-xs opacity-70">
            Sort by
          </label>
          <select
            id="filter-sort"
            name="sort"
            defaultValue={sort}
            className={fieldClasses}
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            name="inStock"
            value="1"
            defaultChecked={inStockOnly}
            className="size-4"
          />
          In stock only
        </label>
        <button
          type="submit"
          className="rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-4 py-2 text-sm font-medium text-[var(--sf-on-primary)]"
        >
          Apply
        </button>
        {hasFilters && (
          <Link href={listingPath} className="py-2 text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <p className="mb-4 text-sm opacity-70" aria-live="polite">
        {listing.total} product{listing.total === 1 ? "" : "s"}
      </p>

      {listing.products.length === 0 ? (
        <div className="rounded-[var(--sf-radius)] bg-[var(--sf-paper-deep)] p-12 text-center">
          <p className="sf-heading text-lg">Nothing here yet</p>
          <p className="mt-1 text-sm opacity-70">
            {hasFilters
              ? "Try different filters."
              : "Check back soon for new products."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {listing.products.map((product) => (
            <li key={product.id}>
              <ProductCard
                href={`${base}/products/${product.slug}`}
                currency={currency}
                product={product}
              />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={listing.page}
        pageCount={listing.pageCount}
        hrefForPage={(page) =>
          `${listingPath}${toQueryString({ ...activeFilters, page })}`
        }
      />
    </div>
  );
}
