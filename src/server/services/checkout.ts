import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { db } from "../db";
import { reportError } from "../observability";
import { sendEmail } from "../email/mailer";
import { orderConfirmationMessage } from "../email/templates";
import { RuleViolationError } from "../errors";
import type {
  PaymentProvider,
  PaymentWebhookEvent,
} from "../payments/provider";
import {
  claimDiscountUse,
  findUsableDiscount,
  releaseDiscountUse,
} from "./discounts";
import { getDefaultLocationId } from "./inventory";

// Stripe requires a checkout session to stay open for at least 30 minutes.
// Stock is held a little longer than the session so a shopper paying in the
// final seconds still has their items.
const CHECKOUT_SESSION_MINUTES = 31;
const RESERVATION_MINUTES = 35;

type Transaction = Prisma.TransactionClient;

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/**
 * Demo shipping and tax rules, configured per store. They are deliberately
 * simple and labelled "demo" in the UI: real tax needs jurisdiction-specific
 * calculation (e.g. Stripe Tax) before a store sells for real.
 */
export function calculateTotals(
  subtotalCents: number,
  settings: {
    demoTaxRateBps: number;
    flatShippingCents: number;
    freeShippingOverCents: number | null;
  },
  discountCents = 0,
): Totals {
  // Shipping and tax are worked out on what the shopper pays for the goods,
  // i.e. after any discount.
  const goodsCents = subtotalCents - discountCents;
  const freeShipping =
    settings.freeShippingOverCents !== null &&
    goodsCents >= settings.freeShippingOverCents;
  const shippingCents =
    subtotalCents === 0 || freeShipping ? 0 : settings.flatShippingCents;
  // Basis points: 1300 bps = 13%. Rounded to the nearest cent.
  const taxCents = Math.round((goodsCents * settings.demoTaxRateBps) / 10_000);
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: goodsCents + shippingCents + taxCents,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function loadSettings(storeId: string) {
  return db.storeSettings.findUniqueOrThrow({
    where: { storeId },
    select: {
      demoTaxRateBps: true,
      flatShippingCents: true,
      freeShippingOverCents: true,
    },
  });
}

/**
 * Reads the shopper's cart fresh from the database with *current* prices,
 * and lists anything that can't be bought right now.
 */
async function loadCartForCheckout(storeId: string, cartToken: string | null) {
  if (!cartToken) return null;
  const cart = await db.cart.findFirst({
    where: { storeId, tokenHash: hashToken(cartToken) },
    select: {
      id: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          quantity: true,
          variant: {
            select: {
              id: true,
              title: true,
              sku: true,
              priceCents: true,
              trackInventory: true,
              archivedAt: true,
              product: {
                select: { title: true, status: true, deletedAt: true },
              },
            },
          },
        },
      },
    },
  });
  if (!cart) return null;

  const lines = cart.items.map(({ quantity, variant }) => ({
    variantId: variant.id,
    productTitle: variant.product.title,
    variantTitle: variant.title,
    sku: variant.sku,
    unitPriceCents: variant.priceCents,
    quantity,
    lineTotalCents: variant.priceCents * quantity,
    trackInventory: variant.trackInventory,
    purchasable:
      variant.product.status === "PUBLISHED" &&
      !variant.product.deletedAt &&
      !variant.archivedAt,
  }));
  return { cartId: cart.id, lines };
}

/** Totals for the checkout page, before anything is reserved. */
export async function getCheckoutPreview(
  storeId: string,
  cartToken: string | null,
  options: { discountCode?: string; currency: string },
) {
  const cart = await loadCartForCheckout(storeId, cartToken);
  const lines = cart?.lines.filter((line) => line.purchasable) ?? [];
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  // A code that can't be used is reported, not thrown: the shopper can
  // still check out without it.
  let discount: { code: string; amountCents: number } | null = null;
  let discountError: string | null = null;
  if (options.discountCode) {
    try {
      const usable = await findUsableDiscount(
        storeId,
        options.discountCode,
        subtotal,
        options.currency,
      );
      discount = {
        code: usable.discount.code,
        amountCents: usable.amountCents,
      };
    } catch (error) {
      if (!(error instanceof RuleViolationError)) throw error;
      discountError = error.message;
    }
  }
  return {
    lines,
    totals: calculateTotals(
      subtotal,
      await loadSettings(storeId),
      discount?.amountCents ?? 0,
    ),
    discount,
    discountError,
  };
}

