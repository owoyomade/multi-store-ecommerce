// Formats each currency the way its home market writes it, so a US store
// shows "$36.00" rather than the Canadian-style "US$36.00".
const CURRENCY_LOCALES: Record<string, string> = {
  CAD: "en-CA",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
  NGN: "en-NG",
};

/** 1299 + "CAD" → "$12.99". */
export function formatMoney(
  cents: number,
  currency: string,
  locale = CURRENCY_LOCALES[currency] ?? "en-US",
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
}

/**
 * Parses what a merchant types into a price box ("12", "12.5", "12.50",
 * "1,299.00") into integer cents. Works on the digits as text, so there is no
 * floating-point rounding (0.1 + 0.2 problems). Returns null if invalid.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replaceAll(",", "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 1250 → "12.50", for pre-filling price inputs. */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}
