import type { OrderStatus } from "@/generated/prisma/enums";
import { orderStatusLabel } from "@/components/order-summary";

const colours: Record<OrderStatus, string> = {
  PENDING: "bg-stone-100 text-stone-700",
  PAID: "bg-emerald-100 text-emerald-800",
  PROCESSING: "bg-sky-100 text-sky-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-amber-100 text-amber-800",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colours[status]}`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}
