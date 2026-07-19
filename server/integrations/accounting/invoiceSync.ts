/**
 * QuickBooks INVOICE sync orchestrator (read-only).
 *
 * Pulls QBO Invoices (bounded backfill, then incremental by an INDEPENDENT
 * update cursor `quickbooksConnections.invoiceCursor`), mirrors them into
 * quickbooksSalesDocuments (docType="invoice"), and reconciles each to a CRM
 * customer via the real QBO CustomerRef hierarchy (direct ref → parent ref when
 * the ref is a sub-customer/job). Idempotent by QBO invoice id — re-running
 * never duplicates a document. QuickBooks stays the source of truth; we ONLY
 * read (no invoice create/modify/void). The estimate cursor is never touched.
 *
 * Every run writes a quickbooksSyncLogs row (entityType "invoice"). Gated:
 * only runs when QBO_INVOICE_SYNC_ENABLED=true, so it never runs unapproved.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { quickbooksSalesDocuments, customers, quickbooksConnections } from "../../../drizzle/schema";
import { quickbooksProvider, writeSyncLog } from "./quickbooks";
import { shouldSkipExistingDoc } from "./estimates";
import { buildInvoiceQuery, mapInvoiceToSalesDoc, type QboInvoice } from "./invoices";
import { SyncLock } from "./syncLock";
import { withDbLock, type LockConnection } from "./dbSyncLock";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const PAGE_SIZE = 100;
const PAGE_THROTTLE_MS = 150;
const MAX_PAGES = 100; // ≤ 10k invoices/run safety bound
const INVOICE_LOCK_NAME = "qbo_invoice_sync";

/** Feature gate — invoice sync never runs (poller or admin) unless explicitly enabled. */
export function isInvoiceSyncEnabled(): boolean {
  return process.env.QBO_INVOICE_SYNC_ENABLED === "true";
}

export interface InvoiceSyncResult {
  ok: boolean;
  pulled: number;
  created: number;
  updated: number;
  skipped: number;
  matched: number;     // reconciled to a CRM customer (direct or via parent)
  unmatched: number;   // no CRM customer for the ref/parent (stays customerId=null)
  durationMs: number;
  cursorAdvancedTo: string | null;
  error?: string;
}

function emptyInvoiceResult(): InvoiceSyncResult {
  return { ok: false, pulled: 0, created: 0, updated: 0, skipped: 0, matched: 0, unmatched: 0, durationMs: 0, cursorAdvancedTo: null };
}

/**
 * Resolve a QBO invoice's CustomerRef to a CRM customer via the hierarchy —
 * WITHOUT creating a customer (invoices attach to customers created by the
 * estimate/customer sync; creating here would risk duplicating a sub-customer).
 *  1. Direct: a CRM customer whose quickbooksCustomerId == the ref.
 *  2. Else, read the QBO customer; if it's a sub-customer/job, use its ParentRef
 *     and match a CRM customer on the parent ref (store parent ref on the doc).
 *  3. Else unmatched (customerId=null) — the ref + parent are still stored so
 *     Customer 360 reconciliation can attach it once the customer is synced.
 * `qboCustomerCache` memoizes QBO customer reads within a run.
 */
export async function resolveInvoiceCustomer(
  db: Db,
  inv: QboInvoice,
  qboCustomerCache: Map<string, { parentRef: string | null }>,
): Promise<{ customerId: number | null; parentRef: string | null }> {
  const ref = inv.CustomerRef?.value ?? null;
  if (!ref) return { customerId: null, parentRef: null };

  // 1. Direct ref match.
  const direct = (await db.select({ id: customers.id }).from(customers).where(eq(customers.quickbooksCustomerId, ref)).limit(1))[0];
  if (direct) return { customerId: direct.id, parentRef: null };

  // 2. Resolve the QBO hierarchy (one parent level covers projects/sub-customers).
  let parentRef: string | null = null;
  const cached = qboCustomerCache.get(ref);
  if (cached) {
    parentRef = cached.parentRef;
  } else {
    const qc = await quickbooksProvider.fetchQboCustomer(ref).catch(() => null);
    parentRef = qc?.Job && qc.ParentRef?.value ? qc.ParentRef.value : null;
    qboCustomerCache.set(ref, { parentRef });
  }
  if (parentRef) {
    const parent = (await db.select({ id: customers.id }).from(customers).where(eq(customers.quickbooksCustomerId, parentRef)).limit(1))[0];
    if (parent) return { customerId: parent.id, parentRef };
    return { customerId: null, parentRef }; // parent known but not in CRM yet
  }
  return { customerId: null, parentRef: null };
}

