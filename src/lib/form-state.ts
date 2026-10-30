/** Result returned by server actions to the forms that called them. */
export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
      // What the user submitted. React resets a form after its action runs,
      // so forms use these as default values to keep the user's input on errors.
      values?: Record<string, string>;
    }
  | { status: "success"; message: string };

export const idleFormState: FormState = { status: "idle" };

export function fieldErrorsOf(
  state: FormState,
  field: string,
): string[] | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}

/** The submitted value after a failed save, otherwise `fallback`. */
export function submittedValue(
  state: FormState,
  field: string,
  fallback: string | number = "",
): string {
  if (state.status === "error" && state.values)
    return state.values[field] ?? "";
  return String(fallback);
}

/** Checkbox equivalent of submittedValue: unticked boxes aren't submitted at all. */
export function submittedChecked(
  state: FormState,
  field: string,
  fallback: boolean,
): boolean {
  if (state.status === "error" && state.values)
    return state.values[field] === "on";
  return fallback;
}
