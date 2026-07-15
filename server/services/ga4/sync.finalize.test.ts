/**
 * runGa4Sync lifecycle tests: ga4SyncHistory finalization (success/error),
 * missing-config guards, idempotent upsert, in-process duplicate prevention and
 * cross-instance advisory-lock contention.
 *
 * Drives runGa4Sync with an in-memory fake `db` (via a getDb mock) and a lock
 * connection that acquires immediately (mirrors server/services/seo/sync.finalize.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ga4DailyMetrics, ga4SyncHistory } from "../../../drizzle/schema";
import type { LockConnection } from "../../integrations/accounting/dbSyncLock";

// ── Module seams ────────────────────────────────────────────────────────────
vi.mock("../../db", () => ({
  getDb: vi.fn(),
  createDedicatedConnection: vi.fn(),
}));

vi.mock("../../integrations/ga4", () => {
  class Ga4UnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "Ga4UnavailableError";
    }
  }
  return {
    Ga4UnavailableError,
    getGa4PropertyId: vi.fn(() => "480827123"),
    getGa4AccessToken: vi.fn(),
    runReport: vi.fn(),
  };
});

import { runGa4Sync } from "./sync";
import { getDb } from "../../db";
import { getGa4PropertyId, getGa4AccessToken, runReport, Ga4UnavailableError } from "../../integrations/ga4";

// Lock connection whose GET_LOCK / RELEASE_LOCK both return 1 (acquired).
const okConn: LockConnection = {
  async query() {
    return [[{ v: 1 }], []];
  },
  async end() {},
  destroy() {},
};
const lockConnectionFactory = async () => okConn;

const REPORT_ROWS = [
  {
    date: "2026-07-10", source: "google", medium: "organic", campaign: "(organic)",
    landingPage: "/a", channelGroup: "Organic Search",
    pageViews: 10, sessions: 5, users: 4, conversions: 1, events: 20,
  },
  {
    date: "2026-07-10", source: "google", medium: "cpc", campaign: "promo",
    landingPage: "/b", channelGroup: "Paid Search",
    pageViews: 6, sessions: 3, users: 3, conversions: 2, events: 12,
  },
];

/**
 * In-memory fake `db`. History rows are mutated exactly when the code issues an
 * UPDATE (a row stuck at "running" proves finalize never ran). ga4DailyMetrics
 * upserts land in a Map keyed by rowHash, so repeated syncs prove idempotency.
 */
function makeWriteDb() {
  const history: Array<Record<string, unknown>> = [];
  const metrics = new Map<string, Record<string, unknown>>();
  let hid = 0;
  const asHistoryResult = (id: number) => {
    const rows = [{ insertId: id }];
    return { then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej) };
  };
  const db = {
    insert(table: unknown) {
      return {
        values(vals: Record<string, unknown>) {
          if (table === ga4SyncHistory) {
            const id = ++hid;
            history.push({ id, status: "running", rowsSynced: 0, completedAt: null, error: null });
            return asHistoryResult(id);
          }
          if (table === ga4DailyMetrics) {
            return {
              onDuplicateKeyUpdate: ({ set }: { set: Record<string, unknown> }) => {
                const key = String(vals.rowHash);
                metrics.set(key, { ...(metrics.get(key) ?? vals), ...set });
                return Promise.resolve([{}]);
              },
            };
          }
          return { onDuplicateKeyUpdate: () => Promise.resolve([{}]) };
        },
      };
    },
    update(table: unknown) {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where(_cond: unknown) {
              if (table === ga4SyncHistory) {
                const row = history.find((r) => r.status === "running");
                if (row) Object.assign(row, vals);
              }
              return Promise.resolve([{}]);
            },
          };
        },
      };
    },
  };
  return { db, history, metrics };
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(getGa4PropertyId).mockReset().mockReturnValue("480827123");
  vi.mocked(getGa4AccessToken).mockReset();
  vi.mocked(runReport).mockReset();
});

