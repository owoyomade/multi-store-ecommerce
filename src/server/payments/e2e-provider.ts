import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { processPaymentWebhook } from "../services/checkout";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  PaymentWebhookEvent,
} from "./provider";

/**
 * A stand-in for Stripe used only by the automated browser tests. "Paying"
 * means visiting /api/e2e-payments/pay, which marks the order paid through
 * the same webhook logic Stripe uses. getPaymentProvider() refuses to create
 * it unless the app runs on localhost, so it can never take a real order.
 */
export class E2ePaymentProvider implements PaymentProvider {
  readonly name = "e2e";

  constructor(private readonly appUrl: string) {}

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSession> {
    const sessionId = `cs_e2e_${randomUUID()}`;
    const payUrl = new URL("/api/e2e-payments/pay", this.appUrl);
    // Stripe's page is on another site, so the browser leaves the app
    // entirely. 127.0.0.1 is a different site from localhost, which gives the
    // same full page load instead of an in-app navigation.
    if (payUrl.hostname === "localhost") payUrl.hostname = "127.0.0.1";
    payUrl.searchParams.set("session", sessionId);
    payUrl.searchParams.set(
      "return",
      input.successUrl.replace("{CHECKOUT_SESSION_ID}", sessionId),
    );
    return { sessionId, url: payUrl.toString() };
  }

  async refund(): Promise<{ refundId: string }> {
    return { refundId: `re_e2e_${randomUUID()}` };
  }

  async expireCheckoutSession(): Promise<void> {}

  async parseWebhook(): Promise<PaymentWebhookEvent> {
    throw new Error("The e2e provider has no webhooks.");
  }
}

/** Whether a URL points at this machine. */
export function isLocalUrl(url: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}

/**
 * What Stripe's "checkout completed" webhook would report for this session:
 * the full amount, paid. Run through the normal webhook handling so the
 * browser tests exercise the real order logic.
 */
export async function simulatePaidCheckout(
  sessionId: string,
): Promise<boolean> {
  const payment = await db.payment.findUnique({
    where: { providerSessionId: sessionId },
    select: { amountCents: true, currency: true, provider: true },
  });
  if (!payment || payment.provider !== "e2e") return false;
  await processPaymentWebhook(
    {
      kind: "checkout_completed",
      eventId: `evt_e2e_${randomUUID()}`,
      sessionId,
      paymentId: `pi_e2e_${randomUUID()}`,
      amountCents: payment.amountCents,
      currency: payment.currency,
      paid: true,
    },
    "e2e",
  );
  return true;
}
