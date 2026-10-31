"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCartAction } from "@/app/s/[storeSlug]/actions";
import { idleFormState } from "@/lib/form-state";
import { formatMoney } from "@/lib/money";

type Variant = {
  id: string;
  optionValues: string[];
  priceCents: number;
  compareAtPriceCents: number | null;
  available: number | null;
};

type FeaturedProductProps = {
  /** "split": full-width section, picture beside the text. "stacked": one column, for a half-width layout. */
  layout: "split" | "stacked";
  storeSlug: string;
  currency: string;
  detailHref: string;
  cartHref: string;
  product: {
    title: string;
    description: string;
    options: { name: string; values: string[] }[];
    variants: Variant[];
    image: { storageKey: string; altText: string } | null;
  };
};

/**
 * One product shown in full, buyable right here: choose its options, see the
 * price and stock change, add it to the cart without leaving the homepage.
 */
export function FeaturedProduct({
  layout,
  storeSlug,
  currency,
  detailHref,
  cartHref,
  product,
}: FeaturedProductProps) {
  const [state, formAction, pending] = useActionState(
    addToCartAction.bind(null, storeSlug),
    idleFormState,
  );
  const firstAvailable =
    product.variants.find((variant) => variant.available !== 0) ??
    product.variants[0];
  const [selected, setSelected] = useState<string[]>(
    firstAvailable?.optionValues ?? [],
  );

  const variant = product.variants.find((candidate) =>
    candidate.optionValues.every((value, index) => value === selected[index]),
  );
  const soldOut = !variant || variant.available === 0;
  const firstSentence = product.description.split(/(?<=\.)\s/)[0] ?? "";

  return (
    <section
      aria-labelledby="featured-title"
      className={
        layout === "split"
          ? "sf-bleed bg-[var(--sf-paper-deep)]"
          : "bg-[var(--sf-paper-deep)]"
      }
    >
      <div
        className={
          layout === "split"
            ? "sf-container grid gap-10 py-20 md:min-h-[88svh] md:grid-cols-2 md:items-center md:gap-16 md:py-28"
            : "grid gap-10 p-6 sm:p-10"
        }
      >
        <div
          data-reveal
          style={{ ["--reveal-order" as string]: 0 }}
          className="aspect-square w-full overflow-hidden bg-[var(--sf-paper)]"
        >
          {product.image && (
            <Image
              src={`/media/${product.image.storageKey}`}
              alt={product.image.altText || product.title}
              width={1000}
              height={1000}
              sizes="(min-width: 768px) 45vw, 100vw"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <form action={formAction} className="flex flex-col gap-10">
          <div data-reveal style={{ ["--reveal-order" as string]: 1 }}>
            <h2
              id="featured-title"
              className="sf-heading text-[clamp(32px,3vw,44px)] leading-[1.05]"
            >
              {product.title}
            </h2>
            <p className="mt-5 max-w-[38ch] text-[17px] leading-relaxed">
              {firstSentence}
            </p>
          </div>
          <div
            data-reveal
            style={{ ["--reveal-order" as string]: 2 }}
            className="space-y-5"
          >
            {product.options.map((option, optionIndex) => (
              <fieldset key={option.name}>
                <legend className="mb-2 text-[17px] font-semibold">
                  {option.name}
                </legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {option.values.map((value) => {
                    const active = selected[optionIndex] === value;
                    return (
                      <label
                        key={value}
                        className={`cursor-pointer text-[17px] underline-offset-8 has-focus-visible:outline-2 ${
                          active
                            ? "text-[var(--sf-ink)] underline decoration-2"
                            : "text-[var(--sf-muted)] hover:text-[var(--sf-ink)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`featured-option-${optionIndex}`}
                          value={value}
                          checked={active}
                          onChange={() =>
                            setSelected((current) =>
                              current.map((v, index) =>
                                index === optionIndex ? value : v,
                              ),
                            )
                          }
                          className="sr-only"
                        />
                        {value}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div data-reveal style={{ ["--reveal-order" as string]: 3 }}>
            <p className="text-[22px]" aria-live="polite">
              {variant
                ? formatMoney(variant.priceCents, currency)
                : "Unavailable"}
              {variant?.compareAtPriceCents &&
              variant.compareAtPriceCents > variant.priceCents ? (
                <s className="ml-3 text-[17px] text-[var(--sf-muted)]">
                  <span className="sr-only">Was </span>
                  {formatMoney(variant.compareAtPriceCents, currency)}
                </s>
              ) : null}
              <span className="ml-3 text-[17px]">
                {soldOut
                  ? "Sold out"
                  : variant?.available !== null && variant.available <= 5
                    ? `Only ${variant.available} left`
                    : "In stock"}
              </span>
            </p>
          </div>

          <div data-reveal style={{ ["--reveal-order" as string]: 4 }}>
            <input type="hidden" name="variantId" value={variant?.id ?? ""} />
            <input type="hidden" name="quantity" value="1" />
            <div className="grid grid-cols-2">
              <button
                type="submit"
                disabled={soldOut || pending}
                className="flex h-[72px] items-center justify-center bg-[var(--sf-primary)] text-[17px] text-[var(--sf-on-primary)] transition-colors hover:bg-[var(--sf-accent)] hover:text-[var(--sf-on-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {soldOut ? "Sold out" : pending ? "Adding…" : "Add to cart"}
              </button>
              <Link
                href={detailHref}
                className="flex h-[72px] items-center justify-center bg-[var(--sf-paper)] text-[17px] transition-colors hover:bg-[var(--sf-ink)] hover:text-[var(--sf-paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-ink)]"
              >
                Full details
              </Link>
            </div>
            {state.status === "error" && (
              <p role="alert" className="mt-3 text-[17px] text-red-800">
                {state.message}
              </p>
            )}
            {state.status === "success" && (
              <p role="status" className="mt-3 text-[17px]">
                {state.message}{" "}
                <Link href={cartHref} className="underline underline-offset-4">
                  View cart
                </Link>
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