/**
 * Atomically reserves stock: the UPDATE only succeeds if enough unreserved
 * units remain. Postgres locks the row while updating, so when two shoppers
 * race for the last unit the second update sees the first one's reservation
 * and matches zero rows.
 */
async function reserveStock(
  tx: Transaction,
  variantId: string,
  locationId: string,
  quantity: number,
) {
  const updated = await tx.$executeRaw`
    UPDATE "inventory_levels"
    SET "reserved" = "reserved" + ${quantity}, "updatedAt" = NOW()
    WHERE "variantId" = ${variantId} AND "locationId" = ${locationId}
      AND "onHand" - "reserved" >= ${quantity}`;
  return updated === 1;
}

async function releaseReservations(
  tx: Transaction,
  orderId: string,
  storeId: string,
) {
  const locationId = await getDefaultLocationId(tx, storeId);
  const items = await tx.orderItem.findMany({
    where: { orderId, stockReserved: true, variantId: { not: null } },
    select: { id: true, variantId: true, quantity: true },
  });
  for (const item of items) {
    await tx.$executeRaw`
      UPDATE "inventory_levels"
      SET "reserved" = GREATEST("reserved" - ${item.quantity}, 0), "updatedAt" = NOW()
      WHERE "variantId" = ${item.variantId} AND "locationId" = ${locationId}`;
  }
  await tx.orderItem.updateMany({
    where: { orderId, stockReserved: true },
    data: { stockReserved: false },
  });
}

/**
 * Cancels an order that is still waiting for payment and gives its reserved
 * stock back. Safe to call more than once: only a PENDING order changes.
 */
export async function cancelPendingOrder(
  tx: Transaction,
  orderId: string,
  note: string,
  actorUserId: string | null = null,
): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { storeId: true },
  });
  if (!order) return false;
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) return false;

  await releaseReservations(tx, orderId, order.storeId);
  await releaseDiscountUse(tx, orderId);
  await tx.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: "PENDING",
      toStatus: "CANCELLED",
      note,
      actorUserId,
    },
  });
  return true;
}

/**
 * Frees stock held by checkouts that were abandoned without the provider
 * telling us (e.g. a webhook that never arrived). Run lazily at the start of
 * each checkout, so no background job is needed for the demo.
 */
export async function releaseExpiredReservations(
  storeId: string,
): Promise<number> {
  const expired = await db.order.findMany({
    where: {
      storeId,
      status: "PENDING",
      reservationExpiresAt: { lt: new Date() },
    },
    select: { id: true },
  });
  let released = 0;
  for (const order of expired) {
    if (
      await db.$transaction((tx) =>
        cancelPendingOrder(tx, order.id, "Checkout not completed in time"),
      )
    ) {
      released += 1;
    }
  }
  return released;
}

type StartCheckoutOptions = {
  store: { id: string; slug: string; currency: string };
  cartToken: string | null;
  viewerUserId: string | null;
  input: CheckoutInput;
  /** Random ID generated when the checkout page loaded; repeats return the same order. */
  idempotencyKey: string;
  /** Absolute storefront URL, e.g. "http://localhost:3210/s/northbrew". */
  storefrontUrl: string;
  provider: PaymentProvider;
};

/**
 * Turns the cart into a PENDING order, reserves its stock, and opens a
 * checkout session with the payment provider. Returns the URL to send the
 * shopper to.
 *
 * Prices are always re-read from the catalog here; nothing about price comes
 * from the browser.
 */
