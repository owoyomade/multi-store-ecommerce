/** Result returned by server actions to the forms that called them. */
export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | { status: "success"; message: string };

export const idleFormState: FormState = { status: "idle" };

export function fieldErrorsOf(
  state: FormState,
  field: string,
): string[] | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}