describe("runGa4Sync — missing config guards", () => {
  it("returns no_db when the database is not configured (no history written)", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const res = await runGa4Sync({ trigger: "test", lockConnectionFactory });
    expect(res).toEqual({ ok: false, reason: "no_db", error: "Database not configured" });
  });

  it("returns unconfigured when GA4_PROPERTY_ID is missing/invalid", async () => {
    const { db } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getGa4PropertyId).mockReturnValue(""); // invalid/unset → ""
    const res = await runGa4Sync({ trigger: "test", lockConnectionFactory });
    expect(res).toMatchObject({ ok: false, reason: "unconfigured" });
  });
});

describe("runGa4Sync — history finalization", () => {
  it("finalizes to success with rowsSynced + completedAt on a healthy sync", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getGa4AccessToken).mockResolvedValue("access-token");
    vi.mocked(runReport).mockResolvedValue(REPORT_ROWS as never);

    const res = await runGa4Sync({ trigger: "test", lockConnectionFactory });

    expect(res).toMatchObject({ ok: true, rowsSynced: 2 });
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("success");
    expect(history[0].rowsSynced).toBe(2);
    expect(history[0].completedAt).toBeInstanceOf(Date);
  });

  it("finalizes to error (reason=unavailable) when GA4 is unauthorized", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getGa4AccessToken).mockRejectedValue(new Ga4UnavailableError("no analytics scope"));

    const res = await runGa4Sync({ trigger: "test", lockConnectionFactory });

    expect(res).toMatchObject({ ok: false, reason: "unavailable" });
    expect(history[0].status).toBe("error");
    expect(String(history[0].error)).toContain("no analytics scope");
    expect(history[0].completedAt).toBeInstanceOf(Date);
  });

  it("finalizes to error (reason=error) on a generic failure mid-sync", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getGa4AccessToken).mockResolvedValue("access-token");
    vi.mocked(runReport).mockRejectedValue(new Error("boom-report"));

    const res = await runGa4Sync({ trigger: "test", lockConnectionFactory });

    expect(res).toMatchObject({ ok: false, reason: "error" });
    expect(history[0].status).toBe("error");
    expect(String(history[0].error)).toContain("boom-report");
  });
});

describe("runGa4Sync — idempotency", () => {
  it("upserts by rowHash so running twice never duplicates rows", async () => {
    const { db, metrics } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getGa4AccessToken).mockResolvedValue("access-token");
    vi.mocked(runReport).mockResolvedValue(REPORT_ROWS as never);

    await runGa4Sync({ trigger: "run1", lockConnectionFactory });
    await runGa4Sync({ trigger: "run2", lockConnectionFactory });

    // Two distinct dimension tuples → exactly two cache rows after two syncs.
    expect(metrics.size).toBe(2);
  });
});

describe("runGa4Sync — duplicate-run prevention", () => {
  it("skips a second concurrent run in the same process (already_running)", async () => {
    const { db } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.mocked(getGa4AccessToken).mockImplementation(async () => {
      await gate; // hold the first sync open
      return "access-token";
    });
    vi.mocked(runReport).mockResolvedValue([] as never);

    const p1 = runGa4Sync({ trigger: "a", lockConnectionFactory });
    await new Promise((r) => setTimeout(r, 0)); // let p1 set the in-process flag + park at the gate
    const r2 = await runGa4Sync({ trigger: "b", lockConnectionFactory });
    expect(r2).toEqual({ ok: false, reason: "already_running" });

    release();
    expect((await p1).ok).toBe(true);
  });

  it("skips when another INSTANCE holds the advisory lock (busy → already_running)", async () => {
    const { db } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    let bodyReached = false;
    const busyConn: LockConnection = {
      async query(sql: string) {
        if (/GET_LOCK/i.test(sql)) return [[{ v: 0 }], []]; // 0 = held by another instance
        bodyReached = true; // performSync must never run
        return [[], []];
      },
      async end() {},
      destroy() {},
    };

    const res = await runGa4Sync({ trigger: "test", lockConnectionFactory: async () => busyConn });

    expect(res).toEqual({ ok: false, reason: "already_running" });
    expect(bodyReached).toBe(false);
    // getGa4AccessToken is only called inside performSync — proves the body was skipped.
    expect(vi.mocked(getGa4AccessToken)).not.toHaveBeenCalled();
  });
});
