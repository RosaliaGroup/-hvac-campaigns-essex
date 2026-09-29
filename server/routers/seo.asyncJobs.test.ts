/**
 * Router-level contract for the SEO page's long-running mutations (2026-09-29
 * 504 fix). generateOptimization, regenerateOptimization,
 * bulkGenerateOptimization, regenerateUnlockedDrafts and sync must:
 *   - return { jobId, started } WITHOUT waiting for the slow service call,
 *   - expose progress/result/error through getJobStatus,
 *   - dedupe a retried click onto the job already running,
 *   - stay admin-only (mutations and the poll endpoints).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("../services/seo/ai/jobs", () => ({
  runOptimizationJob: vi.fn(),
  runBulkOptimization: vi.fn(),
  DuplicateJobError: class DuplicateJobError extends Error {},
  DEFAULT_BULK_CONCURRENCY: 3,
}));
vi.mock("../services/seo/sync", () => ({ runSeoSync: vi.fn(), readSyncStatus: vi.fn() }));
vi.mock("../services/seo/draftManagement", () => ({
  regenerateUnlockedDrafts: vi.fn(),
  discardAllDrafts: vi.fn(),
  expireStaleDrafts: vi.fn(),
}));

import { runOptimizationJob, runBulkOptimization } from "../services/seo/ai/jobs";
import { runSeoSync } from "../services/seo/sync";
import { regenerateUnlockedDrafts } from "../services/seo/draftManagement";
import { _resetLaneJobs } from "../services/asyncLaneJob";
import { createCallerFactory } from "../_core/trpc";
import { seoRouter } from "./seo";

const admin = { id: 1, role: "admin", teamRole: "admin" };
const member = { id: 2, role: "member", teamRole: "member" };
const callerFor = (user: unknown) => createCallerFactory(seoRouter)({ user } as never);

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const draft = { pageId: 1, title: "T" } as never;

beforeEach(() => {
  _resetLaneJobs();
  vi.mocked(runOptimizationJob).mockReset();
  vi.mocked(runBulkOptimization).mockReset();
  vi.mocked(runSeoSync).mockReset();
  vi.mocked(regenerateUnlockedDrafts).mockReset();
});

describe("single-page optimize / regenerate", () => {
  it("returns a job id immediately — the AI call is still pending — then reports done", async () => {
    const gate = deferred<typeof draft>();
    vi.mocked(runOptimizationJob).mockReturnValue(gate.promise);
    const caller = callerFor(admin);

    const started = await caller.generateOptimization({ id: 5, action: "rewrite_title" });
    expect(started.started).toBe(true);
    expect((await caller.getJobStatus({ jobId: started.jobId })).status).toBe("running");

    gate.resolve(draft);
    await vi.waitFor(async () => expect((await caller.getJobStatus({ jobId: started.jobId })).status).toBe("done"));
    expect(await caller.getJobStatus({ jobId: started.jobId })).toMatchObject({ result: { pageId: 5, action: "rewrite_title" }, error: null });
  });

  it("a retried click (after a 504) attaches to the running job instead of starting a duplicate", async () => {
    const gate = deferred<typeof draft>();
    vi.mocked(runOptimizationJob).mockReturnValue(gate.promise);
    const caller = callerFor(admin);

    const first = await caller.generateOptimization({ id: 5, action: "rewrite_title" });
    const retry = await caller.generateOptimization({ id: 5, action: "rewrite_title" });
    expect(retry).toEqual({ jobId: first.jobId, started: false });
    expect(runOptimizationJob).toHaveBeenCalledTimes(1);
    gate.resolve(draft);
  });

  it("generate and regenerate share one slot per page, but different pages run in parallel", async () => {
    const gate = deferred<typeof draft>();
    vi.mocked(runOptimizationJob).mockReturnValue(gate.promise);
    const caller = callerFor(admin);

    const gen = await caller.generateOptimization({ id: 5, action: "rewrite_title" });
    const regen = await caller.regenerateOptimization({ id: 5, action: "rewrite_title" });
    const other = await caller.regenerateOptimization({ id: 6, action: "rewrite_title" });
    expect(regen).toEqual({ jobId: gen.jobId, started: false });
    expect(other.started).toBe(true);
    expect(other.jobId).not.toBe(gen.jobId);
    gate.resolve(draft);
  });

  it("surfaces a provider/lint failure as the job error, not as a thrown mutation", async () => {
    vi.mocked(runOptimizationJob).mockRejectedValue(new Error("Draft blocked by claims linter: title_too_long"));
    const caller = callerFor(admin);

    const { jobId } = await caller.regenerateOptimization({ id: 5, action: "rewrite_title" });
    await vi.waitFor(async () => expect((await caller.getJobStatus({ jobId })).status).toBe("error"));
    expect(await caller.getJobStatus({ jobId })).toMatchObject({ error: "Draft blocked by claims linter: title_too_long" });
  });
});

describe("bulk optimize", () => {
  it("returns immediately, streams per-page progress, and returns outcomes WITHOUT draft bodies", async () => {
    const gate = deferred();
    vi.mocked(runBulkOptimization).mockImplementation(async (ids, _action, _c, onProgress) => {
      onProgress?.(0, ids.length);
      onProgress?.(1, ids.length);
      await gate.promise;
      onProgress?.(2, ids.length);
      return [
        { pageId: ids[0], ok: true as const, draft: { big: "draft body" } as never },
        { pageId: ids[1], ok: false as const, error: "provider timeout" },
      ];
    });
    const caller = callerFor(admin);

    const { jobId, started } = await caller.bulkGenerateOptimization({ ids: [10, 11], action: "optimize_everything" });
    expect(started).toBe(true);
    await vi.waitFor(async () =>
      expect(await caller.getJobStatus({ jobId })).toMatchObject({ status: "running", progress: { done: 1, total: 2 } }),
    );

    gate.resolve();
    await vi.waitFor(async () => expect((await caller.getJobStatus({ jobId })).status).toBe("done"));
    const done = await caller.getJobStatus({ jobId });
    expect(done).toMatchObject({
      progress: { done: 2, total: 2 },
      result: {
        succeeded: 1,
        failed: 1,
        skippedPendingBatch: [],
        results: [
          { pageId: 10, ok: true },
          { pageId: 11, ok: false, error: "provider timeout" },
        ],
      },
    });
    expect(JSON.stringify(done)).not.toContain("draft body");
  });

  it("dedupes the identical selection regardless of id order; a different selection is its own job", async () => {
    const gate = deferred();
    vi.mocked(runBulkOptimization).mockImplementation(async () => { await gate.promise; return []; });
    const caller = callerFor(admin);

    const a = await caller.bulkGenerateOptimization({ ids: [3, 1, 2], action: "optimize_everything" });
    const same = await caller.bulkGenerateOptimization({ ids: [1, 2, 3, 3], action: "optimize_everything" });
    const different = await caller.bulkGenerateOptimization({ ids: [1, 2], action: "optimize_everything" });
    expect(same).toEqual({ jobId: a.jobId, started: false });
    expect(different.started).toBe(true);
    expect(runBulkOptimization).toHaveBeenCalledTimes(2);
    gate.resolve();
  });
});

describe("regenerate drafts (unlocked)", () => {
  it("runs as a job with progress and reports skipped-locked pages", async () => {
    vi.mocked(regenerateUnlockedDrafts).mockImplementation(async (_ids, _c, onProgress) => {
      onProgress?.(0, 2);
      onProgress?.(1, 2);
      onProgress?.(2, 2);
      return {
        results: [
          { pageId: 1, ok: true as const, draft: null },
          { pageId: 2, ok: true as const, draft: null },
        ],
        skippedLocked: ["/locked-page"],
      };
    });
    const caller = callerFor(admin);

    const { jobId } = await caller.regenerateUnlockedDrafts({ ids: [1, 2, 3] });
    await vi.waitFor(async () => expect((await caller.getJobStatus({ jobId })).status).toBe("done"));
    expect(await caller.getJobStatus({ jobId })).toMatchObject({
      progress: { done: 2, total: 2 },
      result: { results: [{ pageId: 1, ok: true }, { pageId: 2, ok: true }], skippedLocked: ["/locked-page"] },
    });
  });
});

describe("Search Console sync", () => {
  it("returns a job id instead of awaiting the sync, then carries the SyncResult", async () => {
    const gate = deferred<{ ok: true; pagesSynced: number; queriesSynced: number; window: never }>();
    vi.mocked(runSeoSync).mockReturnValue(gate.promise);
    const caller = callerFor(admin);

    const { jobId, started } = await caller.sync();
    expect(started).toBe(true);
    expect((await caller.getJobStatus({ jobId })).status).toBe("running");

    gate.resolve({ ok: true, pagesSynced: 204, queriesSynced: 100, window: {} as never });
    await vi.waitFor(async () => expect((await caller.getJobStatus({ jobId })).status).toBe("done"));
    expect(await caller.getJobStatus({ jobId })).toMatchObject({ result: { ok: true, pagesSynced: 204, queriesSynced: 100 } });
  });

  it("passes a failed sync through as a normal result (the UI branches on reason)", async () => {
    vi.mocked(runSeoSync).mockResolvedValue({ ok: false, reason: "unavailable" });
    const caller = callerFor(admin);
    const { jobId } = await caller.sync();
    await vi.waitFor(async () => expect((await caller.getJobStatus({ jobId })).status).toBe("done"));
    expect(await caller.getJobStatus({ jobId })).toMatchObject({ result: { ok: false, reason: "unavailable" } });
  });
});

describe("poll endpoints", () => {
  it("getJobStatus answers 'unknown' for an id the server doesn't have (restart / pruned)", async () => {
    expect(await callerFor(admin).getJobStatus({ jobId: "job_gone" })).toEqual({ status: "unknown" });
  });

  it("getActiveJobs lists only running jobs, filterable by kind — the reload re-attach path", async () => {
    const gate = deferred<typeof draft>();
    vi.mocked(runOptimizationJob).mockReturnValue(gate.promise);
    vi.mocked(runSeoSync).mockResolvedValue({ ok: false, reason: "unavailable" });
    const caller = callerFor(admin);

    const opt = await caller.generateOptimization({ id: 9, action: "rewrite_title" });
    await caller.sync();
    await vi.waitFor(async () => expect((await caller.getActiveJobs({ kind: "seoSync" })).length).toBe(0));

    const running = await caller.getActiveJobs({ kind: "optimize" });
    expect(running.map((j) => ({ id: j.id, key: j.key }))).toEqual([{ id: opt.jobId, key: "optimize:9" }]);
    expect((await caller.getActiveJobs()).map((j) => j.key)).toEqual(["optimize:9"]);
    gate.resolve(draft);
  });

  it("everything here is admin-only", async () => {
    const caller = callerFor(member);
    await expect(caller.generateOptimization({ id: 1, action: "rewrite_title" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.regenerateOptimization({ id: 1, action: "rewrite_title" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.bulkGenerateOptimization({ ids: [1], action: "rewrite_title" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.regenerateUnlockedDrafts({ ids: [1] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.sync()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getJobStatus({ jobId: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getActiveJobs()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