export async function startCheckout(
  options: StartCheckoutOptions,
): Promise<{ checkoutUrl: string }> {
  const {
    store,
    cartToken,
    viewerUserId,
    idempotencyKey,
    storefrontUrl,
    provider,
  } = options;
  const input = checkoutSchema.parse(options.input);

  // A repeated submit (double click, back button) reuses the first attempt.
  const existing = await db.order.findUnique({
    where: { idempotencyKey },
    select: {
      storeId: true,
      status: true,
      payments: { select: { checkoutUrl: true }, take: 1 },
    },
  });
  if (existing) {
    const url = existing.payments[0]?.checkoutUrl;
    if (existing.storeId === store.id && existing.status === "PENDING" && url)
      return { checkoutUrl: url };
    throw new RuleViolationError(
      "This checkout was already submitted. Please return to your cart and try again.",
    );
  }

  await releaseExpiredReservations(store.id);

  const cart = await loadCartForCheckout(store.id, cartToken);
  if (!cart || cart.lines.length === 0)
    throw new RuleViolationError("Your cart is empty.");
  const unavailable = cart.lines.filter((line) => !line.purchasable);
  if (unavailable.length > 0) {
    throw new RuleViolationError(
      `${unavailable.map((line) => line.productTitle).join(", ")} can no longer be bought. Please remove it from your cart.`,
    );
  }

  const settings = await loadSettings(store.id);
  const subtotalCents = cart.lines.reduce(
    (sum, line) => sum + line.lineTotalCents,
    0,
  );
  const discount = input.discountCode
    ? await findUsableDiscount(
        store.id,
        input.discountCode,
        subtotalCents,
        store.currency,
      )
    : null;
  const totals = calculateTotals(
    subtotalCents,
    settings,
    discount?.amountCents ?? 0,
  );
  const reservationExpiresAt = new Date(
    Date.now() + RESERVATION_MINUTES * 60_000,
  );

  const order = await db.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: {
        storeId_email: { storeId: store.id, email: input.email.toLowerCase() },
      },
      update: {
        name: input.address.name,
        ...(viewerUserId ? { userId: viewerUserId } : {}),
      },
      create: {
        storeId: store.id,
        email: input.email.toLowerCase(),
        name: input.address.name,
        userId: viewerUserId,
      },
      select: { id: true },
    });
    if (viewerUserId && input.saveAddress) {
      await tx.address.create({
        data: { ...input.address, storeId: store.id, customerId: customer.id },
      });
    }

    // Atomically take the next order number for this store.
    const [{ orderNumber }] = await tx.$queryRaw<{ orderNumber: number }[]>`
      UPDATE "store_settings" SET "nextOrderNumber" = "nextOrderNumber" + 1
      WHERE "storeId" = ${store.id}
      RETURNING "nextOrderNumber" - 1 AS "orderNumber"`;

    const locationId = await getDefaultLocationId(tx, store.id);
    for (const line of cart.lines.filter(
      (cartLine) => cartLine.trackInventory,
    )) {
      if (
        !(await reserveStock(tx, line.variantId, locationId, line.quantity))
      ) {
        // Throwing rolls back every reservation and the order in this transaction.
        throw new RuleViolationError(
          `Sorry, there isn't enough stock of ${line.productTitle} (${line.variantTitle}) left. Please update your cart.`,
        );
      }
    }

    if (discount) await claimDiscountUse(tx, discount.discount.id);

    const created = await tx.order.create({
      data: {
        storeId: store.id,
        orderNumber,
        discountCode: discount?.discount.code ?? null,
        customerId: customer.id,
        email: input.email.toLowerCase(),
        currency: store.currency,
        ...totals,
        shippingAddress: input.address,
        reservationExpiresAt,
        cartId: cart.cartId,
        idempotencyKey,
        items: {
          create: cart.lines.map((line) => ({
            variantId: line.variantId,
            productTitle: line.productTitle,
            variantTitle: line.variantTitle,
            sku: line.sku,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            lineTotalCents: line.lineTotalCents,
            stockReserved: line.trackInventory,
          })),
        },
        statusHistory: {
          create: {
            toStatus: "PENDING",
            actorUserId: viewerUserId,
            note: "Checkout started",
          },
        },
      },
      select: { id: true, orderNumber: true },
    });
    if (discount) {
      await tx.discountRedemption.create({
        data: {
          storeId: store.id,
          discountId: discount.discount.id,
          orderId: created.id,
          amountCents: discount.amountCents,
        },
      });
    }
    return created;
  });

  // The provider call happens outside the database transaction so we never
  // hold row locks while waiting on the network.
  let session;
  try {
    session = await provider.createCheckoutSession({
      orderId: order.id,
      storeId: store.id,
      currency: store.currency,
      customerEmail: input.email,
      lines: [
        ...cart.lines.map((line) => ({
          name:
            line.variantTitle === "Default"
              ? line.productTitle
              : `${line.productTitle} (${line.variantTitle})`,
          unitAmountCents: line.unitPriceCents,
          quantity: line.quantity,
        })),
        ...(totals.shippingCents > 0
          ? [
              {
                name: "Shipping",
                unitAmountCents: totals.shippingCents,
                quantity: 1,
              },
            ]
          : []),
        ...(totals.taxCents > 0
          ? [
              {
                name: "Tax (demo rate)",
                unitAmountCents: totals.taxCents,
                quantity: 1,
              },
            ]
          : []),
      ],
      discount: discount
        ? { label: discount.discount.code, amountCents: discount.amountCents }
        : null,
      successUrl: `${storefrontUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${storefrontUrl}/checkout/cancelled?session_id={CHECKOUT_SESSION_ID}`,
      expiresAt: new Date(Date.now() + CHECKOUT_SESSION_MINUTES * 60_000),
      idempotencyKey: `checkout-${order.id}`,
    });
  } catch (error) {
    // The provider is down or rejected the request: give the stock back
    // straight away rather than holding it for 35 minutes.
    await db.$transaction((tx) =>
      cancelPendingOrder(tx, order.id, "Payment provider unavailable"),
    );
    await reportError("checkout.provider_error", error, { orderId: order.id });
    throw new RuleViolationError(
      "Payments are temporarily unavailable. Your card was not charged; please try again.",
    );
  }

  await db.payment.create({
    data: {
      storeId: store.id,
      orderId: order.id,
      provider: provider.name,
      providerSessionId: session.sessionId,
      checkoutUrl: session.url,
      amountCents: totals.totalCents,
      currency: store.currency,
      events: { create: { type: "checkout_session_created" } },
    },
  });
  return { checkoutUrl: session.url };
}

