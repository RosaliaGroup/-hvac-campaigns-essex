/**
 * Canonical navigation target for a displayed Lead / Contact / Customer name.
 *
 * Rules (M0 hotfix):
 *  - Linked to a Customer  → /customers/:customerId
 *  - Lead-only (no Customer) → the Lead detail route
 *  - Never navigate by phone/email when a stable Customer/Lead id exists
 *  - No stable id → null (render as plain, non-navigating text)
 *
 * Pure + framework-free so it's unit-testable and reusable across every surface
 * (appointment cards, lead inbox/scoring, jobs, estimates, invoices, search).
 */
export interface RecordRef {
  customerId?: number | null;
  leadId?: number | null;
}

/** The path to open the canonical record, or null when no stable id exists. */
export function recordNavPath(ref: RecordRef): string | null {
  if (ref.customerId != null && ref.customerId > 0) return `/customers/${ref.customerId}`;
  if (ref.leadId != null && ref.leadId > 0) return `/leads?leadId=${ref.leadId}`;
  return null;
}
