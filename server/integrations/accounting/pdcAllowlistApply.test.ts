/**
 * PDC-only allowlisted apply tool — persistence + safety tests.
 * Asserts the ACTUAL writes captured (and, crucially, the writes NEVER made:
 * no customers, no jobs, no cursor), the hard allowlist gate, dry-run zero-write,
 * idempotency, and the gated opportunity-title update.
 */
import { describe, it, expect } from "vitest";
import {
  applyPdcAllowlist,
  ApplyRefusal,
  PDC_ALLOWLIST_IDS,
  PDC_APPROVED_RECORDS,
  type AllowlistRecord,
  type ApplyDeps,
} from "./pdcAllowlistApply";
import { customers, properties, opportunities, opportunityEvents, quickbooksSalesDocuments, quickbooksConnections, jobs } from "../../../drizzle/schema";
import type { QboEstimate } from "./estimates";

const NOW = new Date("2026-07-12T00:00:00Z");

function createFakeDb() {
  const selectQueues: Record<string, unknown[][]> = {};
  const captured: Record<string, unknown[]> = {};
  const seq: Record<string, number> = {};
  const base: Record<string, number> = { properties: 500, opportunities: 700, quickbooksSalesDocuments: 800, opportunityEvents: 900 };
  const name = (t: unknown): string =>
    t === customers ? "customers" : t === properties ? "properties" : t === opportunities ? "opportunities" :
    t === opportunityEvents ? "opportunityEvents" : t === quickbooksSalesDocuments ? "quickbooksSalesDocuments" :
    t === quickbooksConnections ? "quickbooksConnections" : t === jobs ? "jobs" : "other";
  const push = (b: string, v: unknown) => { (captured[b] ??= []).push(v); };
  const nextSelect = (tbl: string) => { const q = selectQueues[tbl]; return Promise.resolve(q && q.length ? q.shift()! : []); };
  const db: any = {
    _captured: captured,
    _seed(tbl: string, rows: unknown[]) { (selectQueues[tbl] ??= []).push(rows); return db; },
    ins(tbl: string) { return (captured[`${tbl}:insert`] ?? []) as Record<string, unknown>[]; },
    upd(tbl: string) { return (captured[`${tbl}:update`] ?? []) as Record<string, unknown>[]; },
    anyWrite() { return Object.keys(captured).some(k => k.endsWith(":insert") || k.endsWith(":update")); },
    select() {
      let tbl = "other";
      const b: any = {
        from(t: unknown) { tbl = name(t); return b; },
        where() { return b; },
        orderBy() { return b; },
        limit() { return nextSelect(tbl); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return nextSelect(tbl).then(res, rej); },
      };
      return b;
    },
    insert(t: unknown) { const tbl = name(t); return { values(v: unknown) { push(`${tbl}:insert`, v); const id = seq[tbl] ?? base[tbl] ?? 1; seq[tbl] = id + 1; return Promise.resolve([{ insertId: id }]); } }; },
    update(t: unknown) { const tbl = name(t); return { set(s: unknown) { return { where() { push(`${tbl}:update`, s); return Promise.resolve([]); } }; } }; },
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return db;
}

function est(id: string, docNumber: string, status: string, txn: string): QboEstimate {
  return { Id: id, DocNumber: docNumber, TxnStatus: status, TxnDate: txn, TotalAmt: 1000, CustomerRef: { value: "193", name: "PN#135 I PDC" }, MetaData: { LastUpdatedTime: `${txn}T12:00:00Z` } };
}
const ESTIMATES: Record<string, QboEstimate> = {
  "2545": est("2545", "2141", "Accepted", "2026-02-13"),
  "3314": est("3314", "2160", "Pending", "2026-07-07"),
};
function makeDeps(db: any): ApplyDeps {
  return { db, fetchEstimateById: async (id) => ESTIMATES[id] ?? null, realmId: "R1", now: NOW };
}
const ALLOW = [...PDC_ALLOWLIST_IDS]; // ["2545","3314"]

describe("applyPdcAllowlist — allowlist gate", () => {
  it("refuses unless the exact allowlist [2545,3314] is passed", async () => {
    const db = createFakeDb();
    await expect(applyPdcAllowlist({ allowlist: ["2545"], records: PDC_APPROVED_RECORDS }, makeDeps(db)))
      .rejects.toMatchObject({ code: "ALLOWLIST_MISMATCH" });
    await expect(applyPdcAllowlist({ allowlist: ["2545", "3314", "9999"], records: PDC_APPROVED_RECORDS }, makeDeps(db)))
      .rejects.toMatchObject({ code: "ALLOWLIST_MISMATCH" });
    expect(db.anyWrite()).toBe(false);
  });

  it("refuses any record outside the allowlist", async () => {
    const db = createFakeDb();
    const rogue: AllowlistRecord = { ...PDC_APPROVED_RECORDS[0], qboEstimateId: "5" };
    await expect(applyPdcAllowlist({ allowlist: ALLOW, records: [rogue] }, makeDeps(db)))
      .rejects.toBeInstanceOf(ApplyRefusal);
    expect(db.anyWrite()).toBe(false);
  });
});

describe("applyPdcAllowlist — dry run (zero writes)", () => {
  it("plans both records and writes nothing", async () => {
    const db = createFakeDb();
    // reads per record (FIFO per table): customers, salesDoc, property
    db._seed("customers", [{ id: 9 }]);        // 2545
    db._seed("customers", [{ id: 9 }]);        // 3314
    db._seed("quickbooksSalesDocuments", []);  // 2545 missing
    db._seed("quickbooksSalesDocuments", [{ id: 800, opportunityId: 20 }]); // 3314 linked
    db._seed("properties", []);                // 2545 no property
    db._seed("properties", []);                // 3314 no York Ave yet

    const res = await applyPdcAllowlist({ allowlist: ALLOW, records: PDC_APPROVED_RECORDS, execute: false }, makeDeps(db));
    expect(res.dryRun).toBe(true);
    expect(db.anyWrite()).toBe(false); // NOTHING written
    expect(res.records.map(r => r.qboEstimateId)).toEqual(["2545", "3314"]);
    expect(res.records[0]).toMatchObject({ salesDoc: "inserted", opportunity: "created", property: "created", executed: false, customerWrites: 0, jobWrites: 0, cursorWrites: 0 });
    expect(res.records[1]).toMatchObject({ salesDoc: "reused", opportunity: "reused", property: "created", executed: false });
    expect(res.records[0].plannedWrites.join(" ")).toMatch(/INSERT quickbooksSalesDocuments/);
  });
});

describe("applyPdcAllowlist — execute 2141 (import)", () => {
  it("inserts sales-doc + opportunity + property; NO customer/job/cursor writes", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 9 }]);
    db._seed("quickbooksSalesDocuments", []); // missing → insert
    db._seed("properties", []);               // no Washington St → insert

    const res = await applyPdcAllowlist({ allowlist: ALLOW, records: [PDC_APPROVED_RECORDS[0]], execute: true }, makeDeps(db));
    const r = res.records[0];
    expect(r).toMatchObject({ salesDoc: "inserted", opportunity: "created", property: "created", executed: true });

    expect(db.ins("quickbooksSalesDocuments")).toHaveLength(1);
    expect(db.ins("quickbooksSalesDocuments")[0]).toMatchObject({ quickbooksId: "2545", customerId: 9, status: "accepted" });
    expect(db.ins("opportunities")).toHaveLength(1);
    expect(db.ins("opportunities")[0]).toMatchObject({ customerId: 9, workCategory: "commercial", stage: "won" });
    expect(db.ins("properties")).toHaveLength(1);
    expect(db.ins("properties")[0]).toMatchObject({ customerId: 9, addressLine1: "457-461 Washington St", city: "Newark", state: "NJ", zip: null, propertyType: "commercial" });

    // Hard invariants:
    expect(db.ins("customers")).toHaveLength(0);
    expect(db.ins("jobs")).toHaveLength(0);
    expect(db.ins("quickbooksConnections")).toHaveLength(0);
    expect(db.upd("quickbooksConnections")).toHaveLength(0);
    expect(res.totals).toMatchObject({ salesDocsInserted: 1, opportunitiesCreated: 1, propertiesCreated: 1, customerWrites: 0, jobWrites: 0, cursorWrites: 0 });
  });
});

