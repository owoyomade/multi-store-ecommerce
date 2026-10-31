"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { parseMoneyToCents } from "@/lib/money";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/payments";
import {
  addOrderNote,
  cancelOrder,
  markOrderDelivered,
  markOrderProcessing,
  refundOrder,
  shipOrder,
} from "@/server/services/order-operations";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refresh(storeSlug: string, orderId: string) {
  revalidatePath(`/dashboard/${storeSlug}/orders/${orderId}`);
  revalidatePath(`/dashboard/${storeSlug}/orders`);
}

function requireProvider() {
  const provider = getPaymentProvider();
  if (!provider)
    throw new Error("Payments aren't configured, so refunds can't be issued.");
  return provider;
}

/** Runs an order operation and turns expected errors into form messages. */
async function runOrderAction(
  storeSlug: string,
  orderId: string,
  formData: FormData,
  run: () => Promise<string>,
): Promise<FormState> {
  try {
    const message = await run();
    refresh(storeSlug, orderId);
    return { status: "success", message };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Payments aren't configured")
    ) {
      return { status: "error", message: error.message };
    }
    return toErrorFormState(error, formData);
  }
}

export async function markProcessingAction(
  storeSlug: string,
  orderId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runOrderAction(storeSlug, orderId, formData, async () => {
    await markOrderProcessing(await requireStoreContext(storeSlug), orderId);
    return "Marked as processing.";
  });
}

export async function markDeliveredAction(
  storeSlug: string,
  orderId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runOrderAction(storeSlug, orderId, formData, async () => {
    await markOrderDelivered(await requireStoreContext(storeSlug), orderId);
    return "Marked as delivered.";
  });
}

export async function shipAction(
  storeSlug: string,
  orderId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runOrderAction(storeSlug, orderId, formData, async () => {
    await shipOrder(await requireStoreContext(storeSlug), orderId, {
      carrier: text(formData, "carrier"),
      trackingNumber: text(formData, "trackingNumber"),
      trackingUrl: text(formData, "trackingUrl"),
    });
    return "Marked as shipped. The customer has been emailed their tracking number.";
  });
}

export async function refundAction(
  storeSlug: string,
  orderId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runOrderAction(storeSlug, orderId, formData, async () => {
    const context = await requireStoreContext(storeSlug);
    const amountCents = parseMoneyToCents(text(formData, "amount"));
    await refundOrder(
      context,
      orderId,
      {
        amountCents: amountCents ?? 0,
        reason: text(formData, "reason"),
        restock: formData.get("restock") === "on",
      },
      requireProvider(),
    );
    return "Refund issued.";
  });
}

export async function cancelAction(
  storeSlug: string,
  orderId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runOrderAction(storeSlug, orderId, formData, async () => {
    await cancelOrder(
      await requireStoreContext(storeSlug),
      orderId,
      text(formData, "reason"),
      requireProvider(),
    );
    return "Order cancelled.";
  });
}

export async function addNoteAction(
  storeSlug: string,
  orderId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runOrderAction(storeSlug, orderId, formData, async () => {
    await addOrderNote(
      await requireStoreContext(storeSlug),
      orderId,
      text(formData, "body"),
    );
    return "Note added.";
  });
}
