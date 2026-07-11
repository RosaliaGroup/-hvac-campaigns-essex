/**
 * Direct persistence-path tests for the QBO sales-document sync.
 *
 * These assert the ACTUAL customer/property/conflict values handed to the DB
 * layer (not just parser output), using a fake Drizzle `db` that records every
 * insert/update and serves queued select results per table. They cover the exact
 * behaviours the deployment-readiness review required: company-vs-person creation,
 * the low-confidence-composite guard, manual-approval protection, dedup by
 * QBO-id / email / phone, idempotency, and the no-automatic-merge guarantee.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the QBO provider + writeSyncLog and getDb BEFORE importing the module.
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
import { customers, properties, customerSyncConflicts, opportunities, quickbooksSalesDocuments } from "../../../drizzle/schema";

const NOW = new Date("2026-07-01T00:00:00Z");

/** A fake Drizzle db: per-table FIFO select queues + captured writes. */
function createFakeDb() {
  const selectQueues: Record<string, unknown[][]> = {};
  const captured: Record<string, unknown[]> = {};
  const nextId: Record<string, number> = {};

  const name = (t: unknown): string =>
    t === customers ? "customers" :
    t === properties ? "properties" :
    t === customerSyncConflicts ? "customerSyncConflicts" :
    t === opportunities ? "opportunities" :
    t === quickbooksSalesDocuments ? "quickbooksSalesDocuments" :
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
          const id = (nextId[tbl] ?? ({ customers: 100, properties: 500, opportunities: 700, quickbooksSalesDocuments: 800, customerSyncConflicts: 900, other: 1 }[tbl] ?? 1));
          nextId[tbl] = id + 1;
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
    locationNotes: null,
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
    // Preset (non-null) so fill-empty never rewrites these audit fields.
    quickbooksRawDisplayName: "PRESET RAW",
    projectReference: "PRESET",
    displayNameManuallyApproved: false,
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
});

// ── Property helper ──────────────────────────────────────────────────────────
describe("ensureServiceProperty", () => {
  it("creates a new service property with locationNotes + projectReference", async () => {
    const db = createFakeDb();
    await ensureServiceProperty(
      db as never,
      5,
      { line1: "444 Madison Avenue", line2: null, city: "New York", state: "NY", zip: "10022" },
      "commercial",
      { locationNotes: "28th Floor", projectReference: "PN#172" },
    );
    expect(db.ins("properties")).toHaveLength(1);
    expect(db.ins("properties")[0]).toMatchObject({
      customerId: 5,
      addressLine1: "444 Madison Avenue",
      propertyType: "commercial",
      locationNotes: "28th Floor",
      projectReference: "PN#172",
      isPrimary: true,
    });
  });

  it("reuses an existing property (no duplicate) and fills only-empty detail", async () => {
    const db = createFakeDb();
    db._seed("properties", [{ id: 9, locationNotes: null, projectReference: null }]); // dup found
    await ensureServiceProperty(
      db as never,
      5,
      { line1: "444 Madison Avenue", line2: null, city: null, state: null, zip: null },
      "commercial",
      { locationNotes: "28th Floor", projectReference: "PN#172" },
    );
    expect(db._captured["properties:insert"]).toBeUndefined(); // never duplicated
    expect(db.upd("properties")[0]).toMatchObject({ locationNotes: "28th Floor", projectReference: "PN#172" });
  });

  it("does not overwrite curated property notes on reuse", async () => {
    const db = createFakeDb();
    db._seed("properties", [{ id: 9, locationNotes: "Suite 200 (human)", projectReference: "P-OLD" }]);
    await ensureServiceProperty(
      db as never,
      5,
      { line1: "1 Main St", line2: null, city: null, state: null, zip: null },
      "residential",
      { locationNotes: "Basement", projectReference: "PN#999" },
    );
    expect(db._captured["properties:insert"]).toBeUndefined();
    expect(db._captured["properties:update"]).toBeUndefined(); // both fields already set → no write
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
      quickbooksRawDisplayName: "PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022",
      projectReference: "PN#172",
      hasQboConflicts: false,
    });
    expect(db._captured["customerSyncConflicts:insert"]).toBeUndefined();
    expect(db.ins("properties")[0]).toMatchObject({
      propertyType: "commercial",
      addressLine1: "444 Madison Avenue",
      locationNotes: "28th Floor",
      projectReference: "PN#172",
    });
  });

  it("person: splits the CLEAN parsed name, never the composite", async () => {
    const db = createFakeDb();
    const estimate = {
      CustomerRef: { name: "PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666" },
      BillEmail: { Address: "cyn@example.test" },
    };
    await resolveOrCreateContact(db as never, estimate as never, NOW);
    const c = db.ins("customers")[0];
    expect(c).toMatchObject({
      type: "residential",
      firstName: "Cynthia",
      lastName: "Rodriguez",
      companyName: null,
      displayName: "Cynthia Rodriguez",
      projectReference: "PN#165",
    });
    expect(String(c.displayName)).not.toMatch(/ I |\|/);
  });

  it("low-confidence composite: withholds the name (never the composite) and flags for review", async () => {
    const db = createFakeDb();
    const estimate = { CustomerRef: { name: "PN-220-C" } }; // no email/phone, unsegmentable
    await resolveOrCreateContact(db as never, estimate as never, NOW);
    const c = db.ins("customers")[0];
    // Never the composite, never an invented name, never the project code as a name.
    expect(c.displayName).toBe("Unnamed Customer");
    expect(String(c.displayName)).not.toContain("PN-220-C");
    expect(c.firstName).toBeNull();
    expect(c.lastName).toBeNull();
    expect(c.companyName).toBeNull();
    // Raw + project preserved for audit; record flagged.
    expect(c.quickbooksRawDisplayName).toBe("PN-220-C");
    expect(c.projectReference).toBe("PN-220-C");
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
    expect(c.lastName).toBeNull();
    expect(c.hasQboConflicts).toBe(true);
  });
});

