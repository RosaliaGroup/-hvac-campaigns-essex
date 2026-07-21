/**
 * Tests for the customer-scoped estimate resync (syncSalesDocumentsForCustomer).
 *
 * Covers the hardening guarantees:
 *   1. imports an estimate whose LastUpdatedTime predates the global cursor
 *   2. the global sales-doc cursor is never written
 *   3. re-running an unchanged estimate creates no duplicate doc/opportunity/contact
 *   4. only the requested QBO customer's estimates are processed
 *   7. the advisory lock (same name as the full sync) prevents concurrent runs
 *   8. per-estimate failures are isolated and reported; the run still completes
 *   9. a successful resync writes exactly the rows the customer-detail "Estimates"
 *      count and the Opportunity Center read (so those queries show it on refresh)
 *
 * Built on the same fake-db + injected-lock-connection seams as salesDocSync.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { providerMock, getDbMock, writeSyncLogMock } = vi.hoisted(() => ({
  providerMock: {
    getConnection: vi.fn(),
    fetchEstimates: vi.fn(),
    fetchQboCustomer: vi.fn(),
  },
  getDbMock: vi.fn(),
  writeSyncLogMock: vi.fn(async () => {}),
}));
vi.mock("./quickbooks", () => ({ quickbooksProvider: providerMock, writeSyncLog: writeSyncLogMock }));
vi.mock("../../db", () => ({ getDb: getDbMock }));

import { syncSalesDocumentsForCustomer } from "./salesDocSync";
import type { LockConnection } from "./dbSyncLock";
import { customers, properties, customerSyncConflicts, opportunities, quickbooksSalesDocuments, quickbooksConnections } from "../../../drizzle/schema";

const NOW = new Date("2026-07-20T00:00:00Z");
const CURSOR = new Date("2026-07-01T00:00:00Z"); // "current" global cursor

/** A fake Drizzle db: per-table FIFO select queues + captured writes. */
function createFakeDb() {
  const selectQueues: Record<string, unknown[][]> = {};
  const captured: Record<string, unknown[]> = {};
  const seq: Record<string, number> = {};
  const base: Record<string, number> = { customers: 100, properties: 500, opportunities: 700, quickbooksSalesDocuments: 800, customerSyncConflicts: 900 };
  const name = (t: unknown): string =>
    t === customers ? "customers" :
    t === properties ? "properties" :
    t === customerSyncConflicts ? "customerSyncConflicts" :
    t === opportunities ? "opportunities" :
    t === quickbooksSalesDocuments ? "quickbooksSalesDocuments" :
    t === quickbooksConnections ? "quickbooksConnections" : "other";
  const push = (bucket: string, v: unknown) => { (captured[bucket] ??= []).push(v); };
  const nextSelect = (tbl: string) => {
    const qu = selectQueues[tbl];
    return Promise.resolve(qu && qu.length ? qu.shift()! : []);
  };
  const db = {
    _captured: captured,
    _seed(tbl: string, rows: unknown[]) { (selectQueues[tbl] ??= []).push(rows); return db; },
    ins(tbl: string) { return (captured[`${tbl}:insert`] ?? []) as Record<string, unknown>[]; },
    upd(tbl: string) { return (captured[`${tbl}:update`] ?? []) as Record<string, unknown>[]; },
    select() {
      let tbl = "other";
      const b = {
        from(t: unknown) { tbl = name(t); return b; },
        where() { return b; },
        limit() { return nextSelect(tbl); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return nextSelect(tbl).then(res, rej); },
      };
      return b;
    },
    insert(t: unknown) {
      const tbl = name(t);
      return { values(v: unknown) { push(`${tbl}:insert`, v); const id = seq[tbl] ?? base[tbl] ?? 1; seq[tbl] = id + 1; return Promise.resolve([{ insertId: id }]); } };
    },
    update(t: unknown) {
      const tbl = name(t);
      return { set(s: unknown) { return { where() { push(`${tbl}:update`, s); return Promise.resolve([]); } }; } };
    },
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return db;
}

function existingCustomer(over: Record<string, unknown> = {}) {
  return {
    id: 1, type: "residential", firstName: null, lastName: null, companyName: null, email: null, phone: null,
    altPhone: null, notes: null, status: null, billingLine1: null, billingLine2: null, billingCity: null,
    billingState: null, billingZip: null, quickbooksCustomerId: null, quickbooksCustomerUpdatedAt: null, ...over,
  };
}

/**
 * Fake dedicated advisory-lock connection. GET_LOCK returns `getLockValue`
 * (1 = acquired, 0 = busy). Captures the lock name so tests can prove the
 * customer resync uses the SAME lock as the full sync.
 */
function makeLockConn(getLockValue = 1, capture?: (lockName: string) => void): LockConnection {
  const conn = {
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("GET_LOCK")) { if (capture && values) capture(String(values[0])); return [[{ v: getLockValue }], []]; }
      if (sql.includes("RELEASE_LOCK")) return [[{ v: 1 }], []];
      return [[], []];
    },
    end: async () => {},
    destroy: () => {},
    on: () => {},
  };
  return conn as unknown as LockConnection;
}
const healthyLock = () => Promise.resolve(makeLockConn(1));

