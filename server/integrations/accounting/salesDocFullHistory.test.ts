/**
 * Orchestrator tests for full-history coverage: the write-mode cursor safety,
 * the WHERE-less query, advisory-lock enforcement, parent/sub-customer linkage,
 * and the read-only dry-run preview (zero database writes).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { providerMock, getDbMock, writeSyncLogMock } = vi.hoisted(() => ({
  providerMock: { getConnection: vi.fn(), fetchEstimates: vi.fn(), fetchQboCustomer: vi.fn() },
  getDbMock: vi.fn(),
  writeSyncLogMock: vi.fn(async () => {}),
}));
vi.mock("./quickbooks", () => ({ quickbooksProvider: providerMock, writeSyncLog: writeSyncLogMock }));
vi.mock("../../db", () => ({ getDb: getDbMock }));

import { syncSalesDocuments, resolveOrCreateContact, previewSalesDocuments } from "./salesDocSync";
import type { LockConnection } from "./dbSyncLock";
import { customers, properties, customerSyncConflicts, opportunities, quickbooksSalesDocuments, quickbooksConnections } from "../../../drizzle/schema";

const NOW = new Date("2026-07-12T00:00:00Z");

function createFakeDb() {
  const selectQueues: Record<string, unknown[][]> = {};
  const captured: Record<string, unknown[]> = {};
  const seq: Record<string, number> = {};
  const base: Record<string, number> = { customers: 100, properties: 500, opportunities: 700, quickbooksSalesDocuments: 800, customerSyncConflicts: 900 };
  const name = (t: unknown): string =>
    t === customers ? "customers" : t === properties ? "properties" : t === customerSyncConflicts ? "customerSyncConflicts" :
    t === opportunities ? "opportunities" : t === quickbooksSalesDocuments ? "quickbooksSalesDocuments" :
    t === quickbooksConnections ? "quickbooksConnections" : "other";
  const push = (bucket: string, v: unknown) => { (captured[bucket] ??= []).push(v); };
  const nextSelect = (tbl: string) => { const qu = selectQueues[tbl]; return Promise.resolve(qu && qu.length ? qu.shift()! : []); };
  const db = {
    _captured: captured,
    _seed(tbl: string, rows: unknown[]) { (selectQueues[tbl] ??= []).push(rows); return db; },
    ins(tbl: string) { return (captured[`${tbl}:insert`] ?? []) as Record<string, unknown>[]; },
    upd(tbl: string) { return (captured[`${tbl}:update`] ?? []) as Record<string, unknown>[]; },
    anyWrites() { return Object.keys(captured).some(k => k.endsWith(":insert") || k.endsWith(":update")); },
    select() {
      let tbl = "other";
      const b = {
        from(t: unknown) { tbl = name(t); return b; },
        where() { return b; },
        orderBy() { return b; },
        limit() { return nextSelect(tbl); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return nextSelect(tbl).then(res, rej); },
      };
      return b;
    },
    insert(t: unknown) {
      const tbl = name(t);
      return { values(v: unknown) { push(`${tbl}:insert`, v); const id = seq[tbl] ?? base[tbl] ?? 1; seq[tbl] = id + 1; return Promise.resolve([{ insertId: id }]); } };
    },
    update(t: unknown) { const tbl = name(t); return { set(s: unknown) { return { where() { push(`${tbl}:update`, s); return Promise.resolve([]); } }; } }; },
  };
  return db;
}

/** Healthy fake advisory-lock connection (GET_LOCK/RELEASE_LOCK = 1). */
function makeLockConn(getLockValue = 1): LockConnection {
  const conn = {
    query: async (sql: string) => (sql.includes("GET_LOCK") ? [[{ v: getLockValue }], []] : sql.includes("RELEASE_LOCK") ? [[{ v: 1 }], []] : [[], []]),
    end: async () => {}, destroy: () => {}, on: () => {},
  };
  return conn as unknown as LockConnection;
}
const lockFactory = () => Promise.resolve(makeLockConn());

beforeEach(() => {
  providerMock.getConnection.mockReset();
  providerMock.fetchEstimates.mockReset();
  providerMock.fetchQboCustomer.mockReset();
  providerMock.fetchQboCustomer.mockResolvedValue(null);
  getDbMock.mockReset();
  writeSyncLogMock.mockClear();
});

