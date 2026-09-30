import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateAutoMergeReadiness } from "./autoMerge";

// Relative to the real clock, not a hardcoded date: NOW is also used as the
// `now` fed into checkAndMergeIfReady's real (non-injected) Date.now() checks
// further below, so PAST/FUTURE must stay past/future of the actual wall
// clock whenever this suite runs, not just of the fixed NOW constant.
const NOW = new Date();
const PAST = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

const cleanBatch = { status: "pr_open" as const, holdUntil: PAST, commitSha: "abc123", prNumber: 5 };
const cleanSignals = { batch: cleanBatch, now: NOW, isWarmedUp: true, circuitPaused: false, netlifyState: "success" as const, hasComments: false };

describe("evaluateAutoMergeReadiness (pure)", () => {
  it("ready when every gate passes", () => {
    expect(evaluateAutoMergeReadiness(cleanSignals)).toEqual({ ready: true });
  });

  it("not ready when the batch isn't pr_open", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, batch: { ...cleanBatch, status: "merged" } })).toEqual({ ready: false, reason: "not_pr_open" });
  });

  it("not ready with no hold set at all (a normal human-reviewed batch)", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, batch: { ...cleanBatch, holdUntil: null } })).toEqual({ ready: false, reason: "no_hold" });
  });

  it("not ready while the hold hasn't expired yet", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, batch: { ...cleanBatch, holdUntil: FUTURE } })).toEqual({ ready: false, reason: "hold_not_expired" });
  });

  it("not ready when the lane isn't warmed up", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, isWarmedUp: false })).toEqual({ ready: false, reason: "not_warmed_up" });
  });

  it("not ready when the circuit breaker is paused", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, circuitPaused: true })).toEqual({ ready: false, reason: "circuit_paused" });
  });

  it("not ready with no commit sha", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, batch: { ...cleanBatch, commitSha: null } })).toEqual({ ready: false, reason: "no_commit_sha" });
  });

  it("not ready when Netlify isn't green (failure/pending/unknown all block)", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, netlifyState: "failure" })).toEqual({ ready: false, reason: "netlify_not_green" });
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, netlifyState: "pending" })).toEqual({ ready: false, reason: "netlify_not_green" });
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, netlifyState: "unknown" })).toEqual({ ready: false, reason: "netlify_not_green" });
  });

  it("not ready when there is any PR comment ('no open review comment' gate)", () => {
    expect(evaluateAutoMergeReadiness({ ...cleanSignals, hasComments: true })).toEqual({ ready: false, reason: "has_comments" });
  });

  it("checks gates in a sensible priority order — status before hold before warm-up", () => {
    // Multiple things wrong at once — the first meaningful blocker should surface, not an arbitrary one.
    const result = evaluateAutoMergeReadiness({ ...cleanSignals, batch: { ...cleanBatch, status: "failed", holdUntil: null }, isWarmedUp: false });
    expect(result).toEqual({ ready: false, reason: "not_pr_open" });
  });
});

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("./bulkApprove", () => ({ laneForBatch: vi.fn(() => "meta"), refreshBatchStatus: vi.fn(), approveBatchToPR: vi.fn() }));
vi.mock("./warmupGate", () => ({ isWarmedUp: vi.fn(), advanceWarmup: vi.fn() }));
vi.mock("./circuitBreaker", () => ({ checkCircuitBreakerConditions: vi.fn() }));
vi.mock("./github", () => ({ getNetlifyCheckState: vi.fn(), hasAnyPRComments: vi.fn(), mergePR: vi.fn() }));
vi.mock("./actionLinks", () => ({ signActionLink: vi.fn(() => "fake-token") }));
vi.mock("./auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("../emailService", () => ({ sendEmail: vi.fn(async () => true) }));

import { getDb } from "../../db";
import { approveBatchToPR, refreshBatchStatus } from "./bulkApprove";
import { isWarmedUp, advanceWarmup } from "./warmupGate";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { getNetlifyCheckState, hasAnyPRComments, mergePR } from "./github";
import { logAudit } from "./auditLog";
import { sendEmail } from "../emailService";
import { armHold, checkAndMergeIfReady, publishNow, approveMetaBatchWithAutopublish, runAutoMergeTick, AUTO_MERGE_POLL_MS } from "./autoMerge";

function makeDb(batch: Record<string, any>) {
  const row = { ...batch };
  const db: any = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([row]) }) }) }),
    update: () => ({ set: (patch: Record<string, any>) => ({ where: () => { Object.assign(row, patch); return Promise.resolve(); } }) }),
  };
  return { db, row };
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(isWarmedUp).mockReset().mockResolvedValue(true);
  vi.mocked(advanceWarmup).mockReset();
  vi.mocked(checkCircuitBreakerConditions).mockReset().mockResolvedValue({ shouldPause: false, reason: null });
  vi.mocked(getNetlifyCheckState).mockReset().mockResolvedValue("success");
  vi.mocked(hasAnyPRComments).mockReset().mockResolvedValue(false);
  vi.mocked(mergePR).mockReset().mockResolvedValue({ merged: true, sha: "merged-sha" });
  vi.mocked(logAudit).mockReset();
  vi.mocked(sendEmail).mockReset().mockResolvedValue(true);
  process.env.SEO_ALERT_EMAIL = "ana@example.com";
  process.env.SEO_AUTOPUBLISH_ENABLED = "true";
});

