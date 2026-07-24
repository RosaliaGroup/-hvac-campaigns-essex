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

/**
 * Best-effort parse of a one-line free-text service address into structured
 * parts. Shared by the client (reconciliation prefill) and the server (booking
 * forward-fill completeness gate) so both judge "usable/complete" identically.
 *
 * Conservative on purpose: only what it can confidently extract is filled, so an
 * ambiguous line yields blank city/state/ZIP → `isCompleteAddress` is false →
 * callers treat it as INCOMPLETE (never auto-promoted to a Property).
 */
export interface ParsedAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
}

export function parseFreeTextAddress(text?: string | null): ParsedAddress {
  const raw = (text ?? "").trim();
  const res: ParsedAddress = {
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
  };
  if (!raw) return res;
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  res.addressLine1 = parts[0] ?? raw;
  const zipM = raw.match(/\b(\d{5}(?:-\d{4})?)\b/);
  if (zipM) res.zip = zipM[1];
  const stateM = raw.match(/\b([A-Za-z]{2})\b(?=\s+\d{5})/);
  if (stateM) res.state = stateM[1].toUpperCase();
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1];
    const cityFromTail = tail
      .replace(/\b[A-Za-z]{2}\b\s+\d{5}(?:-\d{4})?\s*$/, "")
      .replace(/\b\d{5}(?:-\d{4})?\s*$/, "")
      .trim();
    res.city = cityFromTail || parts[parts.length - 2] || "";
    if (parts.length > 2 && cityFromTail) res.addressLine2 = parts.slice(1, parts.length - 1).join(", ");
  }
  return res;
}
