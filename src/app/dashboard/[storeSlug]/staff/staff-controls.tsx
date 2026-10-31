"use client";

import { ActionForm } from "@/components/action-form";
import { SelectField, TextField } from "@/components/ui/field";
import {
  fieldErrorsOf,
  submittedValue,
  type FormState,
} from "@/lib/form-state";

type BoundAction = (
  previous: FormState,
  formData: FormData,
) => Promise<FormState>;
type RoleOption = { value: string; label: string };

export function InviteForm({
  action,
  roles,
}: {
  action: BoundAction;
  roles: RoleOption[];
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Send invitation"
      pendingLabel="Sending…"
      variant="primary"
    >
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="off"
            defaultValue={submittedValue(state, "email")}
            errors={fieldErrorsOf(state, "email")}
          />
          <SelectField
            label="Role"
            name="role"
            defaultValue={submittedValue(state, "role", "FULFILLMENT_AGENT")}
            errors={fieldErrorsOf(state, "role")}
            options={roles}
          />
        </div>
      )}
    </ActionForm>
  );
}

export function RoleForm({
  action,
  roles,
  current,
}: {
  action: BoundAction;
  roles: RoleOption[];
  current: string;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Change role"
      pendingLabel="Saving…"
      className="flex flex-wrap items-end gap-2"
    >
      {() => (
        <div className="min-w-44">
          <SelectField
            label="Role"
            name="role"
            defaultValue={current}
            options={roles}
          />
        </div>
      )}
    </ActionForm>
  );
}

export function ConfirmButton({
  action,
  label,
  pendingLabel,
}: {
  action: BoundAction;
  label: string;
  pendingLabel: string;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel={label}
      pendingLabel={pendingLabel}
    />
  );
}
