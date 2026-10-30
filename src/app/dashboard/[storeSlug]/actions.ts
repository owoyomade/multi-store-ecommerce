"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import { setStorePublished } from "@/server/services/stores";

export async function setStorePublishedAction(
  storeSlug: string,
  published: boolean,
  _previous: FormState,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  try {
    await setStorePublished(context, published);
  } catch (error) {
    return toErrorFormState(error);
  }
  revalidatePath(`/dashboard/${storeSlug}`, "layout");
  revalidatePath(`/s/${storeSlug}`, "layout");
  return {
    status: "success",
    message: published
      ? "Your store is live."
      : "Your store is now hidden from shoppers.",
  };
}
