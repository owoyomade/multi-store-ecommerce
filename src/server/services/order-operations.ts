import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { reportError } from "../observability";
import { sendEmail } from "../email/mailer";
import { orderShippedMessage } from "../email/templates";
import { NotFoundError, RuleViolationError } from "../errors";
import type { PaymentProvider } from "../payments/provider";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";
import { cancelPendingOrder } from "./checkout";
import { getDefaultLocationId } from "./inventory";

type Transaction = Prisma.TransactionClient;

/**
 * The order lifecycle. A status can only move along these arrows, so an
 * order can't be shipped twice or refunded after it was cancelled.
 * PENDING → PAID is done by the payment webhook, not by staff.
 */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canMoveTo(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUSES[from].includes(to);
}

async function loadOwnedOrder(context: StoreContext, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, storeId: context.storeId },
    select: { id: true, status: true, orderNumber: true, email: true },
  });
  if (!order) throw new NotFoundError("Order");
  return order;
}

/**
 * Moves an order to a new status inside a transaction, only if it is still
 * in the status we read (so two staff clicking at once can't both succeed).
 */
async function transition(
  tx: Transaction,
  context: StoreContext,
  order: { id: string; status: OrderStatus },
  to: OrderStatus,
  note: string,
) {
  if (!canMoveTo(order.status, to)) {
    throw new RuleViolationError(
      `An order that is ${order.status.toLowerCase()} can't be marked ${to.toLowerCase()}.`,
    );
  }
  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: to },
  });
  if (count === 0)
    throw new RuleViolationError(
      "This order was just changed by someone else. Reload and try again.",
    );
  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: to,
      actorUserId: context.userId,
      note,
    },
  });
  await recordAudit(tx, {
    storeId: context.storeId,
    actorUserId: context.userId,
    action: "order.status_changed",
    entityType: "order",
    entityId: order.id,
    metadata: { from: order.status, to },
  });
}

export async function markOrderProcessing(
  context: StoreContext,
  orderId: string,
) {
  requirePermission(context, "orders:fulfill");
  const order = await loadOwnedOrder(context, orderId);
  await db.$transaction((tx) =>
    transition(tx, context, order, "PROCESSING", "Being packed"),
  );
}

export const shipmentSchema = z.object({
  carrier: z.string().trim().min(1, "Which carrier is delivering it?").max(60),
  trackingNumber: z.string().trim().min(3, "Enter the tracking number").max(80),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    // Only web links: a javascript: or data: URL in a customer email would be dangerous.
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Start the link with https://",
    )
    .default(""),
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

/** Records the shipment, marks the order shipped and emails the customer. */
export async function shipOrder(
  context: StoreContext,
  orderId: string,
  input: ShipmentInput,
) {
  requirePermission(context, "orders:fulfill");
  const shipment = shipmentSchema.parse(input);
  const order = await loadOwnedOrder(context, orderId);

  await db.$transaction(async (tx) => {
    await transition(
      tx,
      context,
      order,
      "SHIPPED",
      `Shipped with ${shipment.carrier}`,
    );
    await tx.shipment.create({
      data: {
        storeId: context.storeId,
        orderId,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl || null,
        createdById: context.userId,
      },
    });
  });

  // Sent after the commit; a mail failure must not undo the shipment.
  const store = await db.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: { name: true },
  });
  try {
    await sendEmail(
      orderShippedMessage({
        to: order.email,
        storeName: store.name,
        orderNumber: order.orderNumber,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl || null,
      }),
    );
  } catch (error) {
    await reportError("email.order_shipped_failed", error, { orderId });
  }
}

