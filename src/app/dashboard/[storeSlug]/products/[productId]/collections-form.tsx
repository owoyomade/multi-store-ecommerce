"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/field";
import { idleFormState } from "@/lib/form-state";
import { setProductCollectionsAction } from "../actions";

type CollectionsFormProps = {
  storeSlug: string;
  productId: string;
  collections: { id: string; title: string }[];
  selectedIds: string[];
};

export function CollectionsForm({
  storeSlug,
  productId,
  collections,
  selectedIds,
}: CollectionsFormProps) {
  const [state, formAction, pending] = useActionState(
    setProductCollectionsAction.bind(null, storeSlug, productId),
    idleFormState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    >
      <h2 className="font-semibold">Collections</h2>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      {collections.length === 0 ? (
        <p className="text-sm text-stone-600">
          This store has no collections yet.{" "}
          <Link
            href={`/dashboard/${storeSlug}/collections`}
            className="underline"
          >
            Create one
          </Link>{" "}
          to group products on your storefront.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {collections.map((collection) => (
              <CheckboxField
                key={collection.id}
                label={collection.title}
                name="collectionId"
                value={collection.id}
                defaultChecked={selectedIds.includes(collection.id)}
              />
            ))}
          </div>
          <Button
            type="submit"
            variant="secondary"
            pending={pending}
            pendingLabel="Saving…"
          >
            Save collections
          </Button>
        </>
      )}
    </form>
  );
}
