import { z } from "zod";
import { parseMoneyToCents } from "../money";

/** Codes are stored in capitals, so "summer10" and "SUMMER10" are the same code. */
export const discountCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, "At least 3 characters")
  .max(30, "At most 30 characters")
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Letters, numbers, - and _ only");

const optionalMoney = z.string().transform((value, context) => {
  if (value.trim() === "") return null;
  const cents = parseMoneyToCents(value);
  if (cents === null || cents <= 0) {
    context.addIssue({
      code: "custom",
      message: "Enter an amount like 50.00, or leave empty",
    });
    return z.NEVER;
  }
  return cents;
});

const optionalDate = z.string().transform((value, context) => {
  if (value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    context.addIssue({ code: "custom", message: "Enter a valid date" });
    return z.NEVER;
  }
  return date;
});

/** The discount form as the merchant fills it in. */
export const discountFormSchema = z
  .object({
    code: discountCodeSchema,
    kind: z.enum(["PERCENT", "FIXED"]),
    // "15" for 15% off, or "10.00" for $10 off.
    amount: z.string().trim().min(1, "Enter the discount"),
    minSubtotal: optionalMoney.prefault(""),
    startsAt: optionalDate.prefault(""),
    endsAt: optionalDate.prefault(""),
    usageLimit: z
      .string()
      .trim()
      .transform((value, context) => {
        if (value === "") return null;
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 1) {
          context.addIssue({
            code: "custom",
            message: "Enter a whole number of uses, or leave empty",
          });
          return z.NEVER;
        }
        return limit;
      })
      .prefault(""),
  })
  .transform((input, context) => {
    let value: number | null = null;
    if (input.kind === "PERCENT") {
      const percent = Number(input.amount);
      if (Number.isFinite(percent) && percent > 0 && percent <= 100)
        value = Math.round(percent * 100);
      else
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: "Enter a percentage from 1 to 100",
        });
    } else {
      value = parseMoneyToCents(input.amount);
      if (value === null || value <= 0) {
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: "Enter an amount like 10.00",
        });
      }
    }
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The end must be after the start",
      });
    }
    return { ...input, value: value ?? 0 };
  });

export type DiscountFormInput = z.input<typeof discountFormSchema>;
