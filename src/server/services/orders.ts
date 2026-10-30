import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import type { ShippingAddress } from "@/lib/validation/checkout";
import { db } from "../db";
import { NotFoundError } from "../errors";
import { requirePermission, type StoreContext } from "../tenancy/store-context";

const ORDERS_PAGE_SIZE = 20;

const orderDetailSelect = {
  id: true,
  orderNumber: true,
  status: true,
  email: true,
  currency: true,
  subtotalCents: true,
  shippingCents: true,
  taxCents: true,
  totalCents: true,
  shippingAddress: true,
  createdAt: true,
  paidAt: true,
  items: {
    select: {
      id: true,
      productTitle: true,
      variantTitle: true,
      sku: true,
      quantity: true,
      unitPriceCents: true,
      lineTotalCents: true,
    },
  },
} satisfies Prisma.OrderSelect;

/** Order JSON columns come back untyped; this gives the address its shape. */
function withAddress<T extends { shippingAddress: Prisma.JsonValue }>(
  order: T,
) {
  return {
    ...order,
    shippingAddress: order.shippingAddress as ShippingAddress,
  };
}

// Shopper-facing lookups

/**
 * The order confirmation page. The checkout session ID in the URL is a long
 * random value only the paying shopper receives, so it works as a key for guests.
 */
export async function getOrderByCheckoutSession(
  storeId: string,
  sessionId: string,
) {
  const payment = await db.payment.findFirst({
    where: { storeId, providerSessionId: sessionId },
    select: { order: { select: orderDetailSelect } },
  });
  return payment ? withAddress(payment.order) : null;
}

/** Orders a signed-in shopper placed in this store (never other stores). */
export async function listOrdersForShopper(storeId: string, userId: string) {
  return db.order.findMany({
    where: { storeId, customer: { userId }, status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      currency: true,
      createdAt: true,
    },
  });
}

export async function getOrderForShopper(
  storeId: string,
  userId: string,
  orderId: string,
) {
  const order = await db.order.findFirst({
    where: { id: orderId, storeId, customer: { userId } },
    select: orderDetailSelect,
  });
  return order ? withAddress(order) : null;
}

export async function listAddressesForShopper(storeId: string, userId: string) {
  return db.address.findMany({
    where: { storeId, customer: { userId } },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteAddressForShopper(
  storeId: string,
  userId: string,
  addressId: string,
) {
  // Scoped to this shopper in this store: someone else's address ID deletes nothing.
  await db.address.deleteMany({
    where: { id: addressId, storeId, customer: { userId } },
  });
}

// Merchant dashboard

export async function listOrders(
  context: StoreContext,
  filters: { status?: OrderStatus; page?: number },
) {
  requirePermission(context, "orders:view");
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.OrderWhereInput = {
    storeId: context.storeId,
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        email: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return {
    orders,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
  };
}

export async function getOrderForDashboard(
  context: StoreContext,
  orderId: string,
) {
  requirePermission(context, "orders:view");
  const order = await db.order.findFirst({
    where: { id: orderId, storeId: context.storeId },
    select: {
      ...orderDetailSelect,
      customer: { select: { name: true } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          actorUserId: true,
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          provider: true,
          status: true,
          amountCents: true,
          providerPaymentId: true,
          createdAt: true,
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Order");
  return withAddress(order);
}
