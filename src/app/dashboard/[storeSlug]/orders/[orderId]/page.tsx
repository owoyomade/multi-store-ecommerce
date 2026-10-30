import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import {
  AddressBlock,
  OrderSummary,
  orderStatusLabel,
} from "@/components/order-summary";
import { formatMoney } from "@/lib/money";
import { requireStoreContext } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { roleHasPermission } from "@/server/permissions/roles";
import { getOrderForDashboard } from "@/server/services/orders";
import { OrderStatusBadge } from "../order-status-badge";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/orders/[orderId]">) {
  const { storeSlug, orderId } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "orders:view")) {
    return (
      <NoAccess
        title="Order"
        message="Your role doesn't include viewing orders."
      />
    );
  }

  let order;
  try {
    order = await getOrderForDashboard(context, orderId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href={`/dashboard/${storeSlug}/orders`}
          className="text-sm text-stone-500 underline"
        >
          ← Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Order #{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-stone-500">
          Placed {order.createdAt.toLocaleString("en-CA")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Items</h2>
          <OrderSummary {...order} />
        </section>
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
          <div>
            <h2 className="mb-1 font-semibold">Customer</h2>
            <p className="text-sm">{order.customer.name}</p>
            <p className="text-sm text-stone-600">{order.email}</p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Ship to</h2>
            <AddressBlock address={order.shippingAddress} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Payments</h2>
        {order.payments.length === 0 ? (
          <p className="text-sm text-stone-600">No payment attempts.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap gap-x-4">
                <span className="capitalize">{payment.provider}</span>
                <span>{payment.status.toLowerCase()}</span>
                <span>{formatMoney(payment.amountCents, order.currency)}</span>
                {payment.providerPaymentId && (
                  <span className="font-mono text-xs text-stone-500">
                    {payment.providerPaymentId}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">History</h2>
        <ol className="space-y-2 text-sm">
          {order.statusHistory.map((entry) => (
            <li key={entry.id} className="flex flex-wrap gap-x-3">
              <time className="text-stone-500">
                {entry.createdAt.toLocaleString("en-CA")}
              </time>
              <span className="font-medium">
                {entry.fromStatus
                  ? `${orderStatusLabel(entry.fromStatus)} → `
                  : ""}
                {orderStatusLabel(entry.toStatus)}
              </span>
              {entry.note && (
                <span className="text-stone-600">{entry.note}</span>
              )}
              <span className="text-stone-400">
                {entry.actorUserId ? "by staff" : "by system"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-stone-500">
        Fulfilment, cancellations and refunds arrive in the next phase.
      </p>
    </div>
  );
}
