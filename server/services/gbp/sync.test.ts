/**
 * Google Business Profile sync — safety tests.
 *
 * Drives runGbpSync with an in-memory fake `db` (via a getDb mock) and a lock
 * connection factory, mirroring the SEO sync test seams. Covers:
 *   - advisory-lock contention (a second instance no-ops)
 *   - never-throws on a dead DB
 *   - history finalization to success / error
 *   - idempotent cache upserts (re-running does not duplicate rows)
 *   - missing configuration + no DB
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  gbpLocations,
  gbpDailyMetrics,
  gbpReviews,
  gbpPhotos,
  gbpPosts,
  gbpSyncHistory,
} from "../../../drizzle/schema";
import type { LockConnection } from "../../integrations/accounting/dbSyncLock";

// ── Module seams ────────────────────────────────────────────────────────────
vi.mock("../../db", () => ({
  getDb: vi.fn(),
  createDedicatedConnection: vi.fn(),
}));

vi.mock("../../integrations/gbp", () => {
  class GbpUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GbpUnavailableError";
    }
  }
  return {
    GbpUnavailableError,
    getGbpTarget: vi.fn(() => ({
      accountId: "111",
      locationId: "222",
      locationName: "accounts/111/locations/222",
      locationResource: "locations/222",
    })),
    getGbpAccessToken: vi.fn(),
    fetchLocation: vi.fn(),
    fetchReviews: vi.fn(),
    fetchDailyMetrics: vi.fn(),
    fetchMedia: vi.fn(),
    fetchPosts: vi.fn(),
  };
});

import { runGbpSync, readGbpSyncStatus } from "./sync";
import { getDb } from "../../db";
import {
  getGbpTarget,
  getGbpAccessToken,
  fetchLocation,
  fetchReviews,
  fetchDailyMetrics,
  fetchMedia,
  fetchPosts,
} from "../../integrations/gbp";

const okConn: LockConnection = {
  async query() {
    return [[{ v: 1 }], []];
  },
  async end() {},
  destroy() {},
};
const lockConnectionFactory = async () => okConn;

/**
 * In-memory fake of the drizzle `db`. Records the gbpSyncHistory rows and, for
 * each upsert table, keys the written rows by their unique hash so a second
 * identical sync collapses onto the same rows (idempotency).
 */
