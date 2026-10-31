"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { getCurrentUser } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/payments";
import { startCheckout } from "@/server/services/checkout";
import { readCartToken } from "../cart-cookie";
import { loadStorefront } from "../load-store";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function startCheckoutAction(
  storeSlug: string,
  idempotencyKey: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await loadStorefront(storeSlug);
  const provider = getPaymentProvider();
  if (!provider)
    return {
      status: "error",
      message: "Payments aren't set up for this store yet.",
    };

  let checkoutUrl: string;
  try {
    const viewer = await getCurrentUser();
    ({ checkoutUrl } = await startCheckout({
      store,
      cartToken: await readCartToken(store.id),
      viewerUserId: viewer?.id ?? null,
      idempotencyKey,
      storefrontUrl: `${process.env.APP_URL}/s/${store.slug}`,
      provider,
      input: {
        email: field(formData, "email"),
        saveAddress: formData.get("saveAddress") === "on",
        discountCode: field(formData, "discountCode"),
        address: {
          name: field(formData, "name"),
          line1: field(formData, "line1"),
          line2: field(formData, "line2"),
          city: field(formData, "city"),
          region: field(formData, "region"),
          postalCode: field(formData, "postalCode"),
          country: field(formData, "country"),
          phone: field(formData, "phone"),
        },
      },
    }));
  } catch (error) {
    const state = toErrorFormState(error, formData);
    // Zod reports nested paths like address.city; the form names fields "city".
    if (state.status === "error" && state.fieldErrors) {
      state.fieldErrors = Object.fromEntries(
        Object.entries(state.fieldErrors).map(([key, messages]) => [
          key.replace(/^address\./, ""),
          messages,
        ]),
      );
    }
    return state;
  }
  // Sends the shopper to the provider's hosted payment page.
  redirect(checkoutUrl);
}
