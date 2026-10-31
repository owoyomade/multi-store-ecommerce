import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { OrderSummary } from "@/components/order-summary";
import { firstParam } from "@/lib/search-params";
import { getCurrentUser } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/payments";
import {
  clientIp,
  consumeRateLimit,
  RATE_LIMITS,
  RateLimitedError,
} from "@/server/rate-limit";
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

/**
 * Limits how many codes one visitor can try per store, so codes can't be
 * guessed by trying thousands of them. Returns the message to show if blocked.
 */
async function discountAttemptBlocked(storeId: string): Promise<string | null> {
  try {
    await consumeRateLimit(
      `discount:${storeId}:${await clientIp()}`,
      RATE_LIMITS.discountCode,
    );
    return null;
  } catch (error) {
    if (error instanceof RateLimitedError) return error.message;
    throw error;
  }
}

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/s/[storeSlug]/checkout">) {
  const { storeSlug } = await params;
  const store = await loadStorefront(storeSlug);
  // The code arrives from the "Apply" form below as ?discount=CODE, so the
  // totals can be shown with it before the shopper pays.
  const discountCode = firstParam((await searchParams).discount) ?? "";
  const rateLimitMessage = discountCode
    ? await discountAttemptBlocked(store.id)
    : null;
  const [checkedPreview, base, viewer] = await Promise.all([
    getCheckoutPreview(store.id, await readCartToken(store.id), {
      discountCode: rateLimitMessage ? "" : discountCode,
      currency: store.currency,
    }),
    storefrontBasePath(storeSlug),
    getCurrentUser(),
  ]);
  const preview = rateLimitMessage
    ? { ...checkedPreview, discountError: rateLimitMessage }
    : checkedPreview;
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
          discountCode={preview.discount?.code ?? ""}
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
          discountCode={preview.discount?.code}
          {...preview.totals}
        />
        <form method="get" className="mt-6" aria-label="Discount code">
          <label htmlFor="discount-code" className="text-sm">
            Discount code
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="discount-code"
              name="discount"
              defaultValue={discountCode}
              autoComplete="off"
              aria-invalid={preview.discountError ? true : undefined}
              aria-describedby={
                preview.discountError ? "discount-error" : undefined
              }
              className="w-full rounded-[var(--sf-radius)] border border-current/25 bg-white px-3 py-2 text-stone-900 uppercase"
            />
            <button
              type="submit"
              className="rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-4 py-2 text-[var(--sf-on-primary)]"
            >
              Apply
            </button>
          </div>
          {preview.discountError && (
            <p
              id="discount-error"
              role="alert"
              className="mt-2 text-sm text-red-800"
            >
              {preview.discountError}
            </p>
          )}
          {preview.discount && (
            <p role="status" className="mt-2 text-sm">
              {preview.discount.code} applied.
            </p>
          )}
        </form>
        <p className="mt-4 text-xs opacity-80">
          Tax and shipping use simple demo rates and aren&apos;t real tax
          advice.
        </p>
      </aside>
    </div>
  );
}
