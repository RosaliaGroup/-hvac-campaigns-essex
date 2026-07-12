/**
 * Direct persistence-path tests for the QBO sales-document sync, asserting the
 * ACTUAL customer / property / conflict values handed to the DB layer (not just
 * parser output). Built on main's canonical implementation (shared composite
 * parser, enrichment-gate, customerSyncConflicts review flagging) with our
 * additive create-path hardening ported on top.
 *
 * Covers: company create (person fields cleared), person create, low-confidence
 * composite withholding + review flag, manual-name protection (enrichment gate),
 * dedup by QBO-id / email / phone, idempotency, backfill + incremental (poller)
 * persistence, and the no-automatic-merge guarantee.
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

import {
  resolveOrCreateContact,
  enrichExistingCustomer,
  ensureServiceProperty,
  syncSalesDocuments,
} from "./salesDocSync";
import type { EstimateContactInput } from "./estimates";
import type { LockConnection } from "./dbSyncLock";
import { customers, properties, customerSyncConflicts, opportunities, quickbooksSalesDocuments, quickbooksConnections } from "../../../drizzle/schema";

const NOW = new Date("2026-07-01T00:00:00Z");

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
    t === quickbooksConnections ? "quickbooksConnections" :
    "other";

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
      return {
        values(v: unknown) {
          push(`${tbl}:insert`, v);
          const id = seq[tbl] ?? base[tbl] ?? 1;
          seq[tbl] = id + 1;
          return Promise.resolve([{ insertId: id }]);
        },
      };
    },
    update(t: unknown) {
      const tbl = name(t);
      return { set(s: unknown) { return { where() { push(`${tbl}:update`, s); return Promise.resolve([]); } }; } };
    },
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return db;
}

/** Full EstimateContactInput with safe defaults, for enrich tests. */
function makeContact(over: Partial<EstimateContactInput> = {}): EstimateContactInput {
  return {
    quickbooksCustomerId: null,
    displayName: "",
    rawDisplayName: null,
    projectReference: null,
    firstName: null,
    lastName: null,
    companyName: null,
    isCompany: false,
    nameConfident: false,
    email: null,
    phone: null,
    mobile: null,
    notes: null,
    active: null,
    quickbooksUpdatedAt: null,
    address: null,
    serviceAddress: null,
    ...over,
  };
}

/** A fully-shaped existing customer row (as selected in enrichExistingCustomer). */
function existingCustomer(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: "residential",
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    phone: null,
    altPhone: null,
    notes: null,
    status: null,
    billingLine1: null,
    billingLine2: null,
    billingCity: null,
    billingState: null,
    billingZip: null,
    quickbooksCustomerId: null,
    quickbooksCustomerUpdatedAt: null,
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
  delete process.env.QBO_CUSTOMER_NAME_ENRICH; // ensure the name-enrich gate is OFF (canonical default)
});

// ── Property helper (main: no locationNotes column; dup → no-op) ─────────────
describe("ensureServiceProperty", () => {
  it("creates a new service property (primary when the customer has none)", async () => {
    const db = createFakeDb();
    await ensureServiceProperty(db as never, 5, { line1: "444 Madison Avenue", line2: null, city: "New York", state: "NY", zip: "10022" }, "commercial");
    expect(db.ins("properties")).toHaveLength(1);
    expect(db.ins("properties")[0]).toMatchObject({
      customerId: 5,
      addressLine1: "444 Madison Avenue",
      propertyType: "commercial",
      isPrimary: true,
    });
  });

  it("reuses an existing property by street line — never duplicates", async () => {
    const db = createFakeDb();
    db._seed("properties", [{ id: 9 }]); // dup found
    await ensureServiceProperty(db as never, 5, { line1: "444 Madison Avenue", line2: null, city: null, state: null, zip: null }, "commercial");
    expect(db._captured["properties:insert"]).toBeUndefined();
    expect(db._captured["properties:update"]).toBeUndefined();
  });
});

