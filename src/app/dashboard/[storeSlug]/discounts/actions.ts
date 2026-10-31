"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import { createDiscount, setDiscountActive } from "@/server/services/discounts";

export async function createDiscountAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  const field = (name: string) => String(formData.get(name) ?? "");
  try {
    await createDiscount(context, {
      code: field("code"),
      kind: field("kind") === "FIXED" ? "FIXED" : "PERCENT",
      amount: field("amount"),
      minSubtotal: field("minSubtotal"),
      startsAt: field("startsAt"),
      endsAt: field("endsAt"),
      usageLimit: field("usageLimit"),
    });
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  revalidatePath(`/dashboard/${storeSlug}/discounts`);
  return { status: "success", message: "Discount code created." };
}

export async function setDiscountActiveAction(
  storeSlug: string,
  discountId: string,
  active: boolean,
) {
  const context = await requireStoreContext(storeSlug);
  await setDiscountActive(context, discountId, active);
  revalidatePath(`/dashboard/${storeSlug}/discounts`);
}
