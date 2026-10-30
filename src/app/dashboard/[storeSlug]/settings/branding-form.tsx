"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState } from "@/lib/form-state";
import type { UpdateStoreBrandingInput } from "@/lib/validation/store";
import { updateBrandingAction } from "./actions";

type BrandingFormProps = {
  storeSlug: string;
  initialValues: UpdateStoreBrandingInput;
};

export function BrandingForm({ storeSlug, initialValues }: BrandingFormProps) {
  const [state, formAction, pending] = useActionState(
    updateBrandingAction.bind(null, storeSlug),
    idleFormState,
  );
  const [values, setValues] = useState(initialValues);

  function update(field: keyof UpdateStoreBrandingInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    >
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      <TextField
        label="Store name"
        name="name"
        required
        value={values.name}
        onChange={(event) => update("name", event.target.value)}
        errors={fieldErrorsOf(state, "name")}
      />
      <TextField
        label="Contact email"
        name="contactEmail"
        type="email"
        required
        value={values.contactEmail}
        onChange={(event) => update("contactEmail", event.target.value)}
        errors={fieldErrorsOf(state, "contactEmail")}
      />
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
      <SelectField
        label="Storefront style"
        name="theme"
        options={[
          { value: "CLASSIC", label: "Classic — serif headings, soft corners" },
          { value: "BOLD", label: "Bold — uppercase type, sharp corners" },
        ]}
        value={values.theme}
        onChange={(event) => update("theme", event.target.value)}
        errors={fieldErrorsOf(state, "theme")}
      />
      <TextField
        label="Tagline"
        name="tagline"
        maxLength={120}
        value={values.tagline}
        onChange={(event) => update("tagline", event.target.value)}
        hint="One line shown at the top of your storefront."
        errors={fieldErrorsOf(state, "tagline")}
      />
      <Button type="submit" pending={pending} pendingLabel="Saving…">
        Save settings
      </Button>
    </form>
  );
}
