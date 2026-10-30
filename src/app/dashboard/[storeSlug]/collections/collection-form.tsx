"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState, submittedValue } from "@/lib/form-state";
import { suggestSlug } from "@/lib/validation/store";
import { createCollectionAction, updateCollectionAction } from "./actions";

type CollectionFormProps = {
  storeSlug: string;
  /** When given, the form edits this collection; otherwise it creates a new one. */
  collection?: { id: string; title: string; slug: string; description: string };
};

export function CollectionForm({ storeSlug, collection }: CollectionFormProps) {
  const action = collection
    ? updateCollectionAction.bind(null, storeSlug, collection.id)
    : createCollectionAction.bind(null, storeSlug);
  const [state, formAction, pending] = useActionState(action, idleFormState);
  const [title, setTitle] = useState(collection?.title ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(collection));
  const errors = (field: string) => fieldErrorsOf(state, field);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Title"
          name="title"
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugTouched) setSlug(suggestSlug(event.target.value));
          }}
          errors={errors("title")}
        />
        <TextField
          label="URL"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          errors={errors("slug")}
        />
      </div>
      <TextAreaField
        label="Description"
        name="description"
        rows={2}
        defaultValue={submittedValue(
          state,
          "description",
          collection?.description,
        )}
        errors={errors("description")}
      />
      <Button
        type="submit"
        variant={collection ? "secondary" : "primary"}
        pending={pending}
        pendingLabel="Saving…"
      >
        {collection ? "Save collection" : "Create collection"}
      </Button>
    </form>
  );
}
