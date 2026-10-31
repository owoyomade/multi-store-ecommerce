import { getPaymentProvider } from "@/server/payments";
import {
  E2ePaymentProvider,
  simulatePaidCheckout,
} from "@/server/payments/e2e-provider";

// The "payment page" of the browser-test payment provider. It doesn't exist
// (404) unless E2E_FAKE_PAYMENTS is on, which only works on localhost.
export async function GET(request: Request) {
  if (!(getPaymentProvider() instanceof E2ePaymentProvider)) {
    return new Response("Not found", { status: 404 });
  }
  const search = new URL(request.url).searchParams;
  const returnUrl = search.get("return") ?? "";
  // Only send the browser back into this app, never to another site.
  if (!returnUrl.startsWith(`${process.env.APP_URL}/`)) {
    return new Response("Bad return address", { status: 400 });
  }
  if (!(await simulatePaidCheckout(search.get("session") ?? ""))) {
    return new Response("Unknown checkout session", { status: 404 });
  }
  return Response.redirect(returnUrl, 303);
}
