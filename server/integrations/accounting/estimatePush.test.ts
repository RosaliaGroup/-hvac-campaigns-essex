/**
 * Persistence-path tests for the estimate → QuickBooks push. Fake drizzle db +
 * mocked provider/writeSyncLog (same harness as salesDocSync.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { providerMock, getDbMock, writeSyncLogMock } = vi.hoisted(() => ({
  providerMock: { getConnection: vi.fn(), pushEstimate: vi.fn(), pushCustomer: vi.fn() },
  getDbMock: vi.fn(),
  writeSyncLogMock: vi.fn(async () => {}),
}));
vi.mock("./quickbooks", () => ({ quickbooksProvider: providerMock, writeSyncLog: writeSyncLogMock }));
vi.mock("../../db", () => ({ getDb: getDbMock }));

import { pushApprovedEstimate } from "./estimatePush";
import { estimates, opportunities, customers } from "../../../drizzle/schema";
import type { ApprovedSnapshot } from "./estimateMath";

const last = <T>(a: T[]): T => a[a.length - 1];

function createFakeDb() {
  const selectQueues: Record<string, unknown[][]> = {};
  const captured: Record<string, unknown[]> = {};
  const name = (t: unknown): string =>
    t === estimates ? "estimates" :
    t === opportunities ? "opportunities" :
    t === customers ? "customers" : "other";
  const nextSelect = (tbl: string) => {
    const qu = selectQueues[tbl];
    return Promise.resolve(qu && qu.length ? qu.shift()! : []);
  };
  const db = {
    _seed(tbl: string, rows: unknown[]) { (selectQueues[tbl] ??= []).push(rows); return db; },
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
    update(t: unknown) {
      const tbl = name(t);
      return { set(s: unknown) { return { where() { (captured[`${tbl}:update`] ??= []).push(s); return Promise.resolve([]); } }; } };
    },
  };
  return db;
}

const SNAPSHOT: ApprovedSnapshot = {
  optionId: 5, tier: "better", label: "Better", description: null,
  subtotal: 700, total: 700, rebateAmount: 50, warrantyTerms: null, maintenancePlan: null,
  approvedAt: "2026-07-27T00:00:00.000Z",
  lineItems: [
    { name: "Furnace", description: "High-eff", itemType: "equipment", quantity: 1, unitPrice: 600, amount: 600 },
    { name: "Labor", description: null, itemType: "labor", quantity: 2, unitPrice: 50, amount: 100 },
  ],
};

function seedApproved(db: ReturnType<typeof createFakeDb>, customerQbId: string | null = "QB-42") {
  db._seed("estimates", [{ id: 1, opportunityId: 7, estimateNumber: "ME-EST-2026-0001", status: "approved", approvedSnapshot: SNAPSHOT, quickbooksEstimateId: null }]);
  db._seed("opportunities", [{ id: 7, customerId: 42, title: "Furnace replacement" }]);
  db._seed("customers", [{ id: 42, quickbooksCustomerId: customerQbId, type: "residential", displayName: "Jane Doe", firstName: "Jane", lastName: "Doe", companyName: null, email: "jane@example.com", phone: "5551234567", notes: null }]);
}

beforeEach(() => {
  providerMock.getConnection.mockReset();
  providerMock.pushEstimate.mockReset();
  providerMock.pushCustomer.mockReset();
  getDbMock.mockReset();
  writeSyncLogMock.mockClear();
  providerMock.getConnection.mockResolvedValue({ realmId: "R1" });
});

describe("pushApprovedEstimate", () => {
  it("pushes ONLY the approved snapshot's lines and marks the estimate pushed on success", async () => {
    const db = createFakeDb();
    seedApproved(db);
    getDbMock.mockResolvedValue(db);
    providerMock.pushEstimate.mockResolvedValue({ qbId: "EST-99", docNumber: "1001", totalAmount: 700 });

    const out = await pushApprovedEstimate(1);
    expect(out.ok).toBe(true);
    expect(out.qbId).toBe("EST-99");

    const input = providerMock.pushEstimate.mock.calls[0][0];
    expect(input.customerRef).toBe("QB-42");
    expect(input.docNumber).toBe("ME-EST-2026-0001");
    expect(input.privateNote).toContain("Opportunity #7");
    expect(input.lines).toHaveLength(2);
    expect(input.lines[0]).toMatchObject({ name: "Furnace", quantity: 1, unitPrice: 600, amount: 600 });

    expect(last(db.upd("estimates"))).toMatchObject({ quickbooksEstimateId: "EST-99", qbSyncStatus: "pushed", qbSyncError: null });
    expect(writeSyncLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "estimate", direction: "push", success: true, qbId: "EST-99" }),
    );
  });

  it("records a failed sync (approval untouched) on push error, then a retry succeeds", async () => {
    const db = createFakeDb();
    seedApproved(db);
    getDbMock.mockResolvedValue(db);
    providerMock.pushEstimate.mockRejectedValueOnce(new Error("QuickBooks estimate push failed: HTTP 500"));

    const fail = await pushApprovedEstimate(1);
    expect(fail.ok).toBe(false);
    const failUpd = last(db.upd("estimates"));
    expect(failUpd).toMatchObject({ qbSyncStatus: "failed" });
    expect(failUpd.qbSyncError).toBeTruthy();
    // The push path never writes `status` — the local approval is left intact.
    expect(failUpd).not.toHaveProperty("status");
    expect(writeSyncLogMock).toHaveBeenLastCalledWith(expect.objectContaining({ success: false, entityType: "estimate" }));

    // Retry with the provider now succeeding.
    seedApproved(db);
    providerMock.pushEstimate.mockResolvedValueOnce({ qbId: "EST-77", docNumber: "1002", totalAmount: 700 });
    const ok = await pushApprovedEstimate(1);
    expect(ok.ok).toBe(true);
    expect(last(db.upd("estimates"))).toMatchObject({ qbSyncStatus: "pushed", quickbooksEstimateId: "EST-77" });
  });

  it("auto-syncs an unsynced customer via pushCustomer, persists the id, then pushes the estimate", async () => {
    const db = createFakeDb();
    seedApproved(db, null); // customer has no QBO id yet
    getDbMock.mockResolvedValue(db);
    providerMock.pushCustomer.mockResolvedValue({ outcome: "created", qbId: "QB-NEW" });
    providerMock.pushEstimate.mockResolvedValue({ qbId: "EST-1", docNumber: "1003", totalAmount: 700 });

    const out = await pushApprovedEstimate(1);
    expect(out.ok).toBe(true);

    // Customer pushed via Task 7 pushCustomer (no resolution arg → dedup protection active).
    expect(providerMock.pushCustomer).toHaveBeenCalledWith(expect.objectContaining({ localId: 42, displayName: "Jane Doe" }));
    expect(providerMock.pushCustomer.mock.calls[0]).toHaveLength(1);
    // New QBO id persisted back onto the customer.
    expect(last(db.upd("customers"))).toMatchObject({ quickbooksCustomerId: "QB-NEW", quickbooksSyncStatus: "synced" });
    // Estimate push used the freshly-synced ref.
    expect(providerMock.pushEstimate.mock.calls[0][0].customerRef).toBe("QB-NEW");
    expect(last(db.upd("estimates"))).toMatchObject({ qbSyncStatus: "pushed", quickbooksEstimateId: "EST-1" });
  });

  it("falls back to a failed sync (no estimate push) when auto-sync hits a duplicate conflict", async () => {
    const db = createFakeDb();
    seedApproved(db, null);
    getDbMock.mockResolvedValue(db);
    providerMock.pushCustomer.mockResolvedValue({ outcome: "conflict", matchedBy: "name", candidate: { qbId: "QB-DUP", displayName: "Jane Doe" } });

    const out = await pushApprovedEstimate(1);
    expect(out.ok).toBe(false);
    expect(out.error).toContain("possible duplicate");
    expect(providerMock.pushEstimate).not.toHaveBeenCalled();
    expect(last(db.upd("estimates"))).toMatchObject({ qbSyncStatus: "failed" });
  });

  it("falls back to a failed sync when the customer auto-push itself throws", async () => {
    const db = createFakeDb();
    seedApproved(db, null);
    getDbMock.mockResolvedValue(db);
    providerMock.pushCustomer.mockRejectedValueOnce(new Error("QuickBooks create failed: 503"));

    const out = await pushApprovedEstimate(1);
    expect(out.ok).toBe(false);
    expect(out.error).toContain("auto-sync failed");
    expect(providerMock.pushEstimate).not.toHaveBeenCalled();
    expect(last(db.upd("estimates"))).toMatchObject({ qbSyncStatus: "failed" });
  });
});
