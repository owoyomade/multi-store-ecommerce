// Helpers for reading URL query strings, which can be a string, an array
// (?a=1&a=2) or missing. Anything unexpected falls back to undefined.

type SearchParamValue = string | string[] | undefined;

export function firstParam(value: SearchParamValue): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

export function pageParam(value: SearchParamValue): number {
  const page = Number(firstParam(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function oneOf<T extends string>(
  value: SearchParamValue,
  allowed: readonly T[],
): T | undefined {
  const first = firstParam(value);
  return allowed.find((option) => option === first);
}

/** Builds "?a=1&b=2" from an object, dropping empty values. */
export function toQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false)
      query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
