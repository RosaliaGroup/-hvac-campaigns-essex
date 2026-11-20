/**
 * Residential service area for homeowner booking forms (owner rule Nov 10 2026:
 * NJ only, within ~25–30 miles of 07105, never NY).
 *
 * Checked by the first three digits of the ZIP (USPS sectional center):
 *   070–079  North NJ: Newark, Elizabeth, Jersey City, Paterson, Hackensack,
 *            Morris, Summit, Red Bank/Monmouth north
 *   088–089  Middlesex / Somerset (New Brunswick, Edison, Bridgewater)
 * Everything else in NJ (080–087: Camden, Burlington, Trenton, Ocean, the shore
 * south of Monmouth, etc.) and every non-NJ ZIP is outside the area.
 *
 * To widen or narrow the area, edit SERVICE_ZIP3 below.
 */
export const SERVICE_ZIP3: readonly string[] = [
  "070", "071", "072", "073", "074", "075", "076", "077", "078", "079",
  "088", "089",
];

/** Normalize to a 5-digit ZIP, or null if the input isn't a US ZIP. */
export function normalizeZip(input: string | null | undefined): string | null {
  const m = String(input ?? "").trim().match(/^(\d{5})(?:-?\d{4})?$/);
  return m ? m[1] : null;
}

export function isInServiceArea(zip: string | null | undefined): boolean {
  const z = normalizeZip(zip);
  return z !== null && SERVICE_ZIP3.includes(z.slice(0, 3));
}

/**
 * Join first + last name without doubling it. Mobile autofill sometimes puts the
 * full name in both boxes ("Farada Thompson" + "Farada Thompson").
 */
export function joinName(first: string | null | undefined, last: string | null | undefined): string {
  const f = String(first ?? "").trim().replace(/\s+/g, " ");
  const l = String(last ?? "").trim().replace(/\s+/g, " ");
  if (!l) return f;
  if (!f) return l;
  const fl = f.toLowerCase();
  const ll = l.toLowerCase();
  if (fl === ll || fl.endsWith(` ${ll}`)) return f;
  if (ll.startsWith(`${fl} `)) return l;
  return `${f} ${l}`;
}