describe("applyPdcAllowlist — execute 2160 (reuse + property)", () => {
  it("reuses sales-doc + opportunity 20, inserts only the York Ave property", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 9 }]);
    db._seed("quickbooksSalesDocuments", [{ id: 800, opportunityId: 20 }]); // already linked
    db._seed("properties", []); // no York Ave yet → insert

    const res = await applyPdcAllowlist({ allowlist: ALLOW, records: [PDC_APPROVED_RECORDS[1]], execute: true }, makeDeps(db));
    const r = res.records[0];
    expect(r).toMatchObject({ salesDoc: "reused", opportunity: "reused", property: "created", executed: true });

    expect(db.ins("quickbooksSalesDocuments")).toHaveLength(0); // reused, not inserted
    expect(db.ins("opportunities")).toHaveLength(0);            // opp 20 reused
    expect(db.ins("properties")).toHaveLength(1);
    expect(db.ins("properties")[0]).toMatchObject({ customerId: 9, addressLine1: "10 York Ave", city: "West Caldwell", zip: "07006", propertyType: "commercial" });
    // link updates happen; no customer/job/cursor writes
    expect(db.ins("customers")).toHaveLength(0);
    expect(db.ins("jobs")).toHaveLength(0);
    expect(db.upd("quickbooksConnections")).toHaveLength(0);
  });
});

