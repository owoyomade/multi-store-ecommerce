/**
 * Picks black or white text for a background colour so text stays readable
 * whatever brand colour a merchant chooses. Uses the WCAG relative-luminance
 * formula; 0.179 is the luminance where black and white give equal contrast.
 */
export function readableTextColor(
  hexBackground: string,
): "#000000" | "#ffffff" {
  const channels = [1, 3, 5].map(
    (start) => parseInt(hexBackground.slice(start, start + 2), 16) / 255,
  );
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
