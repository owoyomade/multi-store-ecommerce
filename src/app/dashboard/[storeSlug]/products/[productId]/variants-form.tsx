"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  idleFormState,
  submittedChecked,
  submittedValue,
} from "@/lib/form-state";
import { updateVariantsAction } from "../actions";

type VariantRow = {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: number;
  reserved: number;
  trackInventory: boolean;
};

type VariantsFormProps = {
  storeSlug: string;
  productId: string;
  currency: string;
  optionNames: string[];
  variants: VariantRow[];
};

const cellInput =
  "w-full min-w-20 rounded-md border border-stone-300 px-2 py-1.5 text-sm";

export function VariantsForm({
  storeSlug,
  productId,
  currency,
  optionNames,
  variants,
}: VariantsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateVariantsAction.bind(null, storeSlug, productId),
    idleFormState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    >
      <div>
        <h2 className="font-semibold">
          {variants.length > 1 ? "Variants" : "Pricing and stock"}
        </h2>
        {optionNames.length > 0 && (
          <p className="text-sm text-stone-600">
            Options: {optionNames.join(", ")}
          </p>
        )}
      </div>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-stone-500 uppercase">
            <tr>
              <th scope="col" className="py-2 pr-3">
                Variant
              </th>
              <th scope="col" className="py-2 pr-3">
                SKU
              </th>
              <th scope="col" className="py-2 pr-3">
                Price ({currency})
              </th>
              <th scope="col" className="py-2 pr-3">
                Compare-at
              </th>
              <th scope="col" className="py-2 pr-3">
                On hand
              </th>
              <th scope="col" className="py-2">
                Track
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {variants.map((variant) => (
              <tr key={variant.id}>
                <th scope="row" className="py-2 pr-3 font-medium">
                  <input type="hidden" name="variantId" value={variant.id} />
                  {variant.title}
                </th>
                <td className="py-2 pr-3">
                  <input
                    name={`sku-${variant.id}`}
                    defaultValue={submittedValue(
                      state,
                      `sku-${variant.id}`,
                      variant.sku,
                    )}
                    aria-label={`SKU for ${variant.title}`}
                    className={cellInput}
                    required
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`price-${variant.id}`}
                    defaultValue={submittedValue(
                      state,
                      `price-${variant.id}`,
                      variant.price,
                    )}
                    inputMode="decimal"
                    aria-label={`Price for ${variant.title}`}
                    className={cellInput}
                    required
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`compareAtPrice-${variant.id}`}
                    defaultValue={submittedValue(
                      state,
                      `compareAtPrice-${variant.id}`,
                      variant.compareAtPrice,
                    )}
                    inputMode="decimal"
                    aria-label={`Compare-at price for ${variant.title}`}
                    className={cellInput}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    name={`stock-${variant.id}`}
                    type="number"
                    min={0}
                    defaultValue={submittedValue(
                      state,
                      `stock-${variant.id}`,
                      variant.stock,
                    )}
                    aria-label={`Units on hand for ${variant.title}`}
                    className={cellInput}
                  />
                  {variant.reserved > 0 && (
                    <span className="mt-1 block text-xs text-stone-500">
                      {variant.reserved} reserved
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    name={`trackInventory-${variant.id}`}
                    defaultChecked={submittedChecked(
                      state,
                      `trackInventory-${variant.id}`,
                      variant.trackInventory,
                    )}
                    aria-label={`Track stock for ${variant.title}`}
                    className="size-4 accent-stone-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">
        Changing “On hand” records a stock adjustment in the inventory ledger.
      </p>
      <Button type="submit" pending={pending} pendingLabel="Saving…">
        Save variants
      </Button>
    </form>
  );
}
