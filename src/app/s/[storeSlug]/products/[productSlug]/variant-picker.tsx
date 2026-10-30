"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatMoney } from "@/lib/money";
import { idleFormState } from "@/lib/form-state";
import { addToCartAction } from "../../actions";

type Variant = {
  id: string;
  title: string;
  optionValues: string[];
  priceCents: number;
  compareAtPriceCents: number | null;
  /** null means stock isn't tracked, so it's always available. */
  available: number | null;
};

type VariantPickerProps = {
  storeSlug: string;
  cartHref: string;
  currency: string;
  options: { name: string; values: string[] }[];
  variants: Variant[];
};

const MAX_QUANTITY = 20;

export function VariantPicker({
  storeSlug,
  cartHref,
  currency,
  options,
  variants,
}: VariantPickerProps) {
  const [state, formAction, pending] = useActionState(
    addToCartAction.bind(null, storeSlug),
    idleFormState,
  );
  // Start on the first variant that's in stock, so shoppers don't land on "Sold out".
  const initial =
    variants.find((variant) => variant.available !== 0) ?? variants[0];
  const [selectedValues, setSelectedValues] = useState<string[]>(
    initial?.optionValues ?? [],
  );

  const selected = variants.find((variant) =>
    variant.optionValues.every(
      (value, index) => value === selectedValues[index],
    ),
  );
  const soldOut = !selected || selected.available === 0;
  const maxQuantity = Math.min(
    selected?.available ?? MAX_QUANTITY,
    MAX_QUANTITY,
  );

  function isValueAvailable(optionIndex: number, value: string): boolean {
    return variants.some(
      (variant) =>
        variant.available !== 0 &&
        variant.optionValues[optionIndex] === value &&
        variant.optionValues.every(
          (other, index) =>
            index === optionIndex || other === selectedValues[index],
        ),
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-6">
      {selected && (
        <p className="text-2xl">
          {formatMoney(selected.priceCents, currency)}
          {selected.compareAtPriceCents !== null &&
            selected.compareAtPriceCents > selected.priceCents && (
              <s className="ml-3 text-lg opacity-60">
                <span className="sr-only">Was </span>
                {formatMoney(selected.compareAtPriceCents, currency)}
              </s>
            )}
        </p>
      )}

      {options.map((option, optionIndex) => (
        <fieldset key={option.name}>
          <legend className="mb-2 text-sm font-medium">
            {option.name}:{" "}
            <span className="opacity-70">{selectedValues[optionIndex]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selectedValues[optionIndex] === value;
              const available = isValueAvailable(optionIndex, value);
              return (
                <label
                  key={value}
                  className={`cursor-pointer rounded-[var(--sf-radius)] border px-4 py-2 text-sm transition-colors has-focus-visible:outline-2 ${
                    isSelected
                      ? "border-[var(--sf-primary)] bg-[var(--sf-primary)] text-[var(--sf-on-primary)]"
                      : "border-current/25 hover:border-current/60"
                  } ${available ? "" : "line-through opacity-50"}`}
                >
                  <input
                    type="radio"
                    name={`option-${optionIndex}`}
                    value={value}
                    checked={isSelected}
                    onChange={() =>
                      setSelectedValues((current) =>
                        current.map((v, index) =>
                          index === optionIndex ? value : v,
                        ),
                      )
                    }
                    className="sr-only"
                  />
                  {value}
                  {!available && <span className="sr-only"> (sold out)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <input type="hidden" name="variantId" value={selected?.id ?? ""} />

      <p className="text-sm" aria-live="polite">
        {soldOut
          ? "Sold out"
          : selected?.available === null
            ? "In stock"
            : selected && selected.available <= 5
              ? `Only ${selected.available} left`
              : "In stock"}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="quantity" className="text-xs opacity-70">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={Math.max(1, maxQuantity)}
            defaultValue={1}
            disabled={soldOut}
            className="w-20 rounded-[var(--sf-radius)] border border-current/25 bg-white px-3 py-2.5 text-stone-900"
          />
        </div>
        <button
          type="submit"
          disabled={soldOut || pending}
          className="flex-1 rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-6 py-3 font-medium text-[var(--sf-on-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {soldOut ? "Sold out" : pending ? "Adding…" : "Add to cart"}
        </button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-sm">
          {state.message}{" "}
          <Link href={cartHref} className="font-medium underline">
            View cart
          </Link>
        </p>
      )}
    </form>
  );
}
