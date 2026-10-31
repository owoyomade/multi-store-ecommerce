import { z } from "zod";

/** Reasons a merchant can pick by hand. SALE and INITIAL_STOCK are only written by the system. */
export const MANUAL_STOCK_REASONS = {
  RESTOCK: "Received stock",
  RETURN: "Customer return",
  ADJUSTMENT: "Correction (count, damage, loss)",
} as const;

export const stockAdjustmentSchema = z.object({
  change: z
    .string()
    .trim()
    .transform((value, context) => {
      const change = Number(value);
      if (
        !Number.isInteger(change) ||
        change === 0 ||
        Math.abs(change) > 100_000
      ) {
        context.addIssue({
          code: "custom",
          message: "Enter a whole number like 12 or -3",
        });
        return z.NEVER;
      }
      return change;
    }),
  // Read as a plain string from the form, then narrowed to a known reason.
  reason: z
    .string()
    .pipe(z.enum(["RESTOCK", "RETURN", "ADJUSTMENT"], "Choose a reason")),
  note: z.string().trim().max(200, "At most 200 characters").prefault(""),
});

export type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>;
