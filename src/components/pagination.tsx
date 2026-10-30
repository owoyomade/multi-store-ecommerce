import Link from "next/link";

type PaginationProps = {
  page: number;
  pageCount: number;
  /** Builds the URL for a page number, keeping the current filters. */
  hrefForPage: (page: number) => string;
};

export function Pagination({ page, pageCount, hrefForPage }: PaginationProps) {
  if (pageCount <= 1) return null;
  const linkClasses =
    "rounded-md border border-current/20 px-3 py-1.5 text-sm hover:bg-current/5";

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-3"
    >
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={linkClasses} rel="prev">
          Previous
        </Link>
      ) : null}
      <span className="text-sm opacity-70">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className={linkClasses} rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
