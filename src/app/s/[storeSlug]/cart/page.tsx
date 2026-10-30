import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getCart } from "@/server/services/cart";
import { storefrontBasePath } from "@/server/storefront-path";
import { removeCartItemAction } from "../actions";
import { readCartToken } from "../cart-cookie";
import { loadStorefront } from "../load-store";
import { QuantityForm } from "./quantity-form";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false },
};

export default async function CartPage({
  params,
}: PageProps<"/s/[storeSlug]/cart">) {
  const { storeSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const [cart, base] = await Promise.all([
    getCart(store.id, await readCartToken(store.id)),
    storefrontBasePath(storeSlug),
  ]);

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="sf-heading text-3xl font-semibold">
          Your cart is empty
        </h1>
        <p className="mt-2 opacity-70">Find something you love.</p>
        <Link
          href={`${base}/products`}
          className="mt-6 inline-block rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-6 py-3 font-medium text-[var(--sf-on-accent)]"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
      <section aria-labelledby="cart-heading">
        <h1
          id="cart-heading"
          className="sf-heading mb-6 text-3xl font-semibold"
        >
          Your cart
        </h1>
        <ul className="divide-y divide-current/10 border-y border-current/10">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex gap-4 py-5">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/10">
                {line.image && (
                  <Image
                    src={`/media/${line.image.storageKey}`}
                    alt={line.image.altText || line.productTitle}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <Link
                    href={`${base}/products/${line.productSlug}`}
                    className="font-medium hover:underline"
                  >
                    {line.productTitle}
                  </Link>
                  {line.variantTitle !== "Default" && (
                    <p className="text-sm opacity-70">{line.variantTitle}</p>
                  )}
                  <p className="text-sm opacity-70">
                    {formatMoney(line.unitPriceCents, store.currency)} each
                  </p>
                  {line.problem && (
                    <p
                      className="mt-1 text-sm font-medium text-red-700"
                      role="alert"
                    >
                      {line.problem}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <QuantityForm
                    storeSlug={storeSlug}
                    itemId={line.id}
                    quantity={line.quantity}
                    label={line.productTitle}
                  />
                  <p className="w-20 py-2 text-right font-medium">
                    {formatMoney(line.lineTotalCents, store.currency)}
                  </p>
                  <form
                    action={removeCartItemAction.bind(null, storeSlug, line.id)}
                  >
                    <button
                      type="submit"
                      className="py-2 text-sm underline opacity-70 hover:opacity-100"
                    >
                      Remove
                      <span className="sr-only"> {line.productTitle}</span>
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="summary-heading"
        className="h-fit rounded-[var(--sf-radius)] border border-current/15 p-6"
      >
        <h2 id="summary-heading" className="sf-heading text-xl font-semibold">
          Summary
        </h2>
        <dl className="mt-4 flex justify-between text-lg">
          <dt>Subtotal</dt>
          <dd className="font-medium">
            {formatMoney(cart.subtotalCents, store.currency)}
          </dd>
        </dl>
        <p className="mt-2 text-sm opacity-70">
          Shipping and taxes are calculated at checkout.
        </p>
        <p className="mt-6 rounded-[var(--sf-radius)] bg-current/5 p-3 text-sm">
          Checkout opens soon. In this demo, payments arrive in the next
          release.
        </p>
      </aside>
    </div>
  );
}
