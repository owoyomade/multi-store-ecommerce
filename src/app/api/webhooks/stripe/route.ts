import { getPaymentProvider } from "@/server/payments";
import { WebhookSignatureError } from "@/server/payments/provider";
import { reportError } from "@/server/observability";
import { processPaymentWebhook } from "@/server/services/checkout";

/**
 * Stripe calls this URL when a checkout is paid or expires.
 *
 * - The raw body is read as text because the signature is computed over the
 *   exact bytes Stripe sent; parsing JSON first would break verification.
 * - 400 tells Stripe the request was bad (don't retry). 500 makes Stripe retry
 *   later, which is safe because processing is idempotent.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider)
    return new Response("Payments are not configured", { status: 503 });

  let event;
  try {
    event = await provider.parseWebhook(
      await request.text(),
      request.headers.get("stripe-signature"),
    );
  } catch (error) {
    if (error instanceof WebhookSignatureError)
      return new Response("Invalid signature", { status: 400 });
    throw error;
  }

  try {
    const outcome = await processPaymentWebhook(event, provider.name);
    return Response.json({ received: true, outcome });
  } catch (error) {
    await reportError("webhook.processing_failed", error, {
      eventId: event.eventId,
    });
    return new Response("Processing failed", { status: 500 });
  }
}
