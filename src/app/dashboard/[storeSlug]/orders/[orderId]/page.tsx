import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import {
  AddressBlock,
  OrderSummary,
  orderStatusLabel,
} from "@/components/order-summary";
import { centsToInputValue, formatMoney } from "@/lib/money";
import { requireStoreContext } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { roleHasPermission } from "@/server/permissions/roles";
import { canMoveTo } from "@/server/services/order-operations";
import { getOrderForDashboard } from "@/server/services/orders";
import { OrderStatusBadge } from "../order-status-badge";
import {
  addNoteAction,
  cancelAction,
  markDeliveredAction,
  markProcessingAction,
  refundAction,
  shipAction,
} from "./actions";
import {
  CancelForm,
  NoteForm,
  RefundForm,
  ShipForm,
  StatusButton,
} from "./order-controls";

export const metadata: Metadata = { title: "Order" };

const panel = "rounded-xl border border-stone-200 bg-white p-5";

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

  const canFulfil = roleHasPermission(context.role, "orders:fulfill");
  const canRefund = roleHasPermission(context.role, "orders:refund");
  const payment = order.payments.find(
    (candidate) => candidate.status === "SUCCEEDED",
  );
  const refundable = payment ? payment.amountCents - payment.refundedCents : 0;
  const money = (cents: number) => formatMoney(cents, order.currency);
  const who = (userId: string | null) =>
    userId ? (order.staffNames[userId] ?? "staff") : "system";
  // Each server action gets the store and order bound in, so the forms only send their own fields.
  const bind = <
    T extends (storeSlug: string, orderId: string, ...rest: never[]) => unknown,
  >(
    action: T,
  ) => action.bind(null, storeSlug, order.id) as never;

  const showProcessing = canFulfil && canMoveTo(order.status, "PROCESSING");
  const showShip = canFulfil && canMoveTo(order.status, "SHIPPED");
  const showDelivered = canFulfil && canMoveTo(order.status, "DELIVERED");
  const showRefund =
    canRefund && refundable > 0 && canMoveTo(order.status, "REFUNDED");
  const showCancel = canRefund && canMoveTo(order.status, "CANCELLED");

  return (
    <div className="max-w-5xl space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className={panel}>
            <h2 className="mb-3 font-semibold">Items</h2>
            <OrderSummary {...order} />
          </section>

          <section className={panel}>
            <h2 className="mb-3 font-semibold">Shipping and payment</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-medium text-stone-500">
                  Customer
                </h3>
                <p className="text-sm">{order.customer.name}</p>
                <p className="text-sm text-stone-600">{order.email}</p>
                <h3 className="mt-4 mb-1 text-sm font-medium text-stone-500">
                  Ship to
                </h3>
                <AddressBlock address={order.shippingAddress} />
              </div>
              <div className="space-y-4 text-sm">
                {order.payments.length === 0 ? (
                  <p className="text-stone-600">No payment attempts.</p>
                ) : (
                  <ul className="space-y-1">
                    {order.payments.map((attempt) => (
                      <li key={attempt.id}>
                        <span className="capitalize">{attempt.provider}</span> ·{" "}
                        {attempt.status.toLowerCase()} ·{" "}
                        {money(attempt.amountCents)}
                        {attempt.refundedCents > 0 && (
                          <> · {money(attempt.refundedCents)} refunded</>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {order.shipments.length > 0 && (
                  <div>
                    <h3 className="mb-1 font-medium text-stone-500">
                      Shipments
                    </h3>
                    <ul className="space-y-1">
                      {order.shipments.map((shipment) => (
                        <li key={shipment.id}>
                          {shipment.carrier}{" "}
                          {shipment.trackingUrl ? (
                            <a
                              href={shipment.trackingUrl}
                              className="underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shipment.trackingNumber}
                            </a>
                          ) : (
                            shipment.trackingNumber
                          )}
                          {shipment.deliveredAt && " · delivered"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {order.refunds.length > 0 && (
                  <div>
                    <h3 className="mb-1 font-medium text-stone-500">Refunds</h3>
                    <ul className="space-y-1">
                      {order.refunds.map((refund) => (
                        <li key={refund.id}>
                          {money(refund.amountCents)} ·{" "}
                          {refund.status === "FAILED" ? "failed" : "refunded"} ·{" "}
                          {refund.reason}
                          {refund.restocked && " · restocked"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={panel}>
            <h2 className="mb-3 font-semibold">History</h2>
            <ol className="space-y-2 text-sm">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-x-3">
                  <time className="text-stone-500">
                    {entry.createdAt.toLocaleString("en-CA")}
                  </time>
                  <span className="font-medium">
                    {entry.fromStatus && entry.fromStatus !== entry.toStatus
                      ? `${orderStatusLabel(entry.fromStatus)} → `
                      : ""}
                    {orderStatusLabel(entry.toStatus)}
                  </span>
                  {entry.note && (
                    <span className="text-stone-600">{entry.note}</span>
                  )}
                  <span className="text-stone-400">
                    by {who(entry.actorUserId)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          {(showProcessing || showShip || showDelivered) && (
            <section className={panel}>
              <h2 className="mb-3 font-semibold">Fulfilment</h2>
              <div className="space-y-4">
                {showProcessing && (
                  <StatusButton
                    action={bind(markProcessingAction)}
                    label="Mark as processing"
                  />
                )}
                {showShip && <ShipForm action={bind(shipAction)} />}
                {showDelivered && (
                  <StatusButton
                    action={bind(markDeliveredAction)}
                    label="Mark as delivered"
                  />
                )}
              </div>
            </section>
          )}

          {showRefund && (
            <section className={panel}>
              <h2 className="mb-3 font-semibold">Refund</h2>
              <RefundForm
                action={bind(refundAction)}
                remaining={centsToInputValue(refundable)}
              />
            </section>
          )}

          {showCancel && (
            <section className={panel}>
              <h2 className="mb-3 font-semibold">Cancel</h2>
              <CancelForm
                action={bind(cancelAction)}
                paid={order.status !== "PENDING"}
              />
            </section>
          )}

          <section className={panel}>
            <h2 className="mb-3 font-semibold">Notes</h2>
            {order.notes.length > 0 && (
              <ul className="mb-4 space-y-3 text-sm">
                {order.notes.map((note) => (
                  <li key={note.id}>
                    <p className="whitespace-pre-line">{note.body}</p>
                    <p className="text-stone-500">
                      {who(note.authorUserId)} ·{" "}
                      {note.createdAt.toLocaleString("en-CA")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <NoteForm action={bind(addNoteAction)} />
          </section>
        </div>
      </div>
    </div>
  );
}
