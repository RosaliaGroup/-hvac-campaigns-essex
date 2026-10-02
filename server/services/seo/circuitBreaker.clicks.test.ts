import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./auditLog", () => ({ listAuditLog: vi.fn(), logAudit: vi.fn() }));
vi.mock("./autopublishStateRepo", () => ({ getAutopublishState: vi.fn(), updateAutopublishState: vi.fn() }));
vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("./github", () => ({ getNetlifyCheckState: vi.fn(async () => "success") }));
vi.mock("../../integrations/searchConsole", () => ({
  getSearchConsoleAccessToken: vi.fn(async () => "tok"),
  getSeoSiteUrl: vi.fn(() => "https://mechanicalenterprise.com/"),
  querySearchAnalytics: vi.fn(),
}));

import { listAuditLog, logAudit } from "./auditLog";
import { getAutopublishState, updateAutopublishState } from "./autopublishStateRepo";
import { getDb } from "../../db";
import { querySearchAnalytics } from "../../integrations/searchConsole";
import {
  checkCircuitBreakerConditions,
  computeClickWindows,
  evaluateClicksDown,
  MIN_BASELINE_CLICKS,
} from "./circuitBreaker";

describe("computeClickWindows (pure)", () => {
  it("two back-to-back 7-day windows ending 3 days before now", () => {
    const w = computeClickWindows(new Date("2026-10-02T12:00:00Z"));
    expect(w.current).toEqual({ start: "2026-09-23", end: "2026-09-29" });
    expect(w.previous).toEqual({ start: "2026-09-16", end: "2026-09-22" });
  });
});

describe("evaluateClicksDown (pure)", () => {
  const noMerge = null;
  it("insufficient baseline: 49 clicks cannot trip, 50 can", () => {
    expect(evaluateClicksDown({ currentClicks: 0, baselineClicks: MIN_BASELINE_CLICKS - 1, titleBatchMerge: noMerge })).toEqual({ status: "insufficient_baseline", downPct: null });
    expect(evaluateClicksDown({ currentClicks: 0, baselineClicks: MIN_BASELINE_CLICKS, titleBatchMerge: noMerge })).toEqual({ status: "evaluated", downPct: 1 });
  });
  it("computes (baseline - current) / baseline and floors an increase at 0", () => {
    expect(evaluateClicksDown({ currentClicks: 72, baselineClicks: 100, titleBatchMerge: noMerge }).downPct).toBeCloseTo(0.28, 5);
    expect(evaluateClicksDown({ currentClicks: 130, baselineClicks: 100, titleBatchMerge: noMerge }).downPct).toBe(0);
  });
  it("a title-batch merge in the last 48h excludes the signal even with a huge drop", () => {
    expect(evaluateClicksDown({ currentClicks: 0, baselineClicks: 500, titleBatchMerge: { batchId: 3, mergedDetectedAt: "x" } })).toEqual({ status: "excluded_title_batch_merge", downPct: null });
  });
  it("missing data => unavailable (never a pause)", () => {
    expect(evaluateClicksDown({ currentClicks: null, baselineClicks: 100, titleBatchMerge: noMerge })).toEqual({ status: "unavailable", downPct: null });
  });
});

const cleanState = { id: 1, metaWarmupRemaining: 0, contentWarmupRemaining: 0, circuitBreakerPaused: false, circuitBreakerReason: null, circuitBreakerPausedAt: null, updatedAt: new Date() };
const NOW = new Date("2026-10-02T12:00:00Z");

/** GSC date rows: `cur` clicks spread over the current window, `prev` over the previous one. */
function gscRows(cur: number, prev: number) {
  const w = computeClickWindows(NOW);
  return [
    { keys: [w.current.start], clicks: cur, impressions: 0, ctr: 0, position: 0 },
    { keys: [w.previous.start], clicks: prev, impressions: 0, ctr: 0, position: 0 },
  ];
}
const dbWith = (batches: Array<Record<string, unknown>>) =>
  ({ select: () => ({ from: () => ({ where: () => Promise.resolve(batches), orderBy: () => ({ limit: () => Promise.resolve([]) }) }) }) }) as never;

let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(listAuditLog).mockReset().mockResolvedValue([]);
  vi.mocked(logAudit).mockReset();
  vi.mocked(getAutopublishState).mockReset().mockResolvedValue(cleanState);
  vi.mocked(updateAutopublishState).mockReset();
  vi.mocked(getDb).mockReset().mockResolvedValue(dbWith([]));
  vi.mocked(querySearchAnalytics).mockReset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); logSpy.mockRestore(); });