function makeWriteDb() {
  const history: Array<Record<string, unknown>> = [];
  const stores = new Map<unknown, Map<string, Record<string, unknown>>>([
    [gbpLocations, new Map()],
    [gbpDailyMetrics, new Map()],
    [gbpReviews, new Map()],
    [gbpPhotos, new Map()],
    [gbpPosts, new Map()],
  ]);
  let hid = 0;

  const keyFor = (table: unknown, vals: Record<string, unknown>): string => {
    if (table === gbpLocations) return String(vals.locationName);
    if (table === gbpDailyMetrics) return String(vals.metricHash);
    if (table === gbpReviews) return String(vals.reviewHash);
    if (table === gbpPhotos) return String(vals.mediaHash);
    if (table === gbpPosts) return String(vals.postHash);
    return String(Math.random());
  };

  const asResult = (id: number, table: unknown, vals: Record<string, unknown>) => {
    const rows = [{ insertId: id }];
    const commit = () => {
      const store = stores.get(table);
      if (store) store.set(keyFor(table, vals), vals);
    };
    return {
      onDuplicateKeyUpdate: () => {
        commit();
        return Promise.resolve(rows);
      },
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej),
    };
  };

  const db = {
    insert(table: unknown) {
      return {
        values(vals: Record<string, unknown>) {
          if (table === gbpSyncHistory) {
            const id = ++hid;
            history.push({ id, status: "running", completedAt: null, error: null });
            return asResult(id, table, vals);
          }
          return asResult(0, table, vals);
        },
      };
    },
    update(table: unknown) {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              if (table === gbpSyncHistory) {
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
  return { db, history, stores };
}

function stubHappy() {
  vi.mocked(getGbpAccessToken).mockResolvedValue("access-token");
  vi.mocked(fetchLocation).mockResolvedValue({
    title: "Mechanical Enterprise",
    storefrontAddress: "1 Main St, Newark, NJ",
    primaryPhone: "555-1234",
    websiteUrl: "https://example.com",
  } as never);
  vi.mocked(fetchReviews).mockResolvedValue({
    averageRating: 4.7,
    totalReviewCount: 3,
    reviews: [
      { reviewName: "accounts/111/locations/222/reviews/a", reviewerName: "Jane", starRating: 5, comment: "Great", createTime: "2026-01-01T00:00:00Z", updateTime: null, replyComment: null, replyTime: null },
      { reviewName: "accounts/111/locations/222/reviews/b", reviewerName: "Bob", starRating: 4, comment: "Good", createTime: "2026-01-02T00:00:00Z", updateTime: null, replyComment: null, replyTime: null },
    ],
  } as never);
  vi.mocked(fetchDailyMetrics).mockResolvedValue([
    { date: "2026-01-01", callClicks: 3, directionRequests: 1, websiteClicks: 2, searchViews: 50, mapsViews: 10 },
    { date: "2026-01-02", callClicks: 4, directionRequests: 0, websiteClicks: 1, searchViews: 40, mapsViews: 12 },
  ] as never);
  vi.mocked(fetchMedia).mockResolvedValue([
    { mediaName: "accounts/111/locations/222/media/x", category: "COVER", googleUrl: "https://g/x", viewCount: 42, createTime: null },
  ] as never);
  vi.mocked(fetchPosts).mockResolvedValue([
    { postName: "accounts/111/locations/222/localPosts/p", summary: "Sale", topicType: "OFFER", state: "LIVE", searchUrl: null, createTime: null, updateTime: null },
  ] as never);
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(getGbpTarget).mockReset();
  vi.mocked(getGbpTarget).mockReturnValue({
    accountId: "111",
    locationId: "222",
    locationName: "accounts/111/locations/222",
    locationResource: "locations/222",
  } as never);
  vi.mocked(getGbpAccessToken).mockReset();
  vi.mocked(fetchLocation).mockReset();
  vi.mocked(fetchReviews).mockReset();
  vi.mocked(fetchDailyMetrics).mockReset();
  vi.mocked(fetchMedia).mockReset();
  vi.mocked(fetchPosts).mockReset();
});

describe("runGbpSync — guards", () => {
  it("returns no_db when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const res = await runGbpSync({ trigger: "test", lockConnectionFactory });
    expect(res).toEqual({ ok: false, reason: "no_db", error: expect.any(String) });
  });

  it("returns unconfigured when no location is set", async () => {
    vi.mocked(getDb).mockResolvedValue({} as never);
    vi.mocked(getGbpTarget).mockReturnValue(null as never);
    const res = await runGbpSync({ trigger: "test", lockConnectionFactory });
    expect(res).toMatchObject({ ok: false, reason: "unconfigured" });
  });
});

describe("runGbpSync — advisory lock (cross-instance)", () => {
  it("no-ops when another instance holds the lock (busy → already_running)", async () => {
    vi.mocked(getDb).mockResolvedValue({} as never);
    let performReached = false;
    const busyConn: LockConnection = {
      async query(sql: string) {
        if (/GET_LOCK/i.test(sql)) return [[{ v: 0 }], []]; // 0 = busy
        performReached = true;
        return [[], []];
      },
      async end() {},
      destroy() {},
    };
    const res = await runGbpSync({ trigger: "test", lockConnectionFactory: async () => busyConn });
    expect(res).toEqual({ ok: false, reason: "already_running" });
    expect(performReached).toBe(false);
  });

  it("never throws even if the sync body hits a dead database (resolves ok:false)", async () => {
    // getDb resolves to a db whose first write rejects → performSync must catch.
    const rejecting = {
      then(_res: (v: unknown) => unknown, rej: (e: unknown) => unknown) {
        rej(new Error("db down"));
      },
    };
    const deadDb = {
      insert() {
        return { values: () => rejecting };
      },
    };
    vi.mocked(getDb).mockResolvedValue(deadDb as never);
    stubHappy();
    const res = await runGbpSync({ trigger: "test", lockConnectionFactory });
    expect(res.ok).toBe(false);
  });
});