// ── Dedup + no-merge ─────────────────────────────────────────────────────────
describe("resolveOrCreateContact — dedup (never merges, never creates a duplicate)", () => {
  it("dedup by QuickBooks customer id — enriches the linked contact", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 5, displayName: "Cynthia Rodriguez" }]); // linked-by-qbId lookup
    db._seed("customers", [existingCustomer({ id: 5 })]); // enrich: existing row
    db._seed("properties", [{ id: 9, locationNotes: "x", projectReference: "y" }]); // property reuse (no insert)
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
    providerMock.fetchQboCustomer.mockResolvedValue({
      Id: "QB-9",
      GivenName: "Cynthia",
      FamilyName: "Rodriguez",
      PrimaryPhone: { FreeFormNumber: "(201) 555-0142" },
    });
    const db = createFakeDb();
    db._seed("customers", []); // linked-by-qbId → none
    db._seed("customers", [{ id: 8, email: null, phone: "201-555-0142", displayName: "Cynthia R", companyName: null, quickbooksCustomerId: null }]);
    db._seed("customers", [existingCustomer({ id: 8, phone: "201-555-0142" })]);
    db._seed("customers", [{ displayName: "Cynthia R" }]);
    const estimate = { CustomerRef: { value: "QB-9", name: "Cynthia Rodriguez" } };
    const r = await resolveOrCreateContact(db as never, estimate as never, NOW);
    expect(r).toMatchObject({ customerId: 8, created: false });
    expect(db._captured["customers:insert"]).toBeUndefined(); // matched → enriched, not merged
  });
});

// ── Enrichment protections ───────────────────────────────────────────────────
describe("enrichExistingCustomer", () => {
  it("never overwrites a manually-approved displayName", async () => {
    const db = createFakeDb();
    db._seed("customers", [existingCustomer({ id: 11, companyName: null, displayNameManuallyApproved: true })]);
    const contact = makeContact({
      companyName: "New Co Inc",
      isCompany: true,
      nameConfident: true,
      displayName: "New Co Inc",
      quickbooksUpdatedAt: new Date("2026-06-01T00:00:00Z"),
    });
    await enrichExistingCustomer(db as never, 11, contact, "QB-11", true, NOW);
    const upd = (db.upd("customers")[0] ?? {}) as Record<string, unknown>;
    expect(upd).not.toHaveProperty("displayName"); // approved name protected
    expect(upd.companyName).toBe("New Co Inc"); // empty data field still fillable
  });

  it("recomputes displayName from structured fields (never the raw composite) when not approved", async () => {
    const db = createFakeDb();
    db._seed("customers", [existingCustomer({ id: 13, firstName: null, lastName: null, displayNameManuallyApproved: false })]);
    const contact = makeContact({
      firstName: "Marco",
      lastName: "Weber",
      nameConfident: true,
      displayName: "Marco Weber",
      rawDisplayName: "PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I",
      quickbooksUpdatedAt: new Date("2026-06-01T00:00:00Z"),
    });
    await enrichExistingCustomer(db as never, 13, contact, "QB-13", true, NOW);
    const upd = (db.upd("customers")[0] ?? {}) as Record<string, unknown>;
    expect(upd.displayName).toBe("Marco Weber");
    expect(String(upd.displayName)).not.toMatch(/ I |\|/);
    // Raw preserved for audit (was empty preset? preset is non-null so not rewritten) — assert it is never the composite.
    expect(upd.displayName).not.toContain("PN-173-B");
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
    const res = await syncSalesDocuments({ mode: "backfill", sinceDays: 60, now: NOW });
    expect(res.ok).toBe(true);
    const c = db.ins("customers")[0];
    expect(c).toBeTruthy();
    expect(c.displayName).toBe("Cynthia Rodriguez");
    expect(String(c.displayName)).not.toMatch(/ I |\|/);
    expect(c.projectReference).toBe("PN#165");
  });

  it("incremental (the poller's path) persists via the same engine", async () => {
    const db = createFakeDb();
    getDbMock.mockResolvedValue(db);
    providerMock.getConnection.mockResolvedValue({ status: "connected", realmId: "R1", salesDocCursor: new Date("2026-06-01T00:00:00Z") });
    providerMock.fetchEstimates.mockResolvedValueOnce([cynthiaEstimate]).mockResolvedValue([]);
    const res = await syncSalesDocuments({ mode: "incremental", now: NOW });
    expect(res.ok).toBe(true);
    const c = db.ins("customers")[0];
    expect(c.displayName).toBe("Cynthia Rodriguez");
  });
});
