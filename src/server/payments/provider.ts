// The contract every payment provider implements. Checkout and webhook code
// only talk to this interface, so adding PayPal or Square later means writing
// one new class, not changing the order logic.

export type CheckoutLine = {
  name: string;
  unitAmountCents: number;
  quantity: number;
};

export type CreateCheckoutInput = {
  orderId: string;
  storeId: string;
  currency: string;
  customerEmail: string;
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  /** Sent to the provider so a retried request can't create two sessions. */
  idempotencyKey: string;
};

export type CheckoutSession = {
  sessionId: string;
  url: string;
};

/** A provider webhook, translated into the few cases our order logic cares about. */
export type PaymentWebhookEvent =
  | {
      kind: "checkout_completed";
      eventId: string;
      sessionId: string;
      paymentId: string | null;
      amountCents: number;
      currency: string;
      /** False for payment methods that settle later; only true means money was captured. */
      paid: boolean;
    }
  | { kind: "checkout_expired"; eventId: string; sessionId: string }
  | { kind: "ignored"; eventId: string; type: string };

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Closes an unpaid session so it can no longer be paid. */
  expireCheckoutSession(sessionId: string): Promise<void>;
  /** Verifies the signature and parses the event. Throws WebhookSignatureError if it's not genuine. */
  parseWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<PaymentWebhookEvent>;
}

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}