describe("runGbpSync — history finalization", () => {
  it("finalizes the history row to success with per-resource counts", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    stubHappy();

    const res = await runGbpSync({ trigger: "test", lockConnectionFactory });

    expect(res).toMatchObject({ ok: true, reviewsSynced: 2, photosSynced: 1, postsSynced: 1 });
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("success");
    expect(history[0].completedAt).toBeInstanceOf(Date);
    expect(history[0].reviewsSynced).toBe(2);
  });

  it("finalizes the history row to error and preserves the message on failure", async () => {
    const { db, history } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    // Fail after the history row is opened: token fetch throws.
    vi.mocked(getGbpAccessToken).mockRejectedValue(new Error("boom-token"));

    const res = await runGbpSync({ trigger: "test", lockConnectionFactory });

    expect(res.ok).toBe(false);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("error");
    expect(String(history[0].error)).toContain("boom-token");
    expect(history[0].completedAt).toBeInstanceOf(Date);
  });

  it("marks reason=unavailable when Google is unreachable (best-effort still finalizes)", async () => {
    const { db } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    const { GbpUnavailableError } = await import("../../integrations/gbp");
    vi.mocked(getGbpAccessToken).mockRejectedValue(new GbpUnavailableError("not connected"));

    const res = await runGbpSync({ trigger: "test", lockConnectionFactory });
    expect(res).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("runGbpSync — idempotency", () => {
  it("re-running with identical data does not duplicate cache rows", async () => {
    const { db, stores } = makeWriteDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    stubHappy();

    await runGbpSync({ trigger: "one", lockConnectionFactory });
    const afterFirst = {
      metrics: stores.get(gbpDailyMetrics)!.size,
      reviews: stores.get(gbpReviews)!.size,
      photos: stores.get(gbpPhotos)!.size,
      posts: stores.get(gbpPosts)!.size,
    };

    await runGbpSync({ trigger: "two", lockConnectionFactory });
    const afterSecond = {
      metrics: stores.get(gbpDailyMetrics)!.size,
      reviews: stores.get(gbpReviews)!.size,
      photos: stores.get(gbpPhotos)!.size,
      posts: stores.get(gbpPosts)!.size,
    };

    expect(afterSecond).toEqual(afterFirst);
    expect(afterFirst.reviews).toBe(2);
    expect(afterFirst.photos).toBe(1);
    expect(afterFirst.posts).toBe(1);
  });
});

describe("readGbpSyncStatus", () => {
  it("returns the latest successful sync even when a newer run is still running", async () => {
    const successRow = {
      id: 1,
      status: "success" as const,
      startedAt: new Date("2026-07-10T00:00:00Z"),
      completedAt: new Date("2026-07-10T00:05:00Z"),
      error: null,
    };
    const latestRow = {
      id: 2,
      status: "running" as const,
      startedAt: new Date("2026-07-11T00:00:00Z"),
      completedAt: null,
      error: null,
    };
    const selectQueue: unknown[][] = [[latestRow], [successRow]];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => Promise.resolve(selectQueue.shift() ?? []) }),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);

    const status = await readGbpSyncStatus();
    expect(status.connected).toBe(true);
    expect(status.lastRunStatus).toBe("running");
    expect(status.lastSuccessAt).toBe(successRow.completedAt.toISOString());
    expect(status.stale).toBe(false);
  });
});
