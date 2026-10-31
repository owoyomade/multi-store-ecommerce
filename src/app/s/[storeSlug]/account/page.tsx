import type { Metadata } from "next";
import Link from "next/link";
import { AddressBlock, orderStatusLabel } from "@/components/order-summary";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import {
  listAddressesForShopper,
  listOrdersForShopper,
} from "@/server/services/orders";
import { loadStorefront } from "../load-store";
import { deleteAddressAction } from "./actions";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

// Account pages always use /s/<store>/... paths: the sign-in cookie belongs to
// the main domain and isn't sent to store subdomains.
export default async function AccountPage({
  params,
}: PageProps<"/s/[storeSlug]/account">) {
  const { storeSlug } = await params;
  const [store, viewer] = await Promise.all([
    loadStorefront(storeSlug),
    getCurrentUser(),
  ]);
  const accountPath = `/s/${store.slug}/account`;

  if (!viewer) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="sf-heading text-3xl font-semibold">Your account</h1>
        <p className="mt-2 opacity-80">
          Sign in to see your orders and saved addresses.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href={`/sign-in?next=${encodeURIComponent(accountPath)}`}
            className="rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-5 py-2.5 font-medium text-[var(--sf-on-accent)]"
          >
            Sign in
          </Link>
          <Link
            href={`/sign-up?next=${encodeURIComponent(accountPath)}`}
            className="px-5 py-2.5 underline"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const [orders, addresses] = await Promise.all([
    listOrdersForShopper(store.id, viewer.id),
    listAddressesForShopper(store.id, viewer.id),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="sf-heading text-3xl font-semibold">Your account</h1>
        <p className="mt-1 opacity-70">Signed in as {viewer.email}</p>
      </div>

      <section aria-labelledby="orders-heading">
        <h2
          id="orders-heading"
          className="sf-heading mb-4 text-xl font-semibold"
        >
          Orders
        </h2>
        {orders.length === 0 ? (
          <p className="opacity-70">
            You haven&apos;t placed any orders with {store.name} yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`${accountPath}/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 bg-[var(--sf-paper-deep)] p-4 transition-colors hover:bg-current/10"
                >
                  <span className="font-medium">
                    Order #{order.orderNumber}
                  </span>
                  <span className="text-sm opacity-70">
                    {order.createdAt.toLocaleDateString("en-CA")}
                  </span>
                  <span className="text-sm">
                    {orderStatusLabel(order.status)}
                  </span>
                  <span className="font-medium">
                    {formatMoney(order.totalCents, order.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="addresses-heading">
        <h2
          id="addresses-heading"
          className="sf-heading mb-4 text-xl font-semibold"
        >
          Saved addresses
        </h2>
        {addresses.length === 0 ? (
          <p className="opacity-70">
            Tick “Save this address” at checkout to add one.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="rounded-[var(--sf-radius)] bg-[var(--sf-paper-deep)] p-4"
              >
                <AddressBlock address={address} />
                <form
                  action={deleteAddressAction.bind(
                    null,
                    store.slug,
                    address.id,
                  )}
                  className="mt-3"
                >
                  <button
                    type="submit"
                    className="text-sm underline opacity-70 hover:opacity-100"
                  >
                    Remove
                    <span className="sr-only"> address for {address.name}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
