/**
 * Label for a KPI delta pill. ALWAYS carries a sign: the SEO dashboard used to print
 * only the magnitude ("28.4%"), so a 28.4% DROP read as a gain unless you noticed the
 * little red arrow. Uses a real minus sign (U+2212) so it can't be mistaken for a hyphen.
 */
export function signedDeltaLabel(value: number, format: (magnitude: number) => string): string {
  if (!value) return format(0);
  return `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;
}
