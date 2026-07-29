/**
 * Lead → QuickBooks customer auto-sync (policy: every new lead becomes a QB customer).
 *
 * Wired into every lead-creation entry point (public capture forms incl. Quick Quote,
 * the internal Lead Tracker create, the SMS conversation "Create Lead", and the Meta
 * Lead-Ads webhook). After a lead row is inserted with at least a phone OR email, the
 * entry point calls `enqueueLeadCustomerSync(...)`, which fires a background,
 * fire-and-forget job:
 *
 *   (a) resolve-or-create the CRM customer via the existing dedupe helpers
 *       (last-10 phone / case-insensitive email), then
 *   (b) push it to QuickBooks with auto-LINK on any phone/email/name match — this is
 *       LIVE production QBO with years of directly-entered customers, so we NEVER
 *       create a duplicate. `pushOne(id, "link")` links to the matched QBO customer
 *       (or creates one only when there is no match) and writes the resulting qbId
 *       back onto the CRM row so the ~3-min inbound pull recognizes it (no ping-pong),
 *   (c) a quickbooksSyncLogs row is written by `pushOne` (success or failure).
 *
 * CRITICAL: none of this may block or fail lead capture. `enqueueLeadCustomerSync`
 * returns synchronously and the worker swallows every error — QuickBooks being down,
 * disconnected, or erroring is invisible to the form submission.
 */
import { getDb } from "../db";
import { customers, type InsertCustomer } from "../../drizzle/schema";
import { findExistingCustomer, buildDisplayName, splitName } from "../routers/customers";
import { pushOne } from "../routers/quickbooks";
import { quickbooksProvider } from "../integrations/accounting/quickbooks";

export interface LeadCustomerSyncInput {
  /** Free-text full name (used when firstName/lastName are absent). */
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Marketing source stored on a newly-created customer row (e.g. "web:quick_quote"). */
  source?: string | null;
  /** Human label for logs, e.g. "leadCapture:quick_quote" or "meta_lead_ad:123". */
  origin: string;
}

/**
 * The actual worker. Exported for unit tests; production code should call
 * `enqueueLeadCustomerSync` so failures never propagate.
 */
export async function runLeadCustomerSync(input: LeadCustomerSyncInput): Promise<void> {
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  // Policy guard: nothing to resolve a customer from → skip (never an error).
  if (!phone && !email) return;

  const db = await getDb();
  if (!db) return;

  // (a) Resolve-or-create the CRM customer (dedupe by last-10 phone / lower(email)).
  const existing = await findExistingCustomer(db, phone, email);
  let customerId: number;
  if (existing) {
    customerId = existing.id;
    // Already linked to QuickBooks → nothing to push. Idempotent: re-touching a
    // linked customer on every lead would spam QBO and risk clobbering QBO-side edits.
    if (existing.quickbooksCustomerId) return;
  } else {
    const named = input.firstName || input.lastName
      ? { firstName: input.firstName ?? null, lastName: input.lastName ?? null }
      : splitName(input.name);
    const displayName = buildDisplayName({
      firstName: named.firstName,
      lastName: named.lastName,
      email,
      phone,
    });
    const values: InsertCustomer = {
      type: "residential",
      firstName: named.firstName,
      lastName: named.lastName,
      displayName,
      email,
      phone,
      source: input.source?.slice(0, 255) ?? null,
    };
    const ins = await db.insert(customers).values(values);
    customerId = Number((ins as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    if (!customerId) return;
  }

  // (b) Push to QBO with auto-LINK on match. Skip cleanly when QBO isn't connected so
  // we don't mark the fresh customer "error" for a known, non-error condition — a later
  // backfill/manual push picks it up (it stays quickbooksSyncStatus="not_synced").
  const conn = await quickbooksProvider.getConnection();
  if (!conn || conn.status !== "connected") {
    console.log(
      `[leadQbo] QuickBooks not connected — customer #${customerId} left unsynced (${input.origin})`,
    );
    return;
  }
  // resolution="link": link to any QBO phone/email/name match, else create — never a
  // duplicate. pushOne persists qbId + "synced" and writes the sync-log row.
  await pushOne(customerId, "link");
}

/**
 * Fire-and-forget entry point for lead-creation call sites. Returns immediately and
 * NEVER throws — QuickBooks problems must be invisible to lead capture.
 */
export function enqueueLeadCustomerSync(input: LeadCustomerSyncInput): void {
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  if (!phone && !email) return; // nothing to sync; don't even schedule
  void runLeadCustomerSync({ ...input, phone, email }).catch((err) =>
    console.error(`[leadQbo] auto-sync failed (${input.origin}):`, (err as Error)?.message ?? err),
  );
}