/**
 * The shopper clicked "back" on the payment page. Close the session so it
 * can't be paid later, then release the stock immediately.
 */
export async function cancelCheckout(
  storeId: string,
  sessionId: string,
  provider: PaymentProvider,
): Promise<void> {
  const payment = await db.payment.findFirst({
    where: { storeId, providerSessionId: sessionId },
    select: { orderId: true, order: { select: { status: true } } },
  });
  if (!payment || payment.order.status !== "PENDING") return;

  try {
    await provider.expireCheckoutSession(sessionId);
  } catch (error) {
    // Expiring fails if the shopper actually finished paying in another tab.
    // In that case leave the order alone; the payment webhook will mark it paid.
    console.warn("checkout.expire_failed", {
      sessionId,
      error: (error as Error).message,
    });
    return;
  }
  await db.$transaction((tx) =>
    cancelPendingOrder(tx, payment.orderId, "Checkout cancelled by shopper"),
  );
}

/**
 * Marks an order paid and turns its reservations into real stock deductions,
 * each recorded as a SALE in the inventory ledger.
 */
async function markOrderPaid(tx: Transaction, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, storeId: true, status: true, cartId: true },
  });
  if (order.status !== "PENDING" && order.status !== "CANCELLED") return false; // already handled

  // A payment can arrive after the reservation expired and the order was
  // cancelled (e.g. the shopper paid in the last second and the webhook was
  // slow). The money was taken, so the order is honoured, but stock may now
  // be short: the note asks the merchant to check.
  const lateNote =
    order.status === "CANCELLED"
      ? "Payment arrived after the reservation expired. Check stock before shipping."
      : null;

  const locationId = await getDefaultLocationId(tx, order.storeId);
  const items = await tx.orderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: {
      variantId: true,
      quantity: true,
      stockReserved: true,
      variant: { select: { trackInventory: true } },
    },
  });
  for (const item of items) {
    if (!item.variantId || !item.variant?.trackInventory) continue;
    if (item.stockReserved) {
      await tx.$executeRaw`
        UPDATE "inventory_levels"
        SET "onHand" = "onHand" - ${item.quantity}, "reserved" = GREATEST("reserved" - ${item.quantity}, 0), "updatedAt" = NOW()
        WHERE "variantId" = ${item.variantId} AND "locationId" = ${locationId}`;
    } else {
      await tx.$executeRaw`
        UPDATE "inventory_levels" SET "onHand" = "onHand" - ${item.quantity}, "updatedAt" = NOW()
        WHERE "variantId" = ${item.variantId} AND "locationId" = ${locationId}`;
    }
    await tx.inventoryMovement.create({
      data: {
        storeId: order.storeId,
        variantId: item.variantId,
        locationId,
        delta: -item.quantity,
        reason: "SALE",
        orderId,
      },
    });
  }
  await tx.orderItem.updateMany({
    where: { orderId },
    data: { stockReserved: false },
  });

  await tx.order.update({
    where: { id: orderId },
    data: { status: "PAID", paidAt: new Date() },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: order.status,
      toStatus: "PAID",
      note: lateNote ?? "Payment received",
    },
  });
  if (order.cartId)
    await tx.cartItem.deleteMany({ where: { cartId: order.cartId } });
  return true;
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

