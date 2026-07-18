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
