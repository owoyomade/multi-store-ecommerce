"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState } from "@/lib/form-state";
import {
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  suggestSlug,
} from "@/lib/validation/store";
import { createStoreAction } from "./actions";

const currencyOptions = SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: code,
}));
const countryOptions = Object.entries(SUPPORTED_COUNTRIES).map(
  ([code, name]) => ({ value: code, label: name }),
);

export function CreateStoreForm() {
  const [state, formAction, pending] = useActionState(
    createStoreAction,
    idleFormState,
  );
  // Fields are controlled so values survive a failed submit (React resets
  // uncontrolled inputs after a form action) and so the preview can update live.
  const [values, setValues] = useState({
    name: "",
    slug: "",
    currency: "CAD",
    country: "CA",
    contactEmail: "",
    primaryColor: "#1f2937",
    accentColor: "#f59e0b",
  });
  const [slugEditedByHand, setSlugEditedByHand] = useState(false);

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateName(name: string) {
    setValues((current) => ({
      ...current,
      name,
      slug: slugEditedByHand ? current.slug : suggestSlug(name),
    }));
  }

  return (
    <form action={formAction} className="space-y-8">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">1. Store details</legend>
        <TextField
          label="Store name"
          name="name"
          required
          value={values.name}
          onChange={(event) => updateName(event.target.value)}
          errors={fieldErrorsOf(state, "name")}
        />
        <TextField
          label="Store address"
          name="slug"
          required
          value={values.slug}
          onChange={(event) => {
            setSlugEditedByHand(true);
            update("slug", event.target.value);
          }}
          hint={`Your store will live at /s/${values.slug || "your-store"}`}
          errors={fieldErrorsOf(state, "slug")}
        />
        <TextField
          label="Contact email"
          name="contactEmail"
          type="email"
          required
          value={values.contactEmail}
          onChange={(event) => update("contactEmail", event.target.value)}
          hint="Shown to customers who need help with an order."
          errors={fieldErrorsOf(state, "contactEmail")}
        />
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">2. Region</legend>
        <SelectField
          label="Country"
          name="country"
          options={countryOptions}
          value={values.country}
          onChange={(event) => update("country", event.target.value)}
          errors={fieldErrorsOf(state, "country")}
        />
        <SelectField
          label="Currency"
          name="currency"
          options={currencyOptions}
          value={values.currency}
          onChange={(event) => update("currency", event.target.value)}
          hint="All prices in this store use this currency."
          errors={fieldErrorsOf(state, "currency")}
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">3. Branding</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Primary colour"
            name="primaryColor"
            type="color"
            className="h-10 p-1"
            value={values.primaryColor}
            onChange={(event) => update("primaryColor", event.target.value)}
            errors={fieldErrorsOf(state, "primaryColor")}
          />
          <TextField
            label="Accent colour"
            name="accentColor"
            type="color"
            className="h-10 p-1"
            value={values.accentColor}
            onChange={(event) => update("accentColor", event.target.value)}
            errors={fieldErrorsOf(state, "accentColor")}
          />
        </div>
        <div
          aria-hidden
          className="overflow-hidden rounded-lg border border-stone-200"
        >
          <div
            className="px-4 py-3 font-semibold text-white"
            style={{ backgroundColor: values.primaryColor }}
          >
            {values.name || "Your store"}
          </div>
          <div className="flex items-center justify-between bg-white px-4 py-4 text-sm">
            <span>Preview of your header and buttons</span>
            <span
              className="rounded-md px-3 py-1.5 font-medium text-white"
              style={{ backgroundColor: values.accentColor }}
            >
              Add to cart
            </span>
          </div>
        </div>
      </fieldset>

      <Button type="submit" pending={pending} pendingLabel="Creating store…">
        Create store
      </Button>
    </form>
  );
}
