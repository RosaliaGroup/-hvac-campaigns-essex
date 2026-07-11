/**
 * Standalone QBO CUSTOMER refresh — deliberately isolated from sales-doc sync.
 *
 * Given explicit CRM/QBO customer ids, it fetches the QBO Customer directly and
 * fills EMPTY CRM fields only. It NEVER queries or processes estimates/invoices,
 * never invokes the estimate/invoice upsert path, and never reads or advances the
 * sales-document cursor / lastQboSyncAt. Both the QBO fetch and the DB are
 * injected, so the whole thing is unit-tested with mocks and no network/DB.
 *
 * Timestamp semantics (from the audit):
 *   • quickbooksCustomerCheckedAt  — set after every successful fetch (we looked).
 *   • quickbooksCustomerUpdatedAt  — set ONLY when the QBO version is actually
 *     applied to a field (a real change was written).
 *
 * Default mode is dry-run. Apply writes only empty→value fills unless a caller
 * opts into `allowComposite` (the reviewed repair path), which this module keeps
 * off by default so a raw composite DisplayName is never copied onto a clean name.
 */
import { parseQboCompositeName } from "../../../shared/qboCompositeName";

export interface RefreshCustomerRow {
  id: number;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  quickbooksCustomerId: string | null;
}

/** The subset of a QBO Customer we consume. Shaped by fetchQboCustomer. */
export interface QboCustomerLite {
  Id: string;
  DisplayName?: string | null;
  GivenName?: string | null;
  FamilyName?: string | null;
  CompanyName?: string | null;
  PrimaryEmailAddr?: { Address?: string | null } | null;
  PrimaryPhone?: { FreeFormNumber?: string | null } | null;
}

export interface RefreshPort {
  getCustomer(id: number): Promise<RefreshCustomerRow | null>;
  updateCustomerFields(id: number, patch: Record<string, unknown>): Promise<void>;
  /** Concurrency guard. Return false if the lock is already held. */
  acquireLock(runId: string): Promise<boolean>;
  releaseLock(runId: string): Promise<void>;
  now(): Date;
}

export interface RefreshOptions {
  runId: string;
  dryRun: boolean;
  maxBatch: number;
  /** Reviewed-repair escape hatch; default false keeps composite names out. */
  allowComposite?: boolean;
}

export type RefreshRowResult = {
  customerId: number;
  quickbooksCustomerId: string | null;
  status: "changed" | "unchanged" | "skipped" | "conflict" | "failed";
  reason: string;
  changedFields: string[];
};

export interface RefreshSummary {
  runId: string;
  requested: number;
  fetched: number;
  unchanged: number;
  changed: number;
  skipped: number;
  conflicts: number;
  failures: number;
  results: RefreshRowResult[];
}

/** Fill only fields that are currently empty on the CRM row. */
function fillEmpty(cur: RefreshCustomerRow, qbo: QboCustomerLite, allowComposite: boolean): { patch: Record<string, unknown>; fields: string[] } {
  const patch: Record<string, unknown> = {};
  const fields: string[] = [];
  const isEmpty = (v: string | null | undefined) => v == null || v.trim() === "";
  const set = (field: keyof RefreshCustomerRow, cval: string | null, qval: string | null | undefined) => {
    if (isEmpty(cval) && qval != null && qval.trim() !== "") { patch[field] = qval.trim(); fields.push(field); }
  };
  // Guard: never copy a raw composite DisplayName onto the CRM record.
  const qDisplay = qbo.DisplayName ?? null;
  const composite = qDisplay ? parseQboCompositeName(qDisplay).isComposite : false;
  if (!composite || allowComposite) set("displayName", cur.displayName, qDisplay);
  set("firstName", cur.firstName, qbo.GivenName);
  set("lastName", cur.lastName, qbo.FamilyName);
  set("companyName", cur.companyName, qbo.CompanyName);
  set("email", cur.email, qbo.PrimaryEmailAddr?.Address);
  set("phone", cur.phone, qbo.PrimaryPhone?.FreeFormNumber);
  return { patch, fields };
}

export async function refreshCustomers(
  port: RefreshPort,
  fetchQboCustomer: (qboId: string) => Promise<QboCustomerLite | null>,
  customerIds: number[],
  opts: RefreshOptions,
): Promise<RefreshSummary> {
  const summary: RefreshSummary = { runId: opts.runId, requested: customerIds.length, fetched: 0, unchanged: 0, changed: 0, skipped: 0, conflicts: 0, failures: 0, results: [] };

  if (customerIds.length > opts.maxBatch) {
    throw new Error(`batch size ${customerIds.length} exceeds max ${opts.maxBatch}`);
  }
  const gotLock = await port.acquireLock(opts.runId);
  if (!gotLock) throw new Error("refresh lock held by another run");

  try {
    for (const id of customerIds) {
      const cur = await port.getCustomer(id);
      if (!cur) { summary.skipped++; summary.results.push({ customerId: id, quickbooksCustomerId: null, status: "skipped", reason: "CUSTOMER_NOT_FOUND", changedFields: [] }); continue; }
      if (!cur.quickbooksCustomerId) { summary.skipped++; summary.results.push({ customerId: id, quickbooksCustomerId: null, status: "skipped", reason: "NO_QBO_ID", changedFields: [] }); continue; }

      let qbo: QboCustomerLite | null;
      try { qbo = await fetchQboCustomer(cur.quickbooksCustomerId); }
      catch (e) { summary.failures++; summary.results.push({ customerId: id, quickbooksCustomerId: cur.quickbooksCustomerId, status: "failed", reason: `FETCH_ERROR:${(e as Error).message}`, changedFields: [] }); continue; }
      if (!qbo) { summary.failures++; summary.results.push({ customerId: id, quickbooksCustomerId: cur.quickbooksCustomerId, status: "failed", reason: "QBO_NOT_FOUND", changedFields: [] }); continue; }
      if (String(qbo.Id) !== cur.quickbooksCustomerId) { summary.conflicts++; summary.results.push({ customerId: id, quickbooksCustomerId: cur.quickbooksCustomerId, status: "conflict", reason: "QBO_ID_MISMATCH", changedFields: [] }); continue; }
      summary.fetched++;

      const { patch, fields } = fillEmpty(cur, qbo, opts.allowComposite ?? false);
      const checkedAt = port.now();

      if (!fields.length) {
        summary.unchanged++;
        if (!opts.dryRun) await port.updateCustomerFields(id, { quickbooksCustomerCheckedAt: checkedAt });
        summary.results.push({ customerId: id, quickbooksCustomerId: cur.quickbooksCustomerId, status: "unchanged", reason: "NO_EMPTY_FIELDS", changedFields: [] });
        continue;
      }

      summary.changed++;
      if (!opts.dryRun) {
        // checkedAt = we fetched; updatedAt = QBO version actually applied.
        await port.updateCustomerFields(id, { ...patch, quickbooksCustomerCheckedAt: checkedAt, quickbooksCustomerUpdatedAt: checkedAt });
      }
      summary.results.push({ customerId: id, quickbooksCustomerId: cur.quickbooksCustomerId, status: "changed", reason: "FILLED_EMPTY", changedFields: fields });
    }
  } finally {
    await port.releaseLock(opts.runId);
  }
  return summary;
}
