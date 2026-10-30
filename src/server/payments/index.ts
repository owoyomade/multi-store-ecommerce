import "server-only";
import type { PaymentProvider } from "./provider";
import { StripePaymentProvider } from "./stripe-provider";

let cachedProvider: PaymentProvider | null | undefined;

/**
 * The configured payment provider, or null when payments aren't set up yet
 * (checkout then shows a clear "not available" message instead of failing).
 *
 * Only Stripe *test* keys are accepted: this is a demo platform, and real
 * money must not move until Stripe Connect, legal terms and merchant
 * verification are in place (see docs/phase-0-plan.md).
 */
export function getPaymentProvider(): PaymentProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) {
    cachedProvider = null;
    return null;
  }
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("rk_test_")) {
    throw new Error(
      "Only Stripe test-mode keys (sk_test_...) are allowed in this demo.",
    );
  }
  cachedProvider = new StripePaymentProvider(secretKey, webhookSecret);
  return cachedProvider;
}
