import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["0.10", 10],
    ["1,299.99", 129999],
    [" 7.05 ", 705],
  ])("parses %s as %i cents", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "12.345", "-5", "1e3", "12.5.0"])(
    "rejects %s",
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );
});

describe("formatMoney", () => {
  it("formats cents in the store currency", () => {
    expect(formatMoney(129999, "CAD", "en-CA")).toBe("$1,299.99");
    expect(formatMoney(500, "USD", "en-US")).toBe("$5.00");
  });
});
