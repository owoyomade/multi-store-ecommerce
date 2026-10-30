import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const controlClasses =
  "block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 aria-invalid:border-red-600";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
};

// Wires label, hint and error text to the control with ids so screen readers
// announce them together.
function FieldShell({ id, label, hint, errors, children }: FieldShellProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
      {hint && !errors?.length && (
        <p id={`${id}-hint`} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(
  id: string,
  hint?: string,
  errors?: string[],
): string | undefined {
  if (errors?.length) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  errors?: string[];
};

export function TextField({
  label,
  hint,
  errors,
  className = "",
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors}>
      <input
        id={id}
        className={`${controlClasses} ${className}`}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        {...inputProps}
      />
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  errors?: string[];
  options: { value: string; label: string }[];
};

export function SelectField({
  label,
  hint,
  errors,
  options,
  ...selectProps
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors}>
      <select
        id={id}
        className={controlClasses}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  errors?: string[];
};

export function TextAreaField({
  label,
  hint,
  errors,
  ...textareaProps
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors}>
      <textarea
        id={id}
        rows={5}
        className={controlClasses}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        {...textareaProps}
      />
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  hint?: string;
};

export function CheckboxField({
  label,
  hint,
  ...inputProps
}: CheckboxFieldProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-stone-300 accent-stone-900"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...inputProps}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-stone-800">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-stone-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
