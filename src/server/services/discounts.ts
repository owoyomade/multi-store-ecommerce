import "server-only";
import type { Discount, Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import {
  discountCodeSchema,
  discountFormSchema,
  type DiscountFormInput,
} from "@/lib/validation/discount";
import { db } from "../db";
import {
  FieldConflictError,
  NotFoundError,
  RuleViolationError,
} from "../errors";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";

type Transaction = Prisma.TransactionClient;

/** How much a discount takes off a subtotal, never more than the subtotal itself. */
export function discountAmount(
  discount: Pick<Discount, "kind" | "value">,
  subtotalCents: number,
): number {
  const amount =
    discount.kind === "PERCENT"
      ? Math.floor((subtotalCents * discount.value) / 10_000)
      : discount.value;
  return Math.min(amount, subtotalCents);
}

/**
 * Finds a code a shopper typed and checks it can be used on this cart.
 * Throws a message written for the shopper when it can't.
 */
export async function findUsableDiscount(
  storeId: string,
  rawCode: string,
  subtotalCents: number,
  currency: string,
) {
  const parsed = discountCodeSchema.safeParse(rawCode);
  if (!parsed.success)
    throw new RuleViolationError("We don't recognise that code.");
  const discount = await db.discount.findUnique({
    where: { storeId_code: { storeId, code: parsed.data } },
  });
  const now = new Date();

  if (!discount || !discount.active)
    throw new RuleViolationError("We don't recognise that code.");
  if (discount.startsAt && discount.startsAt > now)
    throw new RuleViolationError("This code isn't active yet.");
  if (discount.endsAt && discount.endsAt <= now)
    throw new RuleViolationError("This code has expired.");
  if (
    discount.usageLimit !== null &&
    discount.usageCount >= discount.usageLimit
  ) {
    throw new RuleViolationError("This code has been used up.");
  }
  if (discount.minSubtotalCents && subtotalCents < discount.minSubtotalCents) {
    throw new RuleViolationError(
      `Spend ${formatMoney(discount.minSubtotalCents, currency)} or more to use this code.`,
    );
  }
  return { discount, amountCents: discountAmount(discount, subtotalCents) };
}

/**
 * Claims one use of a discount inside the checkout transaction. The update
 * only matches while uses remain, so two shoppers can't both take the last one.
 */
export async function claimDiscountUse(
  tx: Transaction,
  discountId: string,
): Promise<void> {
  const claimed = await tx.$executeRaw`
    UPDATE "discounts" SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
    WHERE "id" = ${discountId} AND "active"
      AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
  if (claimed === 0)
    throw new RuleViolationError("This code has just been used up.");
}

/** Gives a use back when an unpaid order using the code is cancelled or abandoned. */
export async function releaseDiscountUse(
  tx: Transaction,
  orderId: string,
): Promise<void> {
  const redemption = await tx.discountRedemption.findUnique({
    where: { orderId },
    select: { id: true, discountId: true },
  });
  if (!redemption) return;
  await tx.discountRedemption.delete({ where: { id: redemption.id } });
  await tx.$executeRaw`
    UPDATE "discounts" SET "usageCount" = GREATEST("usageCount" - 1, 0), "updatedAt" = NOW()
    WHERE "id" = ${redemption.discountId}`;
}

// Merchant dashboard

export async function listDiscounts(context: StoreContext) {
  requirePermission(context, "discounts:manage");
  return db.discount.findMany({
    where: { storeId: context.storeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDiscount(
  context: StoreContext,
  input: DiscountFormInput,
) {
  requirePermission(context, "discounts:manage");
  const data = discountFormSchema.parse(input);
  const existing = await db.discount.findUnique({
    where: { storeId_code: { storeId: context.storeId, code: data.code } },
    select: { id: true },
  });
  if (existing)
    throw new FieldConflictError(
      "code",
      "You already have a code with this name",
    );

  return db.$transaction(async (tx) => {
    const discount = await tx.discount.create({
      data: {
        storeId: context.storeId,
        code: data.code,
        kind: data.kind,
        value: data.value,
        minSubtotalCents: data.minSubtotal,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        usageLimit: data.usageLimit,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "discount.created",
      entityType: "discount",
      entityId: discount.id,
    });
    return discount;
  });
}

/** Pausing keeps the code and its history; shoppers just can't use it. */
export async function setDiscountActive(
  context: StoreContext,
  discountId: string,
  active: boolean,
) {
  requirePermission(context, "discounts:manage");
  await db.$transaction(async (tx) => {
    const { count } = await tx.discount.updateMany({
      where: { id: discountId, storeId: context.storeId },
      data: { active },
    });
    if (count === 0) throw new NotFoundError("Discount");
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: active ? "discount.activated" : "discount.paused",
      entityType: "discount",
      entityId: discountId,
    });
  });
}
