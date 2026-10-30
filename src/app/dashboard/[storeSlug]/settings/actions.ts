"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { updateStoreBrandingSchema } from "@/lib/validation/store";
import { requireStoreContext } from "@/server/auth/session";
import { updateStoreBranding } from "@/server/services/stores";
import { ForbiddenError } from "@/server/tenancy/store-context";

export async function updateBrandingAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // The slug comes from the page URL, but it only picks *which* membership to
  // look up. If the user isn't a member of that store this throws a 404.
  const context = await requireStoreContext(storeSlug);

  const parsed = updateStoreBrandingSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    await updateStoreBranding(context, parsed.data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return {
        status: "error",
        message: "Your role can't change store settings.",
      };
    }
    throw error;
  }

  revalidatePath(`/dashboard/${storeSlug}`, "layout");
  return { status: "success", message: "Settings saved." };
}
