import { describe, expect, it } from "vitest";
import { calculateTotals } from "@/server/services/checkout";

const settings = {
  demoTaxRateBps: 1300,
  flatShippingCents: 900,
  freeShippingOverCents: 7500,
};

describe("calculateTotals", () => {
  it("adds flat shipping and rounded tax below the free-shipping threshold", () => {
    expect(calculateTotals(1999, settings)).toEqual({
      subtotalCents: 1999,
      shippingCents: 900,
      taxCents: 260, // 13% of 19.99 = 2.5987 → 2.60
      totalCents: 3159,
    });
  });

  it("ships free at or above the threshold", () => {
    expect(calculateTotals(7500, settings).shippingCents).toBe(0);
  });

  it("charges nothing for an empty cart", () => {
    expect(calculateTotals(0, settings).totalCents).toBe(0);
  });

  it("supports stores without free shipping", () => {
    expect(
      calculateTotals(100_000, { ...settings, freeShippingOverCents: null })
        .shippingCents,
    ).toBe(900);
  });
});
