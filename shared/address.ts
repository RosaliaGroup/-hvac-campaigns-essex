/**
 * Single source of truth for composing a one-line street address from the parts
 * stored on a `properties` row. Shared by the client (appointment prefill) and
 * the server (appointment normalization) so both render identical location text.
 */
export interface AddressParts {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export function formatPropertyAddress(p?: AddressParts | null): string {
  if (!p) return "";
  const cityStateZip = [[p.city, p.state].map(s => s?.trim()).filter(Boolean).join(", "), p.zip?.trim()]
    .filter(Boolean)
    .join(" ");
  return [p.addressLine1, p.addressLine2, cityStateZip]
    .map(s => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/** Address parts required for a COMPLETE service address (Unit/line2 is optional). */
export const REQUIRED_ADDRESS_FIELDS = ["Street", "City", "State", "ZIP"] as const;

/** Labels of the required address parts that are missing/blank, in display order. */
export function missingAddressParts(p?: AddressParts | null): string[] {
  const blank = (v?: string | null) => !v || !v.trim();
  const missing: string[] = [];
  if (blank(p?.addressLine1)) missing.push("Street");
  if (blank(p?.city)) missing.push("City");
  if (blank(p?.state)) missing.push("State");
  if (blank(p?.zip)) missing.push("ZIP");
  return missing;
}

/** True when Street + City + State + ZIP are all present. */
export function isCompleteAddress(p?: AddressParts | null): boolean {
  return missingAddressParts(p).length === 0;
}
