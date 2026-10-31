"use client";

import { ActionForm } from "@/components/action-form";
import { SelectField, TextField } from "@/components/ui/field";
import {
  fieldErrorsOf,
  submittedValue,
  type FormState,
} from "@/lib/form-state";
import { MANUAL_STOCK_REASONS } from "@/lib/validation/stock";

type AdjustStockFormProps = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
};

export function AdjustStockForm({ action }: AdjustStockFormProps) {
  return (
    <ActionForm
      action={action}
      submitLabel="Save change"
      pendingLabel="Saving…"
      variant="primary"
    >
      {(state) => (
        <>
          <TextField
            label="Change"
            name="change"
            inputMode="numeric"
            required
            placeholder="24"
            hint="Units to add. Use a minus sign to remove, e.g. -2."
            defaultValue={submittedValue(state, "change")}
            errors={fieldErrorsOf(state, "change")}
          />
          <SelectField
            label="Reason"
            name="reason"
            defaultValue={submittedValue(state, "reason", "RESTOCK")}
            errors={fieldErrorsOf(state, "reason")}
            options={Object.entries(MANUAL_STOCK_REASONS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
          <TextField
            label="Note"
            name="note"
            maxLength={200}
            placeholder="PO 1042, two damaged in transit"
            hint="Optional. Shown in this item's history."
            defaultValue={submittedValue(state, "note")}
            errors={fieldErrorsOf(state, "note")}
          />
        </>
      )}
    </ActionForm>
  );
}
