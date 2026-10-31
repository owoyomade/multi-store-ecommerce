import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { OrderSummary } from "@/components/order-summary";
import { getCurrentUser } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/payments";
import { getCheckoutPreview } from "@/server/services/checkout";
import { listAddressesForShopper } from "@/server/services/orders";
import { storefrontBasePath } from "@/server/storefront-path";
import { readCartToken } from "../cart-cookie";
import { loadStorefront } from "../load-store";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage({
  params,
}: PageProps<"/s/[storeSlug]/checkout">) {
  const { storeSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const [preview, base, viewer] = await Promise.all([
    getCheckoutPreview(store.id, await readCartToken(store.id)),
    storefrontBasePath(storeSlug),
    getCurrentUser(),
  ]);
  const savedAddresses = viewer
    ? await listAddressesForShopper(store.id, viewer.id)
    : [];
  const paymentsReady = getPaymentProvider() !== null;

  if (preview.lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="sf-heading text-3xl font-semibold">
          Nothing to check out
        </h1>
        <p className="mt-2 opacity-70">Your cart is empty.</p>
        <Link href={`${base}/products`} className="mt-6 inline-block underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
      <section aria-labelledby="checkout-heading">
        <h1
          id="checkout-heading"
          className="sf-heading mb-6 text-3xl font-semibold"
        >
          Checkout
        </h1>
        {!viewer && (
          <p className="mb-6 text-sm opacity-80">
            Checking out as a guest.{" "}
            <Link
              href={`/sign-in?next=${encodeURIComponent(`/s/${store.slug}/checkout`)}`}
              className="underline"
            >
              Sign in
            </Link>{" "}
            to save addresses and see your orders later.
          </p>
        )}
        <CheckoutForm
          storeSlug={store.slug}
          // A fresh ID for each visit to this page. Submitting twice (double
          // click, slow network) sends the same ID, so only one order is made.
          idempotencyKey={randomUUID()}
          defaultEmail={viewer?.email ?? ""}
          savedAddresses={savedAddresses.map(
            ({
              id,
              name,
              line1,
              line2,
              city,
              region,
              postalCode,
              country,
              phone,
            }) => ({
              id,
              name,
              line1,
              line2,
              city,
              region,
              postalCode,
              country,
              phone,
            }),
          )}
          canSaveAddress={Boolean(viewer)}
          paymentsReady={paymentsReady}
        />
      </section>

      <aside
        aria-labelledby="order-heading"
        className="h-fit rounded-[var(--sf-radius)] bg-[var(--sf-paper-deep)] p-6"
      >
        <h2
          id="order-heading"
          className="sf-heading mb-4 text-xl font-semibold"
        >
          Your order
        </h2>
        <OrderSummary
          currency={store.currency}
          items={preview.lines.map((line) => ({ ...line, id: line.variantId }))}
          {...preview.totals}
        />
        <p className="mt-4 text-xs opacity-60">
          Tax and shipping use simple demo rates and aren&apos;t real tax
          advice.
        </p>
      </aside>
    </div>
  );
}