describe("applyPdcAllowlist — idempotency", () => {
  it("re-running when sales-doc + property already exist writes no new rows", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 9 }]);
    db._seed("quickbooksSalesDocuments", [{ id: 800, opportunityId: 700 }]); // already imported
    db._seed("properties", [{ id: 500 }]);                                    // Washington St already exists

    const res = await applyPdcAllowlist({ allowlist: ALLOW, records: [PDC_APPROVED_RECORDS[0]], execute: true }, makeDeps(db));
    expect(res.records[0]).toMatchObject({ salesDoc: "reused", opportunity: "reused", property: "reused" });
    expect(db.ins("quickbooksSalesDocuments")).toHaveLength(0);
    expect(db.ins("opportunities")).toHaveLength(0);
    expect(db.ins("properties")).toHaveLength(0); // no duplicate property
  });
});

describe("applyPdcAllowlist — refuses to create a customer", () => {
  it("aborts when the approved customer is missing (never inserts a customer)", async () => {
    const db = createFakeDb();
    db._seed("customers", []); // customer 9 missing
    await expect(applyPdcAllowlist({ allowlist: ALLOW, records: [PDC_APPROVED_RECORDS[0]], execute: true }, makeDeps(db)))
      .rejects.toMatchObject({ code: "NO_CUSTOMER" });
    expect(db.ins("customers")).toHaveLength(0);
    expect(db.anyWrite()).toBe(false);
  });
});

describe("applyPdcAllowlist — gated opportunity title update (2160)", () => {
  const withTitle = (t: { expectedCurrent: string; proposed: string }): AllowlistRecord => ({ ...PDC_APPROVED_RECORDS[1], opportunityTitle: t });

  it("applies the title change ONLY when the live title matches exactly", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 9 }]);
    db._seed("quickbooksSalesDocuments", [{ id: 800, opportunityId: 20 }]);
    db._seed("properties", [{ id: 500 }]);        // reuse
    db._seed("opportunities", [{ title: "PDC — Estimate 2160" }]); // live title (matches)

    const res = await applyPdcAllowlist(
      { allowlist: ALLOW, records: [withTitle({ expectedCurrent: "PDC — Estimate 2160", proposed: "PDC LLC — York Ave (10 York Ave)" })], execute: true },
      makeDeps(db),
    );
    expect(res.records[0].titleUpdate).toBe("applied");
    const titleUpd = db.upd("opportunities").find(u => (u as any).title === "PDC LLC — York Ave (10 York Ave)");
    expect(titleUpd).toBeTruthy();
  });

  it("REFUSES the title change when the live title differs (no update written)", async () => {
    const db = createFakeDb();
    db._seed("customers", [{ id: 9 }]);
    db._seed("quickbooksSalesDocuments", [{ id: 800, opportunityId: 20 }]);
    db._seed("properties", [{ id: 500 }]);
    db._seed("opportunities", [{ title: "SOMETHING ELSE" }]); // live title (mismatch)

    const res = await applyPdcAllowlist(
      { allowlist: ALLOW, records: [withTitle({ expectedCurrent: "PDC — Estimate 2160", proposed: "NEW" })], execute: true },
      makeDeps(db),
    );
    expect(res.records[0].titleUpdate).toBe("refused_mismatch");
    expect(db.upd("opportunities").some(u => (u as any).title === "NEW")).toBe(false);
  });
});
