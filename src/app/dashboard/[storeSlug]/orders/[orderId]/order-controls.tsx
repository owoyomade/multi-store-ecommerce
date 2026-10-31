"use client";

import { ActionForm } from "@/components/action-form";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/field";
import type { FormState } from "@/lib/form-state";
import { fieldErrorsOf, submittedValue } from "@/lib/form-state";

type BoundAction = (
  previous: FormState,
  formData: FormData,
) => Promise<FormState>;

export function ShipForm({ action }: { action: BoundAction }) {
  return (
    <ActionForm
      action={action}
      submitLabel="Mark as shipped"
      pendingLabel="Saving…"
      variant="primary"
    >
      {(state) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Carrier"
            name="carrier"
            required
            placeholder="Canada Post"
            defaultValue={submittedValue(state, "carrier")}
            errors={fieldErrorsOf(state, "carrier")}
          />
          <TextField
            label="Tracking number"
            name="trackingNumber"
            required
            defaultValue={submittedValue(state, "trackingNumber")}
            errors={fieldErrorsOf(state, "trackingNumber")}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Tracking link"
              name="trackingUrl"
              type="url"
              placeholder="https://"
              hint="Optional. Included in the email to the customer."
              defaultValue={submittedValue(state, "trackingUrl")}
              errors={fieldErrorsOf(state, "trackingUrl")}
            />
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function RefundForm({
  action,
  remaining,
}: {
  action: BoundAction;
  remaining: string;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Issue refund"
      pendingLabel="Refunding…"
    >
      {(state) => (
        <>
          <TextField
            label="Amount"
            name="amount"
            inputMode="decimal"
            required
            defaultValue={submittedValue(state, "amount", remaining)}
            hint={`Up to ${remaining} can still be refunded.`}
            errors={fieldErrorsOf(state, "amountCents")}
          />
          <TextField
            label="Reason"
            name="reason"
            required
            defaultValue={submittedValue(state, "reason")}
            hint="Recorded in the order history."
            errors={fieldErrorsOf(state, "reason")}
          />
          <CheckboxField
            label="Put the items back in stock"
            name="restock"
            hint="Only once per order, for items that came back unused."
          />
        </>
      )}
    </ActionForm>
  );
}

export function CancelForm({
  action,
  paid,
}: {
  action: BoundAction;
  paid: boolean;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Cancel order"
      pendingLabel="Cancelling…"
    >
      {(state) => (
        <>
          <p className="text-sm text-stone-600">
            {paid
              ? "The customer is refunded in full and the items go back into stock."
              : "The order is closed and its reserved stock is released."}
          </p>
          <TextField
            label="Reason"
            name="reason"
            defaultValue={submittedValue(state, "reason")}
          />
        </>
      )}
    </ActionForm>
  );
}

export function NoteForm({ action }: { action: BoundAction }) {
  return (
    <ActionForm action={action} submitLabel="Add note" pendingLabel="Saving…">
      {() => (
        <TextAreaField
          label="Internal note"
          name="body"
          rows={3}
          required
          hint="Only your team can see notes."
        />
      )}
    </ActionForm>
  );
}

export function StatusButton({
  action,
  label,
}: {
  action: BoundAction;
  label: string;
}) {
  return (
    <ActionForm action={action} submitLabel={label} pendingLabel="Saving…" />
  );
}