/** Upsert one invoice (idempotent by QBO id) + reconcile its customer. */
async function processInvoice(
  db: Db,
  realmId: string,
  inv: QboInvoice,
  now: Date,
  cache: Map<string, { parentRef: string | null }>,
  result: InvoiceSyncResult,
): Promise<void> {
  result.pulled++;
  const row = mapInvoiceToSalesDoc(inv, realmId, now);
  const { customerId, parentRef } = await resolveInvoiceCustomer(db, inv, cache);
  row.customerId = customerId;
  row.quickbooksParentRef = parentRef;
  if (customerId != null) result.matched++;
  else result.unmatched++;

  // Identity is the composite (realmId, docType, quickbooksId). Scoping the
  // lookup to docType="invoice" means an estimate that happens to share this
  // QBO id is simply not seen here — the two coexist as distinct rows, enforced
  // by the qbSalesDocs_realm_docType_qboId_uq unique index.
  const existing = (await db
    .select({ id: quickbooksSalesDocuments.id, quickbooksUpdatedAt: quickbooksSalesDocuments.quickbooksUpdatedAt })
    .from(quickbooksSalesDocuments)
    .where(
      and(
        eq(quickbooksSalesDocuments.realmId, realmId),
        eq(quickbooksSalesDocuments.docType, "invoice"),
        eq(quickbooksSalesDocuments.quickbooksId, row.quickbooksId),
      ),
    )
    .limit(1))[0];

  if (!existing) {
    await db.insert(quickbooksSalesDocuments).values(row);
    result.created++;
    return;
  }
  if (shouldSkipExistingDoc(existing, row)) { result.skipped++; return; }
  // Preserve the row id; update the mirrored fields.
  const { quickbooksId: _qid, ...patch } = row;
  await db.update(quickbooksSalesDocuments).set(patch).where(eq(quickbooksSalesDocuments.id, existing.id));
  result.updated++;
}

async function runInvoiceSync(opts: { mode?: "incremental" | "backfill"; sinceDays?: number }, now: Date, assertLockHeld?: () => void): Promise<InvoiceSyncResult> {
  const result = emptyInvoiceResult();
  const started = Date.now();
  const sinceDays = opts.sinceDays ?? 60;

  const db = await getDb();
  if (!db) { result.error = "Database unavailable"; return result; }
  const conn = await quickbooksProvider.getConnection();
  if (!conn || conn.status !== "connected") { result.error = "QuickBooks is not connected"; return result; }

  const cursor = opts.mode === "backfill" ? null : conn.invoiceCursor ?? null;
  let maxSeen: Date | null = cursor;
  const cache = new Map<string, { parentRef: string | null }>();

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      assertLockHeld?.();
      const query = buildInvoiceQuery({ cursor, sinceDays, startPosition: page * PAGE_SIZE + 1, pageSize: PAGE_SIZE, now });
      const invoices = await quickbooksProvider.fetchInvoices(query);
      for (const inv of invoices) {
        assertLockHeld?.();
        await processInvoice(db, conn.realmId, inv, now, cache, result);
        const u = inv.MetaData?.LastUpdatedTime ? new Date(inv.MetaData.LastUpdatedTime) : null;
        if (u && !Number.isNaN(u.getTime()) && (!maxSeen || u.getTime() > maxSeen.getTime())) maxSeen = u;
      }
      if (invoices.length < PAGE_SIZE) break;
      await new Promise(r => setTimeout(r, PAGE_THROTTLE_MS));
    }
    // Advance ONLY the independent invoice cursor, on a clean run.
    await db
      .update(quickbooksConnections)
      .set({ invoiceCursor: maxSeen, invoiceLastSyncAt: now })
      .where(eq(quickbooksConnections.realmId, conn.realmId));
    result.ok = true;
    result.cursorAdvancedTo = maxSeen ? maxSeen.toISOString() : null;
  } catch (e) {
    result.error = (e as Error).message;
  }

  result.durationMs = Date.now() - started;
  await writeSyncLog({
    entityType: "invoice",
    direction: "pull",
    realmId: conn.realmId,
    success: result.ok,
    durationMs: result.durationMs,
    errorMessage: result.ok
      ? `pulled=${result.pulled} created=${result.created} updated=${result.updated} skipped=${result.skipped} matched=${result.matched} unmatched=${result.unmatched}`
      : (result.error ?? "unknown error").slice(0, 1000),
  });
  console.log(JSON.stringify({ tag: "[QboInvoiceSync]", ...result }));
  return result;
}

const invoiceSyncLock = new SyncLock();
const lockConnectionFactory = () =>
  import("../../db").then(m => m.createDedicatedConnection()) as Promise<LockConnection>;

/**
 * Locked, gated entrypoint. Singleton per-process + cross-instance advisory lock
 * (distinct from the estimate lock, so the two syncs don't block each other).
 * No QBO calls happen until the lock is held. Refuses when disabled.
 */
export async function syncInvoices(opts: { mode?: "incremental" | "backfill"; sinceDays?: number; now?: Date; force?: boolean; lockConnectionFactory?: () => Promise<LockConnection> } = {}): Promise<InvoiceSyncResult> {
  // `force` = an explicit, user-triggered per-customer reconciliation (e.g. the
  // "Sync from QuickBooks" button). It runs regardless of the QBO_INVOICE_SYNC_ENABLED
  // flag, which only gates the AUTOMATIC/scheduled poller to control background load.
  if (!opts.force && !isInvoiceSyncEnabled()) {
    return { ...emptyInvoiceResult(), error: "invoice sync disabled (set QBO_INVOICE_SYNC_ENABLED=true to enable)" };
  }
  const now = opts.now ?? new Date();
  const owner = `${opts.mode ?? "incremental"}-${now.getTime()}`;
  if (!invoiceSyncLock.tryAcquire(owner)) {
    return { ...emptyInvoiceResult(), error: "another invoice sync is already running in this process" };
  }
  try {
    const connect = opts.lockConnectionFactory ?? lockConnectionFactory;
    return await withDbLock(
      connect,
      INVOICE_LOCK_NAME,
      handle => runInvoiceSync(opts, now, () => handle.assertHeld()),
      (reason, error) => ({ ...emptyInvoiceResult(), error: reason === "busy" ? "another instance holds the invoice advisory lock" : `advisory lock unavailable: ${error?.message ?? "unknown"}` }),
      { requestId: owner },
    );
  } finally {
    invoiceSyncLock.release(owner);
  }
}
