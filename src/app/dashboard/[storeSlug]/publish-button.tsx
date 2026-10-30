"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { idleFormState } from "@/lib/form-state";
import { setStorePublishedAction } from "./actions";

export function PublishButton({
  storeSlug,
  isPublished,
}: {
  storeSlug: string;
  isPublished: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setStorePublishedAction.bind(null, storeSlug, !isPublished),
    idleFormState,
  );

  return (
    <form action={formAction} className="space-y-2">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      <Button
        type="submit"
        variant={isPublished ? "secondary" : "primary"}
        pending={pending}
        pendingLabel={isPublished ? "Unpublishing…" : "Publishing…"}
      >
        {isPublished ? "Unpublish store" : "Publish store"}
      </Button>
    </form>
  );
}
