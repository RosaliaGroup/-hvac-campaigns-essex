/**
 * Growth-system consent taxonomy (docs/growth-system-spec.md §0/§1/§7/§11).
 *
 * Three states, stored on `leads.consentStatus` / `leadCaptures.consentStatus` /
 * `importedContacts.consent` (migration 0076):
 *   - "customer": an existing business relationship (job/transaction on file).
 *   - "opt_in":   the contact affirmatively asked to be reached (a self-submitted
 *                 web/phone/chat/ads lead IS this — see DEFAULT_INBOUND_CONSENT below).
 *   - "unknown":  no established relationship and no affirmative opt-in — the safe
 *                 default for owner-supplied cold lists (§7 import) and any future
 *                 B2B list (§6, out of scope here).
 *
 * National DNC (§0/§11): since no scrub provider is wired yet (see
 * shared/dncScrubProvider.ts), we default to SAFE — automated calls/texts only go to
 * "customer" or "opt_in" contacts. "unknown" contacts get email only.
 *
 * JUDGMENT CALL (documented per the build brief): a brand-new lead that submitted a
 * web form / called in / opened chat / submitted an ads lead form has, by definition,
 * proactively asked Mechanical Enterprise to contact them back about a stated need —
 * this is the same "existing relationship / inquiry response" basis every prior
 * version of Jessica's speed-to-lead already relied on. Such inbound leads are
 * therefore seeded as "opt_in", NOT "unknown" — otherwise the compliance gate would
 * silently disable the owner's #1 priority (live speed-to-lead) for every new lead.
 * Cold, owner-supplied CSV rows (§7) and any future B2B prospecting list (§6) are NOT
 * self-initiated contact and correctly default to "unknown" until the owner marks
 * them otherwise on import.
 */
export type ConsentStatus = "customer" | "opt_in" | "unknown";

/** Self-initiated inbound channels (the contact gave Mechanical Enterprise their own
 *  number/email asking to be reached) — see the JUDGMENT CALL note above. */
export const DEFAULT_INBOUND_CONSENT: ConsentStatus = "opt_in";

/** Cold/owner-supplied contacts with no proactive inquiry — fail-closed default. */
export const DEFAULT_COLD_CONSENT: ConsentStatus = "unknown";

/** True when SMS/call automation is allowed for this consent state (absent a DNC hit). */
export function isAutomatedContactAllowed(consent: ConsentStatus): boolean {
  return consent === "customer" || consent === "opt_in";
}

/** 18-month "existing customer" transaction-recency window (§0). */
const CUSTOMER_RECENCY_MONTHS = 18;

/** True when `lastTransactionAt` is within the 18-month existing-customer exemption window. */
export function isRecentCustomerTransaction(lastTransactionAt: Date | string | null, now: Date = new Date()): boolean {
  if (!lastTransactionAt) return false;
  const last = typeof lastTransactionAt === "string" ? new Date(lastTransactionAt) : lastTransactionAt;
  if (Number.isNaN(last.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - CUSTOMER_RECENCY_MONTHS);
  return last.getTime() >= cutoff.getTime();
}

/** Parse a §7 CSV `consent` column value; anything unrecognized fails closed to "unknown". */
export function parseConsentColumn(raw: string | null | undefined): ConsentStatus {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "customer" || v === "opt_in" || v === "opt-in" || v === "optin") return v.startsWith("opt") ? "opt_in" : "customer";
  return "unknown";
}