const evalLines = () => logSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[SEO][breaker] evaluation "));

describe("checkCircuitBreakerConditions — clicks signal", () => {
  it("clicks UP week over week: no pause", async () => {
    vi.mocked(querySearchAnalytics).mockResolvedValue(gscRows(128, 100) as never);
    expect((await checkCircuitBreakerConditions()).shouldPause).toBe(false);
    expect(updateAutopublishState).not.toHaveBeenCalled();
  });

  it("clicks down 28% on a 100-click baseline: pauses, and the pause audit carries the inputs", async () => {
    vi.mocked(querySearchAnalytics).mockResolvedValue(gscRows(72, 100) as never);
    const r = await checkCircuitBreakerConditions();
    expect(r.shouldPause).toBe(true);
    expect(r.reason).toContain("last 7 days vs the prior 7 days");
    const audit = vi.mocked(logAudit).mock.calls.find((c) => (c[0] as { action: string }).action === "circuit_breaker_paused")![0] as { after: { inputs: { clicks: { currentClicks: number; baselineClicks: number } } } };
    expect(audit.after.inputs.clicks).toMatchObject({ currentClicks: 72, baselineClicks: 100, status: "evaluated" });
  });

  it("a 40-click baseline (below the minimum) cannot pause even at -100%", async () => {
    vi.mocked(querySearchAnalytics).mockResolvedValue(gscRows(0, 40) as never);
    expect((await checkCircuitBreakerConditions()).shouldPause).toBe(false);
    expect(evalLines()[0]).toContain("insufficient_baseline");
  });

  it("a title batch merged within 48h: clicks are not evaluated and GSC is not even queried", async () => {
    vi.mocked(listAuditLog).mockImplementation(async (f) =>
      f?.action === "merged_detected" ? ([{ id: 9, batchId: 4, ts: new Date(NOW.getTime() - 3600_000), action: "merged_detected" }] as never) : [],
    );
    vi.mocked(getDb).mockResolvedValue(dbWith([{ id: 4, branch: "pr-seo-meta-20261001" }]));
    vi.mocked(querySearchAnalytics).mockResolvedValue(gscRows(0, 500) as never);
    expect((await checkCircuitBreakerConditions()).shouldPause).toBe(false);
    expect(querySearchAnalytics).not.toHaveBeenCalled();
    expect(evalLines()[0]).toContain("excluded_title_batch_merge");
  });

  it("a merged CONTENT batch does not trigger the title-batch exclusion", async () => {
    vi.mocked(listAuditLog).mockImplementation(async (f) =>
      f?.action === "merged_detected" ? ([{ id: 9, batchId: 5, ts: new Date(NOW.getTime() - 3600_000), action: "merged_detected" }] as never) : [],
    );
    vi.mocked(getDb).mockResolvedValue(dbWith([{ id: 5, branch: "pr-content-20261001-t3" }]));
    vi.mocked(querySearchAnalytics).mockResolvedValue(gscRows(10, 100) as never);
    expect((await checkCircuitBreakerConditions()).shouldPause).toBe(true);
  });

  it("GSC failure is 'unavailable' (no pause) and is logged with the error", async () => {
    vi.mocked(querySearchAnalytics).mockRejectedValue(new Error("searchAnalytics 500"));
    expect((await checkCircuitBreakerConditions()).shouldPause).toBe(false);
    expect(evalLines()[0]).toContain("unavailable");
    expect(evalLines()[0]).toContain("searchAnalytics 500");
  });

  it("logs the inputs (windows, numerator, denominator, threshold inputs) on EVERY evaluation, including already-paused", async () => {
    vi.mocked(querySearchAnalytics).mockResolvedValue(gscRows(100, 100) as never);
    await checkCircuitBreakerConditions();
    const line = evalLines()[0];
    expect(line).toContain("currentWindow");
    expect(line).toContain("previousWindow");
    expect(line).toContain("\"currentClicks\":100");
    expect(line).toContain("\"baselineClicks\":100");
    expect(line).toContain("\"minBaselineClicks\":50");
    vi.mocked(getAutopublishState).mockResolvedValue({ ...cleanState, circuitBreakerPaused: true, circuitBreakerReason: "r" } as never);
    await checkCircuitBreakerConditions();
    expect(evalLines()).toHaveLength(2);
    expect(evalLines()[1]).toContain("alreadyPaused");
  });
});
