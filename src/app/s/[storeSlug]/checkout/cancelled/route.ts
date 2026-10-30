import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/server/payments";
import { cancelCheckout } from "@/server/services/checkout";
import { getVisibleStore } from "@/server/services/storefront";

/**
 * Stripe sends shoppers here when they click "back" on the payment page.
 * We close the session and release their reserved stock, then return them to
 * their cart (which still has their items).
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/s/[storeSlug]/checkout/cancelled">,
) {
  const { storeSlug } = await params;
  const cartUrl = new URL(
    `/s/${storeSlug}/cart?checkout=cancelled`,
    request.url,
  );

  const store = await getVisibleStore(storeSlug, null);
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const provider = getPaymentProvider();
  if (store && sessionId && provider) {
    await cancelCheckout(store.id, sessionId, provider);
  }
  return NextResponse.redirect(cartUrl);
}