function estimate(over: Record<string, unknown> = {}) {
  return {
    Id: "E1", DocNumber: "1001",
    CustomerRef: { value: "QB-1", name: "Acme Co" },
    TxnDate: "2026-05-01", TotalAmt: 500,
    MetaData: { LastUpdatedTime: "2026-05-01T00:00:00Z" }, // predates CURSOR (2026-07-01)
    ...over,
  };
}

beforeEach(() => {
  providerMock.getConnection.mockReset();
  providerMock.fetchEstimates.mockReset();
  providerMock.fetchQboCustomer.mockReset();
  providerMock.fetchQboCustomer.mockResolvedValue(null);
  getDbMock.mockReset();
  writeSyncLogMock.mockClear();
  providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: CURSOR });
});

describe("syncSalesDocumentsForCustomer", () => {
  it("(1) imports an estimate whose LastUpdatedTime predates the global cursor", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.fetchEstimates.mockResolvedValueOnce([estimate()]).mockResolvedValue([]);

    const res = await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: healthyLock });

    expect(res.ok).toBe(true);
    expect(res.created).toBe(1);
    // The estimate's LastUpdatedTime (2026-05-01) is BEFORE the cursor (2026-07-01),
    // yet it was imported — the query is customer-scoped, not cursor-filtered.
    const q = providerMock.fetchEstimates.mock.calls[0][0] as string;
    expect(q).toContain("CustomerRef = 'QB-1'");
    expect(q).not.toContain("LastUpdatedTime >");
    expect(db.ins("quickbooksSalesDocuments")).toHaveLength(1);
  });

  it("(2) never writes the global sales-doc cursor", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.fetchEstimates.mockResolvedValueOnce([estimate()]).mockResolvedValue([]);

    await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: healthyLock });

    // The full sync updates quickbooksConnections (salesDocCursor/lastSyncAt); the
    // customer resync must touch the connection row NOT AT ALL.
    expect(db._captured["quickbooksConnections:update"]).toBeUndefined();
    expect(db._captured["quickbooksConnections:insert"]).toBeUndefined();
  });

  it("(3) re-running an unchanged estimate creates no duplicate doc / opportunity / contact", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    // Existing mirrored doc, already linked to a customer + opportunity, as new as incoming.
    db._seed("quickbooksSalesDocuments", [
      { id: 800, customerId: 55, opportunityId: 700, quickbooksUpdatedAt: new Date("2026-05-01T00:00:00Z") },
    ]);
    db._seed("customers", [existingCustomer({ id: 55, quickbooksCustomerUpdatedAt: new Date("2026-06-01T00:00:00Z") })]);
    providerMock.fetchEstimates.mockResolvedValueOnce([estimate()]).mockResolvedValue([]);

    const res = await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: healthyLock });

    expect(res.skipped).toBe(1);
    expect(res.created).toBe(0);
    // No NEW rows of any kind — idempotent.
    expect(db.ins("quickbooksSalesDocuments")).toHaveLength(0);
    expect(db.ins("opportunities")).toHaveLength(0);
    expect(db.ins("customers")).toHaveLength(0);
  });

  it("(4) processes only the requested customer's estimates", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.fetchEstimates
      .mockResolvedValueOnce([
        estimate({ Id: "E1", CustomerRef: { value: "QB-1", name: "Acme Co" } }),
        estimate({ Id: "E2", CustomerRef: { value: "QB-OTHER", name: "Someone Else" } }),
      ])
      .mockResolvedValue([]);

    const res = await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: healthyLock });

    expect(res.created).toBe(1);
    expect(res.skipped).toBe(1); // the QB-OTHER estimate is defensively skipped
    const docs = db.ins("quickbooksSalesDocuments");
    expect(docs).toHaveLength(1);
    expect(docs[0].quickbooksCustomerId).toBe("QB-1");
  });

  it("(7) refuses to run when the advisory lock is held (same lock name as the full sync)", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    let lockName = "";
    const busyLock = () => Promise.resolve(makeLockConn(0, n => { lockName = n; }));

    const res = await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: busyLock });

    expect(res.ok).toBe(false);
    expect(res.error ?? "").toMatch(/advisory lock|another QuickBooks sync/i);
    expect(lockName).toBe("qbo_salesdoc_backfill"); // identical to syncSalesDocuments
    // No QBO work and no writes happened before the lock was denied.
    expect(providerMock.fetchEstimates).not.toHaveBeenCalled();
    expect(db._captured["quickbooksSalesDocuments:insert"]).toBeUndefined();
  });

  it("(8) isolates and reports a per-estimate failure while still importing the others", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.fetchEstimates
      .mockResolvedValueOnce([estimate({ Id: "E1" }), estimate({ Id: "E2" })])
      .mockResolvedValue([]);
    // Both estimates are new → each calls fetchQboCustomer once. Fail the 2nd.
    providerMock.fetchQboCustomer
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("QBO customer read failed"));

    const res = await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: healthyLock });

    expect(res.ok).toBe(false);
    expect(res.created).toBe(1); // E1 still imported
    expect(res.failed).toBe(1); // E2 failed but did not abort the run
    expect(res.errors).toEqual([{ quickbooksId: "E2", message: expect.stringContaining("QBO customer read failed") }]);
    // Audit log recorded the failed outcome.
    const logged = writeSyncLogMock.mock.calls.map(c => c[0] as { success?: boolean });
    expect(logged.some(l => l.success === false)).toBe(true);
  });

  it("(9) writes exactly the rows the customer page + Opportunity Center read", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.fetchEstimates.mockResolvedValueOnce([estimate()]).mockResolvedValue([]);

    await syncSalesDocumentsForCustomer("QB-1", { now: NOW, lockConnectionFactory: healthyLock });

    // Customer-detail "Estimates" count reads quickbooksSalesDocuments (docType estimate, linked customerId).
    const doc = db.ins("quickbooksSalesDocuments")[0];
    expect(doc).toMatchObject({ docType: "estimate", quickbooksCustomerId: "QB-1" });
    expect(doc.customerId).toBeTruthy();
    // Opportunity Center + "Open Opportunities" read opportunities (linked customerId, open stage).
    const opp = db.ins("opportunities")[0];
    expect(opp.customerId).toBe(doc.customerId);
    expect(["new", "proposal_sent", "pending"]).toContain(opp.stage);
  });

  it("rejects an empty QuickBooks customer id without touching QBO", async () => {
    const res = await syncSalesDocumentsForCustomer("   ", { now: NOW, lockConnectionFactory: healthyLock });
    expect(res.ok).toBe(false);
    expect(providerMock.fetchEstimates).not.toHaveBeenCalled();
  });
});
