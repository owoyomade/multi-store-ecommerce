"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { createStoreSchema } from "@/lib/validation/store";
import { requireUser } from "@/server/auth/session";
import { FieldConflictError } from "@/server/errors";
import { createStore } from "@/server/services/stores";

export async function createStoreAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Server actions are public HTTP endpoints, so each one checks the session itself.
  const user = await requireUser();

  const parsed = createStoreSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  let storeSlug: string;
  try {
    storeSlug = (await createStore(user.id, parsed.data)).slug;
  } catch (error) {
    if (error instanceof FieldConflictError) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: { [error.field]: [error.message] },
      };
    }
    throw error;
  }
  // redirect() works by throwing, so it must sit outside the try/catch above.
  redirect(`/dashboard/${storeSlug}`);
}