describe("full_history — cursor safety", () => {
  it("does NOT advance/regress the incremental cursor", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: new Date("2026-07-10T17:53:00Z") });
    providerMock.fetchEstimates.mockResolvedValue([]); // empty → just the connection update runs
    const res = await syncSalesDocuments({ mode: "full_history", now: NOW, lockConnectionFactory: lockFactory });
    expect(res.ok).toBe(true);
    expect(res.cursorAdvancedTo).toBeNull();
    const connUpdate = db.upd("quickbooksConnections")[0] as Record<string, unknown>;
    expect(connUpdate).toBeTruthy();
    expect(connUpdate).not.toHaveProperty("salesDocCursor"); // cursor untouched
    expect(connUpdate).toHaveProperty("salesDocLastSyncAt");
  });

  it("incremental/backfill DO write salesDocCursor (contrast — normal mode not weakened)", async () => {
    for (const mode of ["incremental", "backfill"] as const) {
      const db = createFakeDb();
      getDbMock.mockResolvedValue(db);
      providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: new Date("2026-06-01T00:00:00Z") });
      providerMock.fetchEstimates.mockResolvedValue([]);
      await syncSalesDocuments({ mode, now: NOW, lockConnectionFactory: lockFactory });
      expect(db.upd("quickbooksConnections")[0]).toHaveProperty("salesDocCursor");
    }
  });
});

describe("full_history — query + advisory lock", () => {
  it("issues a WHERE-less query (no TxnDate bound, no cursor predicate)", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: new Date("2026-07-10T17:53:00Z") });
    providerMock.fetchEstimates.mockResolvedValue([]);
    await syncSalesDocuments({ mode: "full_history", now: NOW, lockConnectionFactory: lockFactory });
    const query = providerMock.fetchEstimates.mock.calls[0][0] as string;
    expect(query).not.toContain("WHERE");
    expect(query).not.toContain("TxnDate");
    expect(query).not.toContain("2026-07-10");
    expect(query).toContain("SELECT * FROM Estimate");
  });

  it("refuses to run (no QBO calls) when the advisory lock is busy", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: null });
    providerMock.fetchEstimates.mockResolvedValue([]);
    const busyFactory = () => Promise.resolve(makeLockConn(0)); // GET_LOCK = 0 → busy
    const res = await syncSalesDocuments({ mode: "full_history", now: NOW, lockConnectionFactory: busyFactory });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/advisory lock/i);
    expect(providerMock.fetchEstimates).not.toHaveBeenCalled(); // never queried QBO
    expect(db.anyWrites()).toBe(false);
  });
});

describe("parent/sub-customer linkage (write path)", () => {
  it("links a sub-customer estimate to the PARENT's CRM customer and creates NO new customer", async () => {
    const db = createFakeDb();
    // resolveOrCreateContact reads: linked-customer-by-qboId, then (enrich) customer-by-id, then displayName-by-id.
    db._seed("customers", [{ id: 9, displayName: "PDC LLC" }]); // linked by parent QBO id "9000"
    db._seed("customers", [{ id: 9, type: "commercial", companyName: "PDC LLC", quickbooksCustomerId: "9000", quickbooksCustomerUpdatedAt: new Date("2026-01-01T00:00:00Z") }]); // enrich freshness guard skips
    db._seed("customers", [{ displayName: "PDC LLC" }]); // final displayName read

    providerMock.fetchQboCustomer.mockImplementation(async (id: string) =>
      id === "S132"
        ? { Id: "S132", DisplayName: "PN#132 I PDC LLC", Job: true, ParentRef: { value: "9000", name: "PDC LLC" } }
        : id === "9000"
          ? { Id: "9000", DisplayName: "PDC LLC", CompanyName: "PDC LLC", MetaData: { LastUpdatedTime: "2025-01-01T00:00:00Z" } }
          : null,
    );
    const estimate = { Id: "2140", DocNumber: "2140", TxnStatus: "Rejected", CustomerRef: { value: "S132", name: "PN#132 I PDC LLC" }, TxnDate: "2025-03-01", TotalAmt: 1000, MetaData: { LastUpdatedTime: "2025-03-01T12:00:00Z" } };

    const r = await resolveOrCreateContact(db as never, estimate as never, NOW);
    expect(r.customerId).toBe(9); // parent's CRM customer
    expect(r.created).toBe(false);
    expect(db.ins("customers")).toHaveLength(0); // NO new customer from the sub composite
    // Parent was resolved via a second fetch keyed on ParentRef.value.
    expect(providerMock.fetchQboCustomer).toHaveBeenCalledWith("9000");
  });
});

