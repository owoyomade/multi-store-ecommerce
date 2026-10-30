"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState, submittedValue } from "@/lib/form-state";
import type { ProductDetailsInput } from "@/lib/validation/catalog";
import { updateProductDetailsAction } from "../actions";

const statusOptions = [
  { value: "DRAFT", label: "Draft — hidden from shoppers" },
  { value: "PUBLISHED", label: "Published — visible on your storefront" },
  { value: "ARCHIVED", label: "Archived — hidden, kept for records" },
];

type DetailsFormProps = {
  storeSlug: string;
  productId: string;
  initialValues: Required<ProductDetailsInput>;
};

// Uncontrolled inputs: after a successful save the page is revalidated and
// sends back the saved values; after a failed save the submitted values are
// put back so nothing the merchant typed is lost.
export function DetailsForm({
  storeSlug,
  productId,
  initialValues,
}: DetailsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProductDetailsAction.bind(null, storeSlug, productId),
    idleFormState,
  );
  const errors = (field: string) => fieldErrorsOf(state, field);
  const value = (field: keyof DetailsFormProps["initialValues"]) =>
    submittedValue(state, field, initialValues[field]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    >
      <h2 className="font-semibold">Details</h2>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      <TextField
        label="Title"
        name="title"
        required
        defaultValue={value("title")}
        errors={errors("title")}
      />
      <TextField
        label="URL"
        name="slug"
        required
        defaultValue={value("slug")}
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
        defaultValue={value("status")}
        errors={errors("status")}
      />
      <details className="rounded-md border border-stone-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Search engine listing
        </summary>
        <div className="mt-3 space-y-4">
          <TextField
            label="Page title"
            name="seoTitle"
            defaultValue={value("seoTitle")}
            hint="Leave empty to use the product title."
            errors={errors("seoTitle")}
          />
          <TextAreaField
            label="Meta description"
            name="seoDescription"
            rows={2}
            defaultValue={value("seoDescription")}
            hint="Leave empty to use the start of the description."
            errors={errors("seoDescription")}
          />
        </div>
      </details>
      <Button type="submit" pending={pending} pendingLabel="Saving…">
        Save details
      </Button>
    </form>
  );
}
