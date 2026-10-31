"use client";

import { ActionForm } from "@/components/action-form";
import { SelectField, TextField } from "@/components/ui/field";
import {
  fieldErrorsOf,
  submittedValue,
  type FormState,
} from "@/lib/form-state";

type DiscountFormProps = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  currency: string;
};

export function DiscountForm({ action, currency }: DiscountFormProps) {
  return (
    <ActionForm
      action={action}
      submitLabel="Create code"
      pendingLabel="Creating…"
      variant="primary"
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Code"
              name="code"
              required
              placeholder="WELCOME10"
              hint="Shoppers type this at checkout. Capital letters don't matter."
              defaultValue={submittedValue(state, "code")}
              errors={fieldErrorsOf(state, "code")}
            />
          </div>
          <SelectField
            label="Type"
            name="kind"
            defaultValue={submittedValue(state, "kind", "PERCENT")}
            options={[
              { value: "PERCENT", label: "Percent off" },
              { value: "FIXED", label: `Amount off (${currency})` },
            ]}
          />
          <TextField
            label="Discount"
            name="amount"
            inputMode="decimal"
            required
            placeholder="10"
            defaultValue={submittedValue(state, "amount")}
            errors={fieldErrorsOf(state, "amount")}
          />
          <TextField
            label="Minimum order"
            name="minSubtotal"
            inputMode="decimal"
            hint="Optional. Goods total needed before the code works."
            defaultValue={submittedValue(state, "minSubtotal")}
            errors={fieldErrorsOf(state, "minSubtotal")}
          />
          <TextField
            label="Total uses allowed"
            name="usageLimit"
            inputMode="numeric"
            hint="Optional. Leave empty for no limit."
            defaultValue={submittedValue(state, "usageLimit")}
            errors={fieldErrorsOf(state, "usageLimit")}
          />
          <TextField
            label="Starts"
            name="startsAt"
            type="datetime-local"
            hint="Optional. Leave empty to start now."
            defaultValue={submittedValue(state, "startsAt")}
            errors={fieldErrorsOf(state, "startsAt")}
          />
          <TextField
            label="Ends"
            name="endsAt"
            type="datetime-local"
            hint="Optional. Leave empty to run until you pause it."
            defaultValue={submittedValue(state, "endsAt")}
            errors={fieldErrorsOf(state, "endsAt")}
          />
        </div>
      )}
    </ActionForm>
  );
}
