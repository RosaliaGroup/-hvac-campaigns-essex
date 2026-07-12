import { describe, it, expect, vi, afterEach } from "vitest";
import * as dbModule from "../../db";
import * as quickbooksModule from "./quickbooks";
import { quickbooksProvider } from "./quickbooks";
import { syncSalesDocuments } from "./salesDocSync";
import type { LockConnection } from "./dbSyncLock";

/**
 * Patch 2 hardening proof: once the advisory-lock connection dies, processing
 * stops at the next check (per page, per estimate, or immediately before a CRM
 * write), no further writes occur, a failed sync-log is written, and the cursor
 * does not advance. Previously committed work stays committed; reruns are safe.
 */

/** Fake dedicated lock connection: GET_LOCK/RELEASE_LOCK = 1; can be "killed". */
function makeLockConn() {
  const errListeners: Array<(...a: unknown[]) => void> = [];
  const conn = {
    query: async (sql: string) =>
      sql.includes("GET_LOCK") || sql.includes("RELEASE_LOCK") ? [[{ v: 1 }], []] : [[], []],
    end: async () => {},
    destroy: () => {},
    on: (ev: string, cb: (...a: unknown[]) => void) => { if (ev === "error") errListeners.push(cb); },
    kill: () => errListeners.forEach(l => l(new Error("lock connection lost"))),
  };
  return conn as LockConnection & { kill: () => void };
}

const connectedConn = { status: "connected", realmId: "realm-1", salesDocCursor: new Date("2020-01-01T00:00:00Z") };

function fakeDbWithSpies() {
  const insert = vi.fn(() => ({ values: vi.fn() }));
  const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
  const selectChain = { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) };
  return { db: { select: vi.fn(() => selectChain), insert, update } as never, insert, update };
}

afterEach(() => vi.restoreAllMocks());

describe("syncSalesDocuments stops on advisory-lock loss with no writes", () => {
  it("PER-ESTIMATE check: lock dies during the page fetch → nothing is processed", async () => {
    let lockConn!: ReturnType<typeof makeLockConn>;
    const factory = () => { lockConn = makeLockConn(); return Promise.resolve(lockConn as LockConnection); };
    const { db, insert, update } = fakeDbWithSpies();

    vi.spyOn(dbModule, "getDb").mockResolvedValue(db);
    vi.spyOn(quickbooksProvider, "getConnection").mockResolvedValue(connectedConn as never);
    const writeSyncLog = vi.spyOn(quickbooksModule, "writeSyncLog").mockResolvedValue(undefined as never);
    // Page fetch succeeds, but the lock connection dies as it returns.
    vi.spyOn(quickbooksProvider, "fetchEstimates").mockImplementation(async () => {
      lockConn.kill();
      return [{ Id: "1", CustomerRef: { value: "77" }, MetaData: { LastUpdatedTime: "2026-07-02T09:00:00Z" } }] as never;
    });

    const result = await syncSalesDocuments({ mode: "backfill", lockConnectionFactory: factory });

    expect(result.ok).toBe(false);
    expect(result.pulled).toBe(0);            // per-estimate check threw before processEstimate ran
    expect(db.select).not.toHaveBeenCalled(); // no reads/writes began
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();    // cursor NOT advanced
    expect(result.cursorAdvancedTo).toBeNull();
    expect(writeSyncLog).toHaveBeenCalledTimes(1);
    expect(writeSyncLog.mock.calls[0][0]).toMatchObject({ success: false });
  });

  it("PRE-WRITE check: lock dies mid-estimate (during the existing-doc read) → no CRM writes", async () => {
    let lockConn!: ReturnType<typeof makeLockConn>;
    const factory = () => { lockConn = makeLockConn(); return Promise.resolve(lockConn as LockConnection); };
    const insert = vi.fn(() => ({ values: vi.fn() }));
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
    // The first select (existing-doc lookup) kills the lock, then returns [].
    const db = {
      select: vi.fn(() => { lockConn.kill(); return { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }; }),
      insert, update,
    } as never;

    vi.spyOn(dbModule, "getDb").mockResolvedValue(db);
    vi.spyOn(quickbooksProvider, "getConnection").mockResolvedValue(connectedConn as never);
    const writeSyncLog = vi.spyOn(quickbooksModule, "writeSyncLog").mockResolvedValue(undefined as never);
    vi.spyOn(quickbooksProvider, "fetchEstimates").mockResolvedValue(
      [{ Id: "1", CustomerRef: { value: "77" }, MetaData: { LastUpdatedTime: "2026-07-02T09:00:00Z" } }] as never,
    );

    const result = await syncSalesDocuments({ mode: "backfill", lockConnectionFactory: factory });

    expect(result.ok).toBe(false);
    expect(result.pulled).toBe(1);          // processEstimate started (counter) ...
    expect(insert).not.toHaveBeenCalled();  // ... but the pre-write check aborted before any write
    expect(update).not.toHaveBeenCalled();  // cursor NOT advanced
    expect(result.cursorAdvancedTo).toBeNull();
    expect(result.created).toBe(0);
    expect(result.contactsCreated).toBe(0);
    expect(writeSyncLog).toHaveBeenCalledTimes(1);
    expect(writeSyncLog.mock.calls[0][0]).toMatchObject({ success: false });
  });
});
