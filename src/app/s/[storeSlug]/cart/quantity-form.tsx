"use client";

import { useActionState } from "react";
import { idleFormState } from "@/lib/form-state";
import { updateCartItemAction } from "../actions";

type QuantityFormProps = {
  storeSlug: string;
  itemId: string;
  quantity: number;
  label: string;
};

// Submits as soon as the shopper picks a new quantity. Without JavaScript,
// the <noscript> Update button submits instead.
export function QuantityForm({
  storeSlug,
  itemId,
  quantity,
  label,
}: QuantityFormProps) {
  const [state, formAction, pending] = useActionState(
    updateCartItemAction.bind(null, storeSlug, itemId),
    idleFormState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={`qty-${itemId}`} className="sr-only">
          Quantity of {label}
        </label>
        <select
          id={`qty-${itemId}`}
          name="quantity"
          defaultValue={quantity}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          disabled={pending}
          className="rounded-[var(--sf-radius)] border border-current/25 bg-white px-2 py-2 text-sm text-stone-900"
        >
          {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="text-sm underline">
            Update
          </button>
        </noscript>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