/**
 * Applies a verified payment webhook. The WebhookEvent insert and every
 * change it causes share one transaction, so a crash mid-way leaves nothing
 * half-done and the provider's retry processes the event cleanly.
 */
export async function processPaymentWebhook(
  event: PaymentWebhookEvent,
  providerName: string,
): Promise<WebhookOutcome> {
  let paidOrderId: string | null = null;

  try {
    const outcome = await db.$transaction(
      async (tx): Promise<WebhookOutcome> => {
        // Fails with a unique violation if we've seen this event before.
        await tx.webhookEvent.create({
          data: {
            provider: providerName,
            providerEventId: event.eventId,
            type: event.kind,
          },
        });
        if (event.kind === "ignored") return "ignored";

        const payment = await tx.payment.findUnique({
          where: { providerSessionId: event.sessionId },
          select: {
            id: true,
            orderId: true,
            amountCents: true,
            currency: true,
          },
        });
        if (!payment) {
          console.warn("webhook.unknown_session", {
            sessionId: event.sessionId,
          });
          return "ignored";
        }

        if (event.kind === "checkout_expired") {
          await tx.paymentEvent.create({
            data: { paymentId: payment.id, type: "checkout_expired" },
          });
          await cancelPendingOrder(
            tx,
            payment.orderId,
            "Checkout expired without payment",
          );
          return "processed";
        }

        if (!event.paid) {
          await tx.paymentEvent.create({
            data: { paymentId: payment.id, type: "checkout_completed_unpaid" },
          });
          return "processed";
        }

        // Never trust that the charged amount matches: compare with what we asked for.
        if (
          event.amountCents !== payment.amountCents ||
          event.currency !== payment.currency
        ) {
          await tx.paymentEvent.create({
            data: {
              paymentId: payment.id,
              type: "amount_mismatch",
              details: {
                expected: payment.amountCents,
                received: event.amountCents,
                currency: event.currency,
              },
            },
          });
          // Not awaited: this runs inside a database transaction, which
          // shouldn't wait on a network call to the error tracker.
          void reportError(
            "webhook.amount_mismatch",
            new Error("Charged amount differs from order total"),
            { paymentId: payment.id },
          );
          return "processed";
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCEEDED", providerPaymentId: event.paymentId },
        });
        await tx.paymentEvent.create({
          data: { paymentId: payment.id, type: "payment_succeeded" },
        });
        if (await markOrderPaid(tx, payment.orderId))
          paidOrderId = payment.orderId;
        return "processed";
      },
    );

    if (paidOrderId) await sendOrderConfirmation(paidOrderId);
    return outcome;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return "duplicate";
    throw error;
  }
}

/**
 * Sent after the payment transaction commits. A mail failure is logged but
 * doesn't undo the order: the payment really happened.
 */
async function sendOrderConfirmation(orderId: string) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      email: true,
      orderNumber: true,
      currency: true,
      subtotalCents: true,
      shippingCents: true,
      taxCents: true,
      totalCents: true,
      store: { select: { name: true, slug: true } },
      items: {
        select: {
          productTitle: true,
          variantTitle: true,
          quantity: true,
          lineTotalCents: true,
        },
      },
      payments: {
        where: { status: "SUCCEEDED" },
        select: { providerSessionId: true },
        take: 1,
      },
    },
  });
  const money = (cents: number) => formatMoney(cents, order.currency);
  try {
    await sendEmail(
      orderConfirmationMessage({
        to: order.email,
        storeName: order.store.name,
        orderNumber: order.orderNumber,
        lines: order.items.map((item) => ({
          title:
            item.variantTitle === "Default"
              ? item.productTitle
              : `${item.productTitle} (${item.variantTitle})`,
          quantity: item.quantity,
          lineTotal: money(item.lineTotalCents),
        })),
        subtotal: money(order.subtotalCents),
        shipping: money(order.shippingCents),
        tax: money(order.taxCents),
        total: money(order.totalCents),
        // The confirmation page is keyed by the unguessable checkout session ID,
        // so guests can reopen it without an account.
        orderUrl: `${process.env.APP_URL}/s/${order.store.slug}/checkout/success?session_id=${order.payments[0]?.providerSessionId ?? ""}`,
      }),
    );
  } catch (error) {
    await reportError("email.order_confirmation_failed", error, { orderId });
  }
}
