"use client";

import { useActionState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { idleFormState, type FormState } from "@/lib/form-state";

type ActionFormProps = {
  /** A server action with its leading arguments (store, record ID) already bound. */
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  /** Fields can read the last result, e.g. to show errors or keep typed values. */
  children?: (state: FormState) => ReactNode;
  className?: string;
};

/** A small form for one dashboard action, with its own pending and result messages. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  variant = "secondary",
  children,
  className = "space-y-3",
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, idleFormState);
  return (
    <form action={formAction} className={className}>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}
      {children?.(state)}
      <Button
        type="submit"
        variant={variant}
        pending={pending}
        pendingLabel={pendingLabel}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
