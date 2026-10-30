import "server-only";
import Stripe from "stripe";
import {
  WebhookSignatureError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentProvider,
  type PaymentWebhookEvent,
} from "./provider";

/**
 * Stripe Checkout: the shopper pays on Stripe's hosted page, so card details
 * never touch our servers.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
  ) {
    // Pin the API version so a Stripe-side upgrade can't change response shapes under us.
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-09-30.endive" });
  }

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        // Amounts are computed by our server; Stripe just collects them.
        line_items: input.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: line.unitAmountCents,
            product_data: { name: line.name },
          },
        })),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        // Lets the webhook find the order even if our own lookup fails.
        metadata: { orderId: input.orderId, storeId: input.storeId },
        payment_intent_data: {
          metadata: { orderId: input.orderId, storeId: input.storeId },
        },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url };
  }

  async expireCheckoutSession(sessionId: string): Promise<void> {
    await this.stripe.checkout.sessions.expire(sessionId);
  }

  async parseWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<PaymentWebhookEvent> {
    if (!signatureHeader)
      throw new WebhookSignatureError("Missing Stripe-Signature header");

    let event: Stripe.Event;
    try {
      // Checks the HMAC signature and timestamp, so forged or replayed-old
      // requests are rejected before we read anything from them.
      event = await this.stripe.webhooks.constructEventAsync(
        rawBody,
        signatureHeader,
        this.webhookSecret,
      );
    } catch {
      throw new WebhookSignatureError();
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object;
      if (event.type === "checkout.session.expired") {
        return {
          kind: "checkout_expired",
          eventId: event.id,
          sessionId: session.id,
        };
      }
      return {
        kind: "checkout_completed",
        eventId: event.id,
        sessionId: session.id,
        paymentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        amountCents: session.amount_total ?? 0,
        currency: (session.currency ?? "").toUpperCase(),
        paid: session.payment_status === "paid",
      };
    }
    return { kind: "ignored", eventId: event.id, type: event.type };
  }
}
