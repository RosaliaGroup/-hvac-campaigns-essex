/**
 * Regression tests for the seoSyncHistory finalization bug: the insert result id
 * was read off the wrong object (`inserted.insertId` instead of `inserted[0]`),
 * so `historyId` was always 0 and the success/error UPDATE was skipped — leaving
 * every history row stuck at status="running", pagesSynced=0, completedAt=null.
 *
 * These drive runSeoSync with an in-memory fake `db` (via getDb mock) and a lock
 * connection that acquires immediately, then assert the history row is finalized.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { seoSyncHistory } from "../../../drizzle/schema";
import type { LockConnection } from "../../integrations/accounting/dbSyncLock";

// ── Module seams ────────────────────────────────────────────────────────────
vi.mock("../../db", () => ({
  getDb: vi.fn(),
  createDedicatedConnection: vi.fn(),
}));

vi.mock("../../integrations/searchConsole", () => {
  class SearchConsoleUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SearchConsoleUnavailableError";
    }
  }
  const toPath = (k: string) =>
    k.startsWith("http") ? new URL(k).pathname || "/" : k.startsWith("/") ? k : `/${k}`;
  return {
    SearchConsoleUnavailableError,
    getSeoSiteUrl: vi.fn(() => "https://example.com/"),
    getSiteOrigin: vi.fn(() => "https://example.com"),
    toPath: vi.fn(toPath),
    getSearchConsoleAccessToken: vi.fn(),
    querySearchAnalytics: vi.fn(),
    inspectUrl: vi.fn(),
  };
});

import { runSeoSync, readSyncStatus } from "./sync";
import { getDb } from "../../db";
import {
  getSearchConsoleAccessToken,
  querySearchAnalytics,
  inspectUrl,
} from "../../integrations/searchConsole";

// A lock connection whose GET_LOCK / RELEASE_LOCK both return 1 (acquired), so
// runSeoSync proceeds into performSync (mirrors the existing sync.test.ts seam).
const okConn: LockConnection = {
  async query() {
    return [[{ v: 1 }], []];
  },
  async end() {},
  destroy() {},
};
const lockConnectionFactory = async () => okConn;

/**
 * In-memory fake of the drizzle `db` used by performSync. Records the single
 * seoSyncHistory row and mutates it exactly when the code issues an UPDATE — so
 * a row that stays "running" proves the finalize UPDATE never ran.
 */
function makeWriteDb() {
  const history: Array<Record<string, unknown>> = [];
  let hid = 0;
  const asResult = (id: number) => {
    const rows = [{ insertId: id }];
    return {
      // seoPages uses .onDuplicateKeyUpdate(); seoSyncHistory/seoQueries await directly.
      onDuplicateKeyUpdate: () => Promise.resolve(rows),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(res, rej),
    };
  };
  const db = {
    insert(table: unknown) {
      return {
        values(_vals: unknown) {
          if (table === seoSyncHistory) {
            const id = ++hid;
            history.push({
              id,
              status: "running",
              pagesSynced: 0,
              queriesSynced: 0,
              completedAt: null,
              error: null,
            });
            return asResult(id);
          }
          return asResult(0);
        },
      };
    },
    update(table: unknown) {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where(_cond: unknown) {
              if (table === seoSyncHistory) {
                const row = history.find((r) => r.status === "running");
                if (row) Object.assign(row, vals);
              }
              return Promise.resolve([{}]);
            },
          };
        },
      };
    },
    delete(_table: unknown) {
      return { where: () => Promise.resolve([{}]) };
    },
  };
  return { db, history };
}

const PAGE_ROWS = [
  { keys: ["/a"], clicks: 7, impressions: 50, ctr: 0.14, position: 4.0 },
  { keys: ["/b"], clicks: 3, impressions: 30, ctr: 0.1, position: 6.0 },
];
const QUERY_ROWS = [
  { keys: ["hvac newark"], clicks: 10, impressions: 100, ctr: 0.1, position: 3.2 },
  { keys: ["furnace repair"], clicks: 5, impressions: 80, ctr: 0.0625, position: 5.1 },
];

beforeEach(() => {
  vi.mocked(getSearchConsoleAccessToken).mockReset();
  vi.mocked(querySearchAnalytics).mockReset();
  vi.mocked(inspectUrl).mockReset();
  vi.mocked(getDb).mockReset();
});

describe("runSeoSync — seoSyncHistory finalization (insertId fix)", () => {
  function stubHappyGsc() {
    vi.mocked(getSearchConsoleAccessToken).mockResolvedValue("access-token");
    vi.mocked(querySearchAnalytics).mockImplementation(async (params: { dimensions: string[] }) =>
      params.dimensions[0] === "query" ? (QUERY_ROWS as never) : (PAGE_ROWS as never),
    );
    vi.mocked(inspectUrl).mockResolvedValue({
      indexStatus: "indexed",
      lastCrawlTime: null,
      coverageState: null,
    } as never);
  }

  it("finalizes the history row to status=success on a successful sync", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    stubHappyGsc();

    const res = await runSeoSync({ trigger: "test", lockConnectionFactory });

    expect(res.ok).toBe(true);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("success");
  });

  it("persists pagesSynced and queriesSynced on the history row", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    stubHappyGsc();

    const res = await runSeoSync({ trigger: "test", lockConnectionFactory });

    expect(res).toMatchObject({ ok: true, pagesSynced: 2, queriesSynced: 2 });
    expect(history[0].pagesSynced).toBe(2);
    expect(history[0].queriesSynced).toBe(2);
  });

  it("sets completedAt when the sync succeeds", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    stubHappyGsc();

    await runSeoSync({ trigger: "test", lockConnectionFactory });

    expect(history[0].completedAt).toBeInstanceOf(Date);
  });

  it("finalizes the history row to status=error with the error message on failure", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    // Fail after the history row is opened: token fetch throws.
    vi.mocked(getSearchConsoleAccessToken).mockRejectedValue(new Error("boom-token"));

    const res = await runSeoSync({ trigger: "test", lockConnectionFactory });

    expect(res.ok).toBe(false);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("error");
    expect(String(history[0].error)).toContain("boom-token");
    expect(history[0].completedAt).toBeInstanceOf(Date);
  });
});

describe("readSyncStatus", () => {
  it("returns the latest SUCCESSFUL sync even when a newer run is still running", async () => {
    const successRow = {
      id: 1,
      status: "success" as const,
      startedAt: new Date("2026-07-10T00:00:00Z"),
      completedAt: new Date("2026-07-10T00:05:00Z"),
      pagesSynced: 42,
      error: null,
    };
    const latestRow = {
      id: 2,
      status: "running" as const,
      startedAt: new Date("2026-07-11T00:00:00Z"),
      completedAt: null,
      pagesSynced: 0,
      error: null,
    };
    // readSyncStatus issues two selects in order: latest-overall, then last-success.
    const selectQueue: unknown[][] = [[latestRow], [successRow]];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(selectQueue.shift() ?? []),
            }),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);

    const status = await readSyncStatus();

    expect(status.connected).toBe(true);
    expect(status.lastRunStatus).toBe("running");
    expect(status.lastSuccessAt).toBe(successRow.completedAt.toISOString());
    expect(status.pagesSynced).toBe(42);
    expect(status.stale).toBe(false);
  });
});
