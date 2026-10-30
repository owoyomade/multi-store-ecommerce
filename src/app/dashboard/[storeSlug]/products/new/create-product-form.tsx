"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/field";
import {
  fieldErrorsOf,
  idleFormState,
  submittedChecked,
  submittedValue,
} from "@/lib/form-state";
import { suggestSlug } from "@/lib/validation/store";
import { createProductAction } from "../actions";

const statusOptions = [
  { value: "DRAFT", label: "Draft — hidden from shoppers" },
  { value: "PUBLISHED", label: "Published — visible on your storefront" },
];

function suggestSkuPrefix(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 4))
    .join("-")
    .slice(0, 20);
}

export function CreateProductForm({
  storeSlug,
  currency,
}: {
  storeSlug: string;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(
    createProductAction.bind(null, storeSlug),
    idleFormState,
  );
  // Title drives the URL and SKU suggestions until the merchant edits them.
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [skuPrefix, setSkuPrefix] = useState("");
  const [touched, setTouched] = useState({ slug: false, sku: false });
  const errors = (field: string) => fieldErrorsOf(state, field);
  const value = (field: string, fallback: string | number = "") =>
    submittedValue(state, field, fallback);

  function updateTitle(value: string) {
    setTitle(value);
    if (!touched.slug) setSlug(suggestSlug(value));
    if (!touched.sku) setSkuPrefix(suggestSkuPrefix(value));
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Details</legend>
        <TextField
          label="Title"
          name="title"
          required
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          errors={errors("title")}
        />
        <TextField
          label="URL"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setTouched((t) => ({ ...t, slug: true }));
            setSlug(e.target.value);
          }}
          hint={`Shoppers will find it at /products/${slug || "your-product"}`}
          errors={errors("slug")}
        />
        <TextAreaField
          label="Description"
          name="description"
          defaultValue={value("description")}
          errors={errors("description")}
        />
        <SelectField
          label="Visibility"
          name="status"
          options={statusOptions}
          defaultValue={value("status", "DRAFT")}
          errors={errors("status")}
        />
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">
          Pricing and stock
        </legend>
        <TextField
          label={`Price (${currency})`}
          name="price"
          defaultValue={value("price")}
          inputMode="decimal"
          required
          placeholder="24.00"
          errors={errors("price")}
        />
        <TextField
          label={`Compare-at price (${currency})`}
          name="compareAtPrice"
          defaultValue={value("compareAtPrice")}
          inputMode="decimal"
          placeholder="Optional"
          hint="Shown crossed out to signal a sale."
          errors={errors("compareAtPrice")}
        />
        <TextField
          label="SKU prefix"
          name="skuPrefix"
          required
          value={skuPrefix}
          onChange={(e) => {
            setTouched((t) => ({ ...t, sku: true }));
            setSkuPrefix(e.target.value);
          }}
          hint="Variant SKUs are built from this, e.g. TEE-M-BLACK."
          errors={errors("skuPrefix")}
        />
        <TextField
          label="Starting stock per variant"
          name="initialStock"
          type="number"
          min={0}
          defaultValue={value("initialStock", 0)}
          errors={errors("initialStock")}
        />
        <div className="sm:col-span-2">
          <CheckboxField
            label="Track stock for this product"
            name="trackInventory"
            defaultChecked={submittedChecked(state, "trackInventory", true)}
            hint="Untick for made-to-order or digital items."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">
          Options (optional)
        </legend>
        <p className="text-sm text-stone-600">
          Add options like size or colour. A variant is created for every
          combination. Options can&apos;t be changed after the product is
          created.
        </p>
        {[1, 2].map((index) => (
          <div key={index} className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <TextField
              label={`Option ${index} name`}
              name={`option${index}Name`}
              defaultValue={value(`option${index}Name`)}
              placeholder={index === 1 ? "Size" : "Colour"}
              errors={errors(`option${index}Name`)}
            />
            <TextField
              label={`Option ${index} values`}
              name={`option${index}Values`}
              defaultValue={value(`option${index}Values`)}
              placeholder={index === 1 ? "S, M, L" : "Black, White"}
              hint="Separate values with commas."
              errors={errors(`option${index}Values`)}
            />
          </div>
        ))}
      </fieldset>

      <Button type="submit" pending={pending} pendingLabel="Creating product…">
        Create product
      </Button>
    </form>
  );
}
