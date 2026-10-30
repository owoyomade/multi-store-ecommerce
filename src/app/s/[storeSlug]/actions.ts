"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import {
  addToCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/server/services/cart";
import { readCartToken, writeCartToken } from "./cart-cookie";
import { loadStorefront } from "./load-store";

// The store comes from the slug and is re-checked here (live, or a preview
// for staff). The cart services then make sure every variant and cart line
// belongs to that store.

export async function addToCartAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
) {
  const store = await loadStorefront(storeSlug);
  try {
    const { newToken } = await addToCart(
      store.id,
      await readCartToken(store.id),
      String(formData.get("variantId") ?? ""),
      Number(formData.get("quantity") ?? 1),
    );
    if (newToken) await writeCartToken(store.id, newToken);
  } catch (error) {
    return toErrorFormState(error);
  }
  revalidatePath(`/s/${storeSlug}`, "layout");
  return {
    status: "success",
    message: "Added to your cart.",
  } satisfies FormState;
}

export async function updateCartItemAction(
  storeSlug: string,
  itemId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await loadStorefront(storeSlug);
  try {
    await updateCartItemQuantity(
      store.id,
      await readCartToken(store.id),
      itemId,
      Number(formData.get("quantity")),
    );
  } catch (error) {
    return toErrorFormState(error);
  }
  revalidatePath(`/s/${storeSlug}`, "layout");
  return { status: "idle" };
}

export async function removeCartItemAction(storeSlug: string, itemId: string) {
  const store = await loadStorefront(storeSlug);
  await removeCartItem(store.id, await readCartToken(store.id), itemId);
  revalidatePath(`/s/${storeSlug}`, "layout");
}
