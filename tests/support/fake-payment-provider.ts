import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  PaymentWebhookEvent,
} from "@/server/payments/provider";

/**
 * Stands in for Stripe in tests: records sessions in memory and can be told to
 * fail. Webhook events are built directly with completedEvent/expiredEvent.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  readonly sessions: (CreateCheckoutInput & CheckoutSession)[] = [];
  readonly expiredSessionIds: string[] = [];
  failNextCheckout = false;
  failExpire = false;
  private eventCounter = 0;

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSession> {
    if (this.failNextCheckout) {
      this.failNextCheckout = false;
      throw new Error("provider outage");
    }
    const session = {
      sessionId: `cs_test_${this.sessions.length + 1}_${input.orderId}`,
      url: `https://pay.example.test/${input.orderId}`,
    };
    this.sessions.push({ ...input, ...session });
    return session;
  }

  async expireCheckoutSession(sessionId: string): Promise<void> {
    if (this.failExpire) throw new Error("session already completed");
    this.expiredSessionIds.push(sessionId);
  }

  async parseWebhook(): Promise<PaymentWebhookEvent> {
    throw new Error("not used in tests");
  }

  lastSession() {
    const session = this.sessions.at(-1);
    if (!session) throw new Error("no checkout session was created");
    return session;
  }

  completedEvent(
    overrides: Partial<
      Extract<PaymentWebhookEvent, { kind: "checkout_completed" }>
    > = {},
  ) {
    const session = this.lastSession();
    return {
      kind: "checkout_completed" as const,
      eventId: `evt_${++this.eventCounter}`,
      sessionId: session.sessionId,
      paymentId: "pi_test_123",
      amountCents: session.lines.reduce(
        (sum, line) => sum + line.unitAmountCents * line.quantity,
        0,
      ),
      currency: session.currency,
      paid: true,
      ...overrides,
    };
  }

  expiredEvent() {
    return {
      kind: "checkout_expired" as const,
      eventId: `evt_${++this.eventCounter}`,
      sessionId: this.lastSession().sessionId,
    };
  }
}
