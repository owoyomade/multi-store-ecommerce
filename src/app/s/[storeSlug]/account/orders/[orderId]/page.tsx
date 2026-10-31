import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AddressBlock,
  OrderSummary,
  orderStatusLabel,
} from "@/components/order-summary";
import { getCurrentUser } from "@/server/auth/session";
import { getOrderForShopper } from "@/server/services/orders";
import { loadStorefront } from "../../../load-store";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false },
};

export default async function ShopperOrderPage({
  params,
}: PageProps<"/s/[storeSlug]/account/orders/[orderId]">) {
  const { storeSlug, orderId } = await params;
  const [store, viewer] = await Promise.all([
    loadStorefront(storeSlug),
    getCurrentUser(),
  ]);
  if (!viewer)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/s/${storeSlug}/account/orders/${orderId}`)}`,
    );

  const order = await getOrderForShopper(store.id, viewer.id, orderId);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/s/${store.slug}/account`}
        className="text-sm underline opacity-80"
      >
        ← Your account
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="sf-heading text-3xl font-semibold">
          Order #{order.orderNumber}
        </h1>
        <p className="font-medium">{orderStatusLabel(order.status)}</p>
      </div>
      <p className="mt-1 text-sm opacity-70">
        Placed {order.createdAt.toLocaleString("en-CA")}
      </p>
      <div className="mt-6 grid gap-8 rounded-[var(--sf-radius)] bg-[var(--sf-paper-deep)] p-6 sm:grid-cols-[2fr_1fr]">
        <OrderSummary {...order} />
        <div>
          <h2 className="mb-2 text-sm font-semibold">Shipping to</h2>
          <AddressBlock address={order.shippingAddress} />
        </div>
      </div>
    </div>
  );
}
