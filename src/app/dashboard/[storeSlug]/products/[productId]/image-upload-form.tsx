"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState, submittedValue } from "@/lib/form-state";
import { uploadProductImageAction } from "../actions";

export function ImageUploadForm({
  storeSlug,
  productId,
}: {
  storeSlug: string;
  productId: string;
}) {
  const [state, formAction, pending] = useActionState(
    uploadProductImageAction.bind(null, storeSlug, productId),
    idleFormState,
  );

  return (
    <form
      action={formAction}
      className="space-y-3 border-t border-stone-100 pt-4"
    >
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Image file"
          name="image"
          type="file"
          // A hint for the file picker only; the server checks the real file contents.
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          hint="JPEG, PNG, WebP or AVIF, up to 4 MB."
          errors={fieldErrorsOf(state, "image")}
        />
        <TextField
          label="Alt text"
          name="altText"
          defaultValue={submittedValue(state, "altText")}
          maxLength={200}
          hint="Describe the photo for shoppers using screen readers."
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        pending={pending}
        pendingLabel="Uploading…"
      >
        Upload image
      </Button>
    </form>
  );
}