describe("full-history DRY RUN (previewSalesDocuments) — zero writes", () => {
  const sub = (id: string, name: string, ship?: unknown) => ({ Id: id, DisplayName: name, Job: true, ParentRef: { value: "9000", name: "PDC LLC" }, ShipAddr: ship });
  const est = (id: string, subId: string, subName: string, status: string, lut: string) => ({
    Id: id, DocNumber: id, TxnStatus: status, TxnDate: lut.slice(0, 10), TotalAmt: 1000,
    CustomerRef: { value: subId, name: subName }, MetaData: { LastUpdatedTime: lut },
  });

  it("proposes PDC estimates under customer 9, writes NOTHING, leaves the cursor untouched", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: new Date("2026-07-10T17:53:00Z") });
    providerMock.fetchEstimates.mockResolvedValueOnce([
      est("2140", "S132", "PN#132 I PDC LLC", "Rejected", "2025-03-01T12:00:00Z"),
      est("2141", "S135", "PN#135 I PDC LLC", "Closed", "2025-04-01T12:00:00Z"),
      est("2160", "S160", "York Ave I PDC LLC", "Accepted", "2025-05-01T12:00:00Z"),
    ]).mockResolvedValue([]);
    providerMock.fetchQboCustomer.mockImplementation(async (id: string) =>
      id === "9000" ? { Id: "9000", DisplayName: "PDC LLC", CompanyName: "PDC LLC" }
      : id === "S160" ? sub("S160", "York Ave I PDC LLC", { Line1: "123 York Ave", City: "Newark", CountrySubDivisionCode: "NJ" })
      : id.startsWith("S") ? sub(id, `PN I PDC LLC`) : null,
    );
    // existing-doc lookups (per estimate) then linked-customer lookups (2140, 2141).
    db._seed("quickbooksSalesDocuments", []); // 2140 missing
    db._seed("quickbooksSalesDocuments", []); // 2141 missing
    db._seed("quickbooksSalesDocuments", [{ id: 1, customerId: 9, quickbooksUpdatedAt: new Date("2025-05-01T12:00:00Z") }]); // 2160 present, unchanged
    db._seed("customers", [{ id: 9 }]); // 2140 linked by parent qbo id
    db._seed("customers", [{ id: 9 }]); // 2141 linked by parent qbo id

    const res = await previewSalesDocuments({ now: NOW });

    expect(res.ok).toBe(true);
    expect(res.databaseWrites).toBe(0);
    expect(res.cursorUnchanged).toBe(true);
    expect(db.anyWrites()).toBe(false); // absolutely no inserts/updates
    expect(res.rows).toHaveLength(3);

    const byId = Object.fromEntries(res.rows.map(r => [r.qboEstimateId, r]));
    expect(byId["2140"].resolvedCrmCustomerId).toBe(9);
    expect(byId["2140"].customerCreationProposed).toBe(false);
    expect(byId["2140"].salesDocAction).toBe("create");
    expect(byId["2140"].status).toBe("rejected");
    expect(byId["2141"].resolvedCrmCustomerId).toBe(9);
    expect(byId["2141"].status).toBe("closed");
    expect(byId["2160"].coverageCategory).toBe("already_linked");

    // All three under one PDC customer, no customer creations, no jobs, zero writes.
    expect(new Set(res.rows.map(r => r.resolvedCrmCustomerId))).toEqual(new Set([9]));
    expect(res.totals.customerCreationsProposed).toBe(0);
    expect(res.totals.jobCreationsProposed).toBe(0);
    expect(res.totals.databaseWrites).toBe(0);
    expect(res.totals.alreadyLinked).toBe(1);
    expect(res.totals.missingSafeImport).toBe(2);
  });
});
