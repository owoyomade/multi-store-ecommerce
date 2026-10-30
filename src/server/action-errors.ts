import "server-only";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import {
  FieldConflictError,
  NotFoundError,
  RuleViolationError,
} from "./errors";
import { ForbiddenError } from "./tenancy/store-context";

/** Text fields from a submitted form; files and Next's internal $ACTION fields are skipped. */
function submittedText(
  formData: FormData | undefined,
): Record<string, string> | undefined {
  if (!formData) return undefined;
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

/** Groups Zod messages by field path, e.g. "price" or "address.city" for nested objects. */
function fieldErrorsByPath(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

/**
 * Converts the errors services throw on purpose into a FormState the form can
 * display, including what the user typed so the form can be refilled.
 * Anything unexpected is re-thrown so it shows up as a real error (and in the
 * logs) instead of being silently swallowed.
 */
export function toErrorFormState(
  error: unknown,
  formData?: FormData,
): FormState {
  const values = submittedText(formData);
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsByPath(error),
      values,
    };
  }
  if (error instanceof FieldConflictError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: { [error.field]: [error.message] },
      values,
    };
  }
  if (error instanceof RuleViolationError) {
    return { status: "error", message: error.message, values };
  }
  if (error instanceof ForbiddenError) {
    return {
      status: "error",
      message: "Your role doesn't allow this action.",
      values,
    };
  }
  if (error instanceof NotFoundError) {
    return {
      status: "error",
      message: "That item no longer exists or isn't part of this store.",
      values,
    };
  }
  throw error;
}
