// Spreadsheet apps run a cell that starts with one of these as a formula, so a
// customer named "=HYPERLINK(...)" could plant a working link or command in a
// merchant's export ("CSV injection"). Such cells get a leading apostrophe,
// which spreadsheets show as plain text.
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger))
    ? `'${value}`
    : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Joins rows into CSV text with Windows line endings, which every spreadsheet app accepts. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
