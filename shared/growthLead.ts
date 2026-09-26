/**
 * Growth-system `leads` / `leadCaptures` bridge — the TYPE side of the adapter.
 *
 * The two tables are NOT unified in the database (see the build report for why a
 * migration was still needed for consent/cadence columns despite this being a
 * code-level bridge, not a DB view). `UnifiedLead` is the one shape growth-system
 * code reads and writes through; server/services/growth/leadAdapter.ts is the I/O
 * side (a union query across both tables + table-aware writers).
 */
import { type ConsentStatus } from "./growthConsent";
import { type LeadNeed } from "./growthCadencePlan";

export type LeadSourceTable = "leads" | "leadCaptures";
/** Cadence enrollment also accepts §7 imported contacts, which have no adapter of
 *  their own (contactImport.ts builds a UnifiedLead-shaped object directly). */
export type CadenceSourceTable = LeadSourceTable | "imported";

export interface UnifiedLead {
  table: CadenceSourceTable;
  id: number;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Free-text need/service description as captured (message/service field). */
  needRaw: string | null;
  source: string | null;
  consentStatus: ConsentStatus;
  customerId: number | null;
  createdAt: Date;
}

/** Stable per-contact key for caps/suppression/dedupe — phone preferred, else email. */
export function contactKeyOf(lead: Pick<UnifiedLead, "phone" | "email">): string | null {
  const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length >= 10) return `phone:${phoneDigits.slice(-10)}`;
  const email = (lead.email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;
  return null;
}

export function displayFirstName(lead: Pick<UnifiedLead, "firstName" | "name">): string {
  if (lead.firstName?.trim()) return lead.firstName.trim();
  const fromName = lead.name?.trim().split(/\s+/)[0];
  return fromName || "there";
}

export { type LeadNeed };