// ── Auto-create: company / person / low-confidence ───────────────────────────
describe("resolveOrCreateContact — auto-create", () => {
  it("company: stores companyName + commercial and NULL first/last (no person splitter)", async () => {
    const db = createFakeDb();
    const estimate = {
      CustomerRef: { name: "PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022" },
      BillEmail: { Address: "info@cushwake.test" },
    };
    const r = await resolveOrCreateContact(db as never, estimate as never, NOW);
    expect(r.created).toBe(true);
    const c = db.ins("customers")[0];
    expect(c).toMatchObject({
      type: "commercial",
      companyName: "Cushman & Wakefield",
      displayName: "Cushman & Wakefield",
      firstName: null,
      lastName: null,
      hasQboConflicts: false,
    });
    expect(db._captured["customerSyncConflicts:insert"]).toBeUndefined();
    expect(db.ins("properties")[0]).toMatchObject({ propertyType: "commercial", addressLine1: "444 Madison Avenue" });
  });

  it("person: uses the clean parsed name, never the composite", async () => {
    const db = createFakeDb();
    const estimate = {
      CustomerRef: { name: "PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666" },
      BillEmail: { Address: "cyn@example.test" },
    };
    await resolveOrCreateContact(db as never, estimate as never, NOW);
    const c = db.ins("customers")[0];
    expect(c).toMatchObject({ type: "residential", firstName: "Cynthia", lastName: "Rodriguez", companyName: null, displayName: "Cynthia Rodriguez" });
    expect(String(c.displayName)).not.toMatch(/ I |\|/);
  });

  it("low-confidence composite / bare project code: withholds the name and flags for review", async () => {
    const db = createFakeDb();
    const estimate = { CustomerRef: { name: "PN-220-C" } }; // bare project code, no email/phone
    await resolveOrCreateContact(db as never, estimate as never, NOW);
    const c = db.ins("customers")[0];
    expect(c.displayName).toBe("Unnamed Customer");
    expect(String(c.displayName)).not.toContain("PN-220-C");
    expect(c.firstName).toBeNull();
    expect(c.lastName).toBeNull();
    expect(c.hasQboConflicts).toBe(true);
    const flag = db.ins("customerSyncConflicts")[0];
    expect(flag).toMatchObject({
      fieldName: "displayName",
      conflictType: "overwrite_prevented",
      crmValue: "Unnamed Customer",
      qboValue: "PN-220-C",
      status: "open",
    });
  });

  it("low-confidence composite with an email uses the email as identity, not the composite", async () => {
    const db = createFakeDb();
    const estimate = { CustomerRef: { name: "PN#500 I 12 I 34" }, BillEmail: { Address: "who@example.test" } };
    await resolveOrCreateContact(db as never, estimate as never, NOW);
    const c = db.ins("customers")[0];
    expect(c.displayName).toBe("who@example.test");
    expect(String(c.displayName)).not.toContain("PN#500");
    expect(c.firstName).toBeNull();
    expect(c.hasQboConflicts).toBe(true);
    expect((db.ins("customerSyncConflicts")[0] as Record<string, unknown>).qboValue).toBe("PN#500 I 12 I 34");
  });
});

// ── Dedup + no-merge ─────────────────────────────────────────────────────────
describe("resolveOrCreateContact — dedup (never merges, never creates a duplicate)", () => {
  it("dedup by QuickBooks customer id — enriches the linked contact", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 5, displayName: "Cynthia Rodriguez" }]); // linked-by-qbId lookup
    db._seed("customers", [existingCustomer({ id: 5 })]); // enrich existing row
    db._seed("properties", [{ id: 9 }]); // property reuse (no insert)
    db._seed("customers", [{ displayName: "Cynthia Rodriguez" }]); // post-enrich display re-read
    const estimate = { CustomerRef: { value: "QB-42", name: "PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666" } };
    const r = await resolveOrCreateContact(db as never, estimate as never, NOW);
    expect(r).toMatchObject({ customerId: 5, created: false });
    expect(db._captured["customers:insert"]).toBeUndefined(); // no duplicate, no merge
  });

  it("dedup by email — enriches the matched contact", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 7, email: "cyn@example.test", phone: null, displayName: "Cynthia R", companyName: null, quickbooksCustomerId: null }]);
    db._seed("customers", [existingCustomer({ id: 7, email: "cyn@example.test" })]);
    db._seed("customers", [{ displayName: "Cynthia R" }]);
    const estimate = { CustomerRef: { name: "Cynthia Rodriguez" }, BillEmail: { Address: "cyn@example.test" } };
    const r = await resolveOrCreateContact(db as never, estimate as never, NOW);
    expect(r).toMatchObject({ customerId: 7, created: false });
    expect(db._captured["customers:insert"]).toBeUndefined();
  });

  it("dedup by normalized phone — enriches the matched contact", async () => {
    providerMock.fetchQboCustomer.mockResolvedValue({ Id: "QB-9", GivenName: "Cynthia", FamilyName: "Rodriguez", PrimaryPhone: { FreeFormNumber: "(201) 555-0142" } });
    const db = createFakeDb();
    db._seed("customers", []); // linked-by-qbId → none
    db._seed("customers", [{ id: 8, email: null, phone: "201-555-0142", displayName: "Cynthia R", companyName: null, quickbooksCustomerId: null }]);
    db._seed("customers", [existingCustomer({ id: 8, phone: "201-555-0142" })]);
    db._seed("customers", [{ displayName: "Cynthia R" }]);
    const estimate = { CustomerRef: { value: "QB-9", name: "Cynthia Rodriguez" } };
    const r = await resolveOrCreateContact(db as never, estimate as never, NOW);
    expect(r).toMatchObject({ customerId: 8, created: false });
    expect(db._captured["customers:insert"]).toBeUndefined();
  });
});

