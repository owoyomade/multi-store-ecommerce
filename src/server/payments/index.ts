import "server-only";
import { E2ePaymentProvider, isLocalUrl } from "./e2e-provider";
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

  if (process.env.E2E_FAKE_PAYMENTS === "1") {
    const appUrl = process.env.APP_URL ?? "";
    // Belt and braces: the fake provider marks orders paid without money
    // moving, so it must never run anywhere but a developer's machine or CI.
    if (!isLocalUrl(appUrl)) {
      throw new Error(
        "E2E_FAKE_PAYMENTS is only allowed when APP_URL is localhost.",
      );
    }
    cachedProvider = new E2ePaymentProvider(appUrl);
    return cachedProvider;
  }

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
