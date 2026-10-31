import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressBlock, OrderSummary } from "@/components/order-summary";
import { firstParam } from "@/lib/search-params";
import { getOrderByCheckoutSession } from "@/server/services/orders";
import { storefrontBasePath } from "@/server/storefront-path";
import { loadStorefront } from "../../load-store";
import { RefreshWhilePending } from "./refresh-while-pending";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: PageProps<"/s/[storeSlug]/checkout/success">) {
  const { storeSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const sessionId = firstParam((await searchParams).session_id);
  if (!sessionId) notFound();

  const [order, base] = await Promise.all([
    getOrderByCheckoutSession(store.id, sessionId),
    storefrontBasePath(storeSlug),
  ]);
  if (!order) notFound();

  // Stripe redirects here as soon as the card is accepted; the webhook that
  // marks the order paid usually lands a moment later.
  const confirming = order.status === "PENDING";

  return (
    <div className="mx-auto max-w-2xl">
      {confirming ? (
        <>
          <RefreshWhilePending />
          <h1 className="sf-heading text-3xl font-semibold">
            Confirming your payment…
          </h1>
          <p className="mt-2 opacity-80" role="status">
            This usually takes a few seconds. This page updates by itself.
          </p>
        </>
      ) : order.status === "CANCELLED" ? (
        <>
          <h1 className="sf-heading text-3xl font-semibold">
            This checkout was cancelled
          </h1>
          <p className="mt-2 opacity-80">
            No payment was taken. Your items are back in stock for other
            shoppers.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm tracking-wide uppercase opacity-70">
            Order #{order.orderNumber}
          </p>
          <h1 className="sf-heading mt-1 text-3xl font-semibold">
            Thank you for your order!
          </h1>
          <p className="mt-2 opacity-80">
            A confirmation has been sent to <strong>{order.email}</strong>.
          </p>
        </>
      )}

      <div className="mt-8 grid gap-8 rounded-[var(--sf-radius)] bg-[var(--sf-paper-deep)] p-6 sm:grid-cols-[2fr_1fr]">
        <OrderSummary {...order} />
        <div>
          <h2 className="mb-2 text-sm font-semibold">Shipping to</h2>
          <AddressBlock address={order.shippingAddress} />
        </div>
      </div>

      <Link href={`${base}/products`} className="mt-8 inline-block underline">
        Continue shopping
      </Link>
    </div>
  );
}