export async function markOrderDelivered(
  context: StoreContext,
  orderId: string,
) {
  requirePermission(context, "orders:fulfill");
  const order = await loadOwnedOrder(context, orderId);
  await db.$transaction(async (tx) => {
    await transition(tx, context, order, "DELIVERED", "Delivered");
    await tx.shipment.updateMany({
      where: { orderId, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
  });
}

/** Puts every tracked item of the order back into stock, once, with a RETURN ledger entry. */
async function restockOrder(
  tx: Transaction,
  context: StoreContext,
  orderId: string,
) {
  const alreadyRestocked = await tx.refund.count({
    where: { orderId, restocked: true },
  });
  if (alreadyRestocked > 0) return false;
  const locationId = await getDefaultLocationId(tx, context.storeId);
  const items = await tx.orderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: {
      variantId: true,
      quantity: true,
      variant: { select: { trackInventory: true } },
    },
  });
  for (const item of items) {
    if (!item.variantId || !item.variant?.trackInventory) continue;
    await tx.inventoryLevel.updateMany({
      where: { variantId: item.variantId, locationId },
      data: { onHand: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        storeId: context.storeId,
        variantId: item.variantId,
        locationId,
        delta: item.quantity,
        reason: "RETURN",
        orderId,
        actorUserId: context.userId,
      },
    });
  }
  return true;
}

export const refundSchema = z.object({
  amountCents: z.number().int().positive("Enter an amount above zero"),
  reason: z.string().trim().min(2, "Say why, for the order history").max(300),
  restock: z.boolean().default(false),
});

export type RefundInput = z.input<typeof refundSchema>;

/**
 * Refunds part or all of an order through the payment provider.
 *
 * The amount is reserved on the payment row first with a conditional update
 * (refundedCents + amount <= amountCents), so two refunds issued at the same
 * moment can never add up to more than was paid. If the provider call fails,
 * the reservation is given back and the failure is recorded.
 */
export async function refundOrder(
  context: StoreContext,
  orderId: string,
  input: RefundInput,
  provider: PaymentProvider,
  options: { finalStatus?: "REFUNDED" | "CANCELLED" } = {},
) {
  requirePermission(context, "orders:refund");
  const refund = refundSchema.parse(input);
  const order = await loadOwnedOrder(context, orderId);
  if (!["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) {
    throw new RuleViolationError("Only paid orders can be refunded.");
  }
  const payment = await db.payment.findFirst({
    where: { orderId, storeId: context.storeId, status: "SUCCEEDED" },
    select: { id: true, providerPaymentId: true, amountCents: true },
  });
  if (!payment?.providerPaymentId)
    throw new RuleViolationError(
      "This order has no captured payment to refund.",
    );

  const reserved = await db.$executeRaw`
    UPDATE "payments" SET "refundedCents" = "refundedCents" + ${refund.amountCents}, "updatedAt" = NOW()
    WHERE "id" = ${payment.id} AND "refundedCents" + ${refund.amountCents} <= "amountCents"`;
  if (reserved === 0)
    throw new RuleViolationError(
      "That's more than is left to refund on this order.",
    );

  const refundId = randomUUID();
  let providerRefundId: string;
  try {
    ({ refundId: providerRefundId } = await provider.refund({
      paymentId: payment.providerPaymentId,
      amountCents: refund.amountCents,
      idempotencyKey: `refund-${refundId}`,
    }));
  } catch (error) {
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: { refundedCents: { decrement: refund.amountCents } },
      }),
      db.refund.create({
        data: {
          id: refundId,
          storeId: context.storeId,
          orderId,
          paymentId: payment.id,
          amountCents: refund.amountCents,
          reason: refund.reason,
          status: "FAILED",
          createdById: context.userId,
        },
      }),
    ]);
    await reportError("refund.provider_error", error, { orderId });
    throw new RuleViolationError(
      "The payment provider couldn't process the refund. Nothing was refunded; try again.",
    );
  }

  await db.$transaction(async (tx) => {
    const restocked = refund.restock
      ? await restockOrder(tx, context, orderId)
      : false;
    await tx.refund.create({
      data: {
        id: refundId,
        storeId: context.storeId,
        orderId,
        paymentId: payment.id,
        amountCents: refund.amountCents,
        reason: refund.reason,
        status: "SUCCEEDED",
        providerRefundId,
        restocked,
        createdById: context.userId,
      },
    });
    const { refundedCents } = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: { refundedCents: true },
    });
    if (refundedCents >= payment.amountCents) {
      await transition(
        tx,
        context,
        order,
        options.finalStatus ?? "REFUNDED",
        refund.reason,
      );
    } else {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          actorUserId: context.userId,
          note: `Partial refund: ${refund.reason}`,
        },
      });
    }
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "order.refunded",
      entityType: "order",
      entityId: orderId,
      metadata: { amountCents: refund.amountCents, restocked },
    });
  });
}

/**
 * Cancels an order that hasn't shipped. An unpaid order just releases its
 * reserved stock; a paid one is refunded in full and its items restocked.
 */
export async function cancelOrder(
  context: StoreContext,
  orderId: string,
  reason: string,
  provider: PaymentProvider,
) {
  requirePermission(context, "orders:refund");
  const order = await loadOwnedOrder(context, orderId);
  const note = reason.trim() || "Cancelled by staff";

  if (order.status === "PENDING") {
    await db.$transaction(async (tx) => {
      if (!(await cancelPendingOrder(tx, orderId, note, context.userId))) {
        throw new RuleViolationError("This order can no longer be cancelled.");
      }
      await recordAudit(tx, {
        storeId: context.storeId,
        actorUserId: context.userId,
        action: "order.cancelled",
        entityType: "order",
        entityId: orderId,
      });
    });
    return;
  }
  if (!canMoveTo(order.status, "CANCELLED")) {
    throw new RuleViolationError(
      "Shipped orders can't be cancelled. Refund them instead.",
    );
  }
  const payment = await db.payment.findFirst({
    where: { orderId, status: "SUCCEEDED" },
    select: { amountCents: true, refundedCents: true },
  });
  const remaining = payment ? payment.amountCents - payment.refundedCents : 0;
  if (remaining <= 0)
    throw new RuleViolationError(
      "There is nothing left to refund on this order.",
    );
  await refundOrder(
    context,
    orderId,
    { amountCents: remaining, reason: note, restock: true },
    provider,
    {
      finalStatus: "CANCELLED",
    },
  );
}

export async function addOrderNote(
  context: StoreContext,
  orderId: string,
  body: string,
) {
  requirePermission(context, "orders:view");
  const text = body.trim();
  if (!text) throw new RuleViolationError("Write something first.");
  if (text.length > 2000)
    throw new RuleViolationError("Notes can be up to 2,000 characters.");
  await loadOwnedOrder(context, orderId);
  await db.orderNote.create({
    data: {
      storeId: context.storeId,
      orderId,
      authorUserId: context.userId,
      body: text,
    },
  });
}