describe("checkAndMergeIfReady", () => {
  it("merges and advances warm-up when every gate passes", async () => {
    const { db, row } = makeDb({ id: 1, status: "pr_open", holdUntil: PAST, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", revertsBatchId: null, label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);
    const result = await checkAndMergeIfReady(1);
    expect(result).toEqual({ merged: true, sha: "merged-sha" });
    expect(row.status).toBe("merged");
    expect(advanceWarmup).toHaveBeenCalledWith("meta", null);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "merged_detected", after: expect.objectContaining({ mergeMode: "auto" }) }));
  });

  it("does not advance warm-up for a revert batch's own auto-merge", async () => {
    const { db } = makeDb({ id: 1, status: "pr_open", holdUntil: PAST, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", revertsBatchId: 99, label: "revert" });
    vi.mocked(getDb).mockResolvedValue(db);
    await checkAndMergeIfReady(1);
    expect(advanceWarmup).not.toHaveBeenCalled();
  });

  it("does not merge when the hold hasn't expired", async () => {
    const { db } = makeDb({ id: 1, status: "pr_open", holdUntil: FUTURE, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", revertsBatchId: null, label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);
    const result = await checkAndMergeIfReady(1);
    expect(result).toEqual({ merged: false, reason: "hold_not_expired" });
    expect(mergePR).not.toHaveBeenCalled();
  });

  it("does not merge when Netlify is not green", async () => {
    vi.mocked(getNetlifyCheckState).mockResolvedValue("failure");
    const { db } = makeDb({ id: 1, status: "pr_open", holdUntil: PAST, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", revertsBatchId: null, label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);
    const result = await checkAndMergeIfReady(1);
    expect(result).toEqual({ merged: false, reason: "netlify_not_green" });
    expect(mergePR).not.toHaveBeenCalled();
  });
});

describe("armHold", () => {
  it("sets holdUntil in the future and sends an email notification with a veto link", async () => {
    const { db, row } = makeDb({ id: 1, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", label: "batch-1", prUrl: "https://github.com/x/pull/1" });
    vi.mocked(getDb).mockResolvedValue(db);
    await armHold(1);
    expect(row.holdUntil).toBeInstanceOf(Date);
    expect(row.holdUntil.getTime()).toBeGreaterThan(Date.now());
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@example.com", html: expect.stringContaining("fake-token") }));
  });

  it("skips sending email when SEO_ALERT_EMAIL is unset", async () => {
    delete process.env.SEO_ALERT_EMAIL;
    const { db } = makeDb({ id: 1, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", label: "batch-1" });
    vi.mocked(getDb).mockResolvedValue(db);
    await armHold(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is the addendum §A5 master switch: no-ops entirely (no hold, no email) when SEO_AUTOPUBLISH_ENABLED isn't \"true\"", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "false";
    const { db, row } = makeDb({ id: 1, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", label: "batch-1" });
    vi.mocked(getDb).mockResolvedValue(db);
    await armHold(1);
    expect(row.holdUntil).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("publishNow", () => {
  it("merges immediately even if the lane isn't warmed up, as long as Netlify is green", async () => {
    vi.mocked(isWarmedUp).mockResolvedValue(false);
    const { db, row } = makeDb({ id: 1, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", revertsBatchId: null, label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);
    const result = await publishNow(1, 7);
    expect(result).toEqual({ merged: true, sha: "merged-sha" });
    expect(row.status).toBe("merged");
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ actorId: 7, after: expect.objectContaining({ mergeMode: "manual_override" }) }));
  });

  it("still refuses when Netlify is not green", async () => {
    vi.mocked(getNetlifyCheckState).mockResolvedValue("failure");
    const { db } = makeDb({ id: 1, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 5, branch: "pr-seo-meta-20260926", revertsBatchId: null, label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);
    const result = await publishNow(1, 7);
    expect(result).toEqual({ merged: false, reason: "netlify_not_green" });
    expect(mergePR).not.toHaveBeenCalled();
  });
});

describe("approveMetaBatchWithAutopublish", () => {
  it("arms the hold when the meta lane is warmed up", async () => {
    vi.mocked(approveBatchToPR).mockResolvedValue({ batch: { id: 10 } as never, prUrl: "url", prNumber: 1 });
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    const { db, row } = makeDb({ id: 10, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 1, branch: "pr-seo-meta-20260926", label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);

    await approveMetaBatchWithAutopublish({ pageIds: [1], label: "x", actorId: 1 });

    expect(isWarmedUp).toHaveBeenCalledWith("meta");
    expect(row.holdUntil).toBeInstanceOf(Date);
  });

  it("does NOT arm a hold when the meta lane is not warmed up — behaves like a normal PR", async () => {
    vi.mocked(approveBatchToPR).mockResolvedValue({ batch: { id: 11 } as never, prUrl: "url", prNumber: 2 });
    vi.mocked(isWarmedUp).mockResolvedValue(false);
    const { db, row } = makeDb({ id: 11, status: "pr_open", holdUntil: null, commitSha: "abc", prNumber: 2, branch: "pr-seo-meta-20260926", label: "x" });
    vi.mocked(getDb).mockResolvedValue(db);

    await approveMetaBatchWithAutopublish({ pageIds: [1], label: "x", actorId: 1 });

    expect(row.holdUntil).toBeNull();
  });
});

describe("runAutoMergeTick — per-tick logging and the bot-comment regression (PR #141)", () => {
  function makeListDb(batch: Record<string, any> | null) {
    const row = batch ? { ...batch } : null;
    const rows = () => (row ? [row] : []);
    const db: any = {
      select: () => ({ from: () => ({ where: () => { const p: any = Promise.resolve(rows()); p.limit = () => Promise.resolve(rows()); return p; } }) }),
      update: () => ({ set: (patch: Record<string, any>) => ({ where: () => { if (row) Object.assign(row, patch); return Promise.resolve(); } }) }),
    };
    return { db, row };
  }
  const batch = { id: 2, status: "pr_open", holdUntil: PAST, commitSha: "abc", prNumber: 141, branch: "pr-seo-meta-20260929", revertsBatchId: null, label: "auto-20260929" };
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(refreshBatchStatus).mockReset().mockResolvedValue(undefined as never);
  });
  afterEach(() => log.mockRestore());

  const lines = () => log.mock.calls.map((c) => String(c[0]));

  it("polls every 15 minutes", () => {
    expect(AUTO_MERGE_POLL_MS).toBe(15 * 60 * 1000);
  });

  it("logs a start line, a line per blocked batch naming the gate, and a done line — so an unmerged batch is explainable from the logs", async () => {
    vi.mocked(hasAnyPRComments).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue(makeListDb(batch).db);

    const r = await runAutoMergeTick();

    expect(r).toEqual({ checked: 1, merged: 0 });
    expect(lines().some((l) => l.includes("auto-merge tick: 1 open batch(es) with a hold"))).toBe(true);
    expect(lines().some((l) => l.includes("batch 2 (auto-20260929) not merged: has_comments"))).toBe(true);
    expect(lines().some((l) => l.includes("auto-merge tick done: checked 1, merged 0"))).toBe(true);
    expect(mergePR).not.toHaveBeenCalled();
  });

  it("merges and logs the merge when every gate passes", async () => {
    vi.mocked(getDb).mockResolvedValue(makeListDb(batch).db);

    const r = await runAutoMergeTick();

    expect(r).toEqual({ checked: 1, merged: 1 });
    expect(mergePR).toHaveBeenCalledWith(141);
    expect(lines().some((l) => l.includes("auto-merged batch 2 (auto-20260929)"))).toBe(true);
  });

  it("still logs a tick line when there is nothing to do", async () => {
    vi.mocked(getDb).mockResolvedValue(makeListDb(null).db);
    expect(await runAutoMergeTick()).toEqual({ checked: 0, merged: 0 });
    expect(lines().some((l) => l.includes("0 open batch(es)"))).toBe(true);
  });

  it("skips (and logs) an overlapping tick instead of stacking it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    vi.mocked(refreshBatchStatus).mockImplementation((() => gate) as never);
    vi.mocked(getDb).mockResolvedValue(makeListDb(batch).db);

    const first = runAutoMergeTick();
    await new Promise((r) => setTimeout(r, 0));
    const second = await runAutoMergeTick();
    expect(second).toEqual({ checked: 0, merged: 0, skipped: true });
    expect(lines().some((l) => l.includes("tick skipped"))).toBe(true);

    release();
    await first;
  });

  it("a thrown check for one batch is logged and does not abort the tick", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(refreshBatchStatus).mockRejectedValue(new Error("GitHub down"));
    vi.mocked(getDb).mockResolvedValue(makeListDb(batch).db);

    const r = await runAutoMergeTick();

    expect(r).toEqual({ checked: 1, merged: 0 });
    expect(err).toHaveBeenCalledWith(expect.stringContaining("batch 2"), "GitHub down");
    err.mockRestore();
  });
});
