import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { Scallops } from "./scallops";

type Group = {
  title: string;
  slug: string | null;
  items: {
    slug: string;
    title: string;
    note: string;
    minPriceCents: number;
    hasRange: boolean;
    inStock: boolean;
  }[];
};

type ClassicPriceSheetProps = {
  storeName: string;
  currency: string;
  base: string;
  groups: Group[];
  contactEmail: string;
};

/**
 * The whole catalogue as one printed price list: a paper sheet with
 * scalloped edges, each collection a group, each product a line with its
 * price set flush right.
 */
export function ClassicPriceSheet({
  storeName,
  currency,
  base,
  groups,
  contactEmail,
}: ClassicPriceSheetProps) {
  if (groups.length === 0) return null;

  return (
    <section
      aria-labelledby="price-list-title"
      className="sf-bleed bg-[var(--sf-primary)] py-24 md:py-32"
    >
      <div className="sf-container">
        <div className="relative mx-auto max-w-[680px] bg-[var(--sf-paper)] px-7 py-14 text-center sm:px-16 sm:py-16">
          <Scallops edge="top" />
          <h2
            data-reveal
            style={{ ["--reveal-order" as string]: 0 }}
            id="price-list-title"
            className="sf-heading text-[clamp(32px,3vw,44px)] leading-[1.05]"
          >
            Price list
          </h2>
          <p className="mt-3 text-[17px]">
            {storeName}. All prices in {currency}.
          </p>

          <div className="mt-12 space-y-14">
            {groups.map((group, index) => (
              <div
                key={group.slug ?? "more"}
                data-reveal
                style={{ ["--reveal-order" as string]: index + 1 }}
              >
                <h3 className="text-[22px] italic">
                  {group.slug ? (
                    <Link
                      href={`${base}/collections/${group.slug}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {group.title}
                    </Link>
                  ) : (
                    group.title
                  )}
                </h3>
                <ul className="mx-auto mt-5 max-w-[440px] space-y-4 text-left">
                  {group.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`${base}/products/${item.slug}`}
                        className="group block"
                      >
                        <span className="flex items-baseline justify-between gap-6 text-[17px] font-semibold">
                          <span className="group-hover:underline group-hover:underline-offset-4">
                            {item.title}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {item.inStock
                              ? `${item.hasRange ? "from " : ""}${formatMoney(item.minPriceCents, currency)}`
                              : "Sold out"}
                          </span>
                        </span>
                        {item.note && (
                          <span className="mt-0.5 block text-base">
                            {item.note}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-14 text-[17px]">
            Questions about an order?
            <br />
            <a
              href={`mailto:${contactEmail}`}
              className="underline underline-offset-4"
            >
              {contactEmail}
            </a>
          </p>
          <Scallops edge="bottom" />
        </div>
      </div>
    </section>
  );
}
