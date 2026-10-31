import "server-only";
import { toCsv } from "@/lib/csv";
import { centsToInputValue } from "@/lib/money";
import { db } from "../db";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { userNames } from "./staff";

const DAY_MS = 24 * 60 * 60 * 1000;

// An order counts as a sale once it's paid, including orders later refunded,
// because refunds are reported separately and subtracted from net sales.
const SOLD_STATUSES = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "REFUNDED",
  "CANCELLED",
] as const;

export type StoreMetrics = {
  days: number;
  orderCount: number;
  grossSalesCents: number;
  refundedCents: number;
  netSalesCents: number;
  averageOrderCents: number;
  topProducts: { title: string; quantity: number; revenueCents: number }[];
};

/** Sales figures for the last `days` days, counted from when each order was paid. */
export async function getStoreMetrics(
  context: StoreContext,
  days = 30,
): Promise<StoreMetrics> {
  requirePermission(context, "reports:view");
  const since = new Date(Date.now() - days * DAY_MS);
  const paidInWindow = {
    storeId: context.storeId,
    paidAt: { gte: since },
    status: { in: [...SOLD_STATUSES] },
  };

  const [totals, refunds, products] = await Promise.all([
    db.order.aggregate({
      where: paidInWindow,
      _count: true,
      _sum: { totalCents: true },
    }),
    db.refund.aggregate({
      where: {
        storeId: context.storeId,
        status: "SUCCEEDED",
        createdAt: { gte: since },
      },
      _sum: { amountCents: true },
    }),
    db.orderItem.groupBy({
      by: ["productTitle"],
      where: { order: paidInWindow },
      _sum: { quantity: true, lineTotalCents: true },
      orderBy: { _sum: { lineTotalCents: "desc" } },
      take: 5,
    }),
  ]);

  const grossSalesCents = totals._sum.totalCents ?? 0;
  const refundedCents = refunds._sum.amountCents ?? 0;
  return {
    days,
    orderCount: totals._count,
    grossSalesCents,
    refundedCents,
    netSalesCents: grossSalesCents - refundedCents,
    averageOrderCents: totals._count
      ? Math.round(grossSalesCents / totals._count)
      : 0,
    topProducts: products.map((product) => ({
      title: product.productTitle,
      quantity: product._sum.quantity ?? 0,
      revenueCents: product._sum.lineTotalCents ?? 0,
    })),
  };
}

export const ACTIVITY_PAGE_SIZE = 50;

/** The store's audit log, newest first, with the name of whoever did each thing. */
export async function listActivity(context: StoreContext, page = 1) {
  requirePermission(context, "reports:view");
  const where = { storeId: context.storeId };
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    db.auditLog.count({ where }),
  ]);
  const names = await userNames(entries.map((entry) => entry.actorUserId));
  return {
    entries,
    names,
    pageCount: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
  };
}

/** Every order placed in the date range (pending checkouts excluded) as a CSV file. */
export async function exportOrdersCsv(
  context: StoreContext,
  range: { from: Date; to: Date },
): Promise<string> {
  requirePermission(context, "reports:view");
  const orders = await db.order.findMany({
    where: {
      storeId: context.storeId,
      status: { not: "PENDING" },
      createdAt: { gte: range.from, lt: range.to },
    },
    orderBy: { orderNumber: "asc" },
    select: {
      orderNumber: true,
      createdAt: true,
      paidAt: true,
      status: true,
      email: true,
      customer: { select: { name: true } },
      currency: true,
      subtotalCents: true,
      discountCents: true,
      discountCode: true,
      shippingCents: true,
      taxCents: true,
      totalCents: true,
      payments: { select: { refundedCents: true } },
      items: { select: { quantity: true } },
    },
  });

  const money = (cents: number) => centsToInputValue(cents);
  return toCsv([
    [
      "Order",
      "Placed",
      "Paid",
      "Status",
      "Customer",
      "Email",
      "Items",
      "Subtotal",
      "Discount",
      "Discount code",
      "Shipping",
      "Tax",
      "Total",
      "Refunded",
      "Currency",
    ],
    ...orders.map((order) => [
      order.orderNumber,
      order.createdAt.toISOString(),
      order.paidAt?.toISOString() ?? "",
      order.status,
      order.customer.name,
      order.email,
      order.items.reduce((sum, item) => sum + item.quantity, 0),
      money(order.subtotalCents),
      money(order.discountCents),
      order.discountCode,
      money(order.shippingCents),
      money(order.taxCents),
      money(order.totalCents),
      money(
        order.payments.reduce((sum, payment) => sum + payment.refundedCents, 0),
      ),
      order.currency,
    ]),
  ]);
}
