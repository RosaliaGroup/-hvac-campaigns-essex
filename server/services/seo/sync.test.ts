import { describe, it, expect } from "vitest";
import { computeSyncWindows, runSeoSync } from "./sync";
import type { LockConnection } from "../../integrations/accounting/dbSyncLock";

describe("computeSyncWindows", () => {
  const w = computeSyncWindows(new Date("2026-07-14T12:00:00Z"));

  it("ends the current window 3 days before now (Search Console lag)", () => {
    expect(w.current.end).toBe("2026-07-11");
  });

  it("spans 90 days for the current window", () => {
    expect(w.current.start).toBe("2026-04-13"); // 2026-07-11 minus 89 days
  });

  it("places the previous window immediately before the current one, non-overlapping", () => {
    expect(w.previous.end).toBe("2026-04-12"); // day before current.start
    expect(w.previous.start).toBe("2026-01-13"); // 90-day span
    expect(w.previous.end < w.current.start).toBe(true);
  });
});

describe("runSeoSync — cross-instance advisory lock", () => {
  it("skips the sync when another instance holds the lock (busy → already_running)", async () => {
    // Give getDb() a (never-connected) URL so runSeoSync reaches the lock stage;
    // GET_LOCK returning 0 simulates a second replica already syncing.
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "mysql://u:p@127.0.0.1:3306/none";
    let performReached = false;
    const busyConn: LockConnection = {
      async query(sql: string) {
        if (/GET_LOCK/i.test(sql)) return [[{ v: 0 }], []]; // 0 = busy
        performReached = true; // any other query means the body ran — it must not
        return [[], []];
      },
      async end() {},
      destroy() {},
    };

    const res = await runSeoSync({ trigger: "test", lockConnectionFactory: async () => busyConn });

    expect(res).toEqual({ ok: false, reason: "already_running" });
    expect(performReached).toBe(false);
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  });

  it("never throws even if the sync body hits a dead database (resolves ok:false)", async () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "mysql://u:p@127.0.0.1:3306/none";
    // Lock ACQUIRES (v=1) so performSync runs — then its first real query fails
    // against the unreachable DB. runSeoSync must resolve, not reject.
    const okConn: LockConnection = {
      async query(sql: string) {
        if (/GET_LOCK/i.test(sql)) return [[{ v: 1 }], []];
        return [[{ v: 1 }], []];
      },
      async end() {},
      destroy() {},
    };
    const res = await runSeoSync({ trigger: "test", lockConnectionFactory: async () => okConn });
    expect(res.ok).toBe(false);
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  });
});