// ── Enrichment protections (main's canonical enrichment gate) ────────────────
describe("enrichExistingCustomer", () => {
  it("manual-name protection: with the enrich gate OFF (default), never writes displayName/first/last/company", async () => {
    const db = createFakeDb();
    db._seed("customers", [existingCustomer({ id: 11, firstName: null, lastName: null, companyName: null })]);
    const contact = makeContact({
      firstName: "Ignore", lastName: "Me", companyName: "New Co Inc", isCompany: true, nameConfident: true, displayName: "New Co Inc",
      quickbooksUpdatedAt: new Date("2026-06-01T00:00:00Z"),
    });
    await enrichExistingCustomer(db as never, 11, contact, "QB-11", true, NOW);
    const upd = (db.upd("customers")[0] ?? {}) as Record<string, unknown>;
    expect(upd).not.toHaveProperty("displayName");
    expect(upd).not.toHaveProperty("firstName");
    expect(upd).not.toHaveProperty("lastName");
    expect(upd).not.toHaveProperty("companyName");
  });

  it("is idempotent — a fresh (unchanged) QBO record makes no writes", async () => {
    const db = createFakeDb();
    db._seed("customers", [existingCustomer({ id: 12, quickbooksCustomerUpdatedAt: new Date("2026-06-01T00:00:00Z") })]);
    const contact = makeContact({ quickbooksUpdatedAt: new Date("2026-05-01T00:00:00Z") }); // older → skip
    await enrichExistingCustomer(db as never, 12, contact, "QB-12", true, NOW);
    expect(db._captured["customers:update"]).toBeUndefined();
    expect(db._captured["properties:insert"]).toBeUndefined();
    expect(db._captured["customerSyncConflicts:insert"]).toBeUndefined();
  });
});

// ── Sync engine (backfill + poller/incremental persistence) ──────────────────
/**
 * Healthy fake dedicated lock connection (GET_LOCK/RELEASE_LOCK = 1, never
 * killed) — the same pattern as salesDocSyncLockLoss.test.ts. Injected via the
 * `lockConnectionFactory` seam so these end-to-end tests exercise the real
 * persistence path WITHOUT opening a real MySQL advisory-lock connection. The
 * advisory lock still runs and is genuinely acquired/asserted; only its
 * connection is faked.
 */
function makeLockConn(): LockConnection {
  const conn = {
    query: async (sql: string) =>
      sql.includes("GET_LOCK") || sql.includes("RELEASE_LOCK") ? [[{ v: 1 }], []] : [[], []],
    end: async () => {},
    destroy: () => {},
    on: () => {},
  };
  return conn as unknown as LockConnection;
}
const lockFactory = () => Promise.resolve(makeLockConn());

describe("syncSalesDocuments — persistence via the sync engine", () => {
  const cynthiaEstimate = {
    Id: "E1",
    DocNumber: "1001",
    CustomerRef: { value: "QB-1", name: "PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666" },
    TxnDate: "2026-06-01",
    TotalAmt: 100,
    MetaData: { LastUpdatedTime: "2026-06-10T00:00:00Z" },
  };

  it("backfill persists a clean, non-composite contact", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: null });
    providerMock.fetchEstimates.mockResolvedValueOnce([cynthiaEstimate]).mockResolvedValue([]);
    const res = await syncSalesDocuments({ mode: "backfill", sinceDays: 60, now: NOW, lockConnectionFactory: lockFactory });
    expect(res.ok).toBe(true);
    const c = db.ins("customers")[0];
    expect(c).toBeTruthy();
    expect(c.displayName).toBe("Cynthia Rodriguez");
    expect(String(c.displayName)).not.toMatch(/ I |\|/);
  });

  it("incremental (the poller's path) persists via the same engine", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: new Date("2026-06-01T00:00:00Z") });
    providerMock.fetchEstimates.mockResolvedValueOnce([cynthiaEstimate]).mockResolvedValue([]);
    const res = await syncSalesDocuments({ mode: "incremental", now: NOW, lockConnectionFactory: lockFactory });
    expect(res.ok).toBe(true);
    expect(db.ins("customers")[0].displayName).toBe("Cynthia Rodriguez");
  });
});
