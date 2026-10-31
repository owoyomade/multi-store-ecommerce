"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import { adjustStock } from "@/server/services/stock-control";

export async function adjustStockAction(
  storeSlug: string,
  variantId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  let onHand: number;
  try {
    ({ onHand } = await adjustStock(context, variantId, {
      change: String(formData.get("change") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      note: String(formData.get("note") ?? ""),
    }));
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  revalidatePath(`/dashboard/${storeSlug}/inventory`);
  revalidatePath(`/s/${storeSlug}`, "layout");
  return { status: "success", message: `Saved. ${onHand} now on hand.` };
}
