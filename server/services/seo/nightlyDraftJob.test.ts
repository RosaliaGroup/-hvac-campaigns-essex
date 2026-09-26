import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../seo/lockedPages", () => ({ findLockedPages: vi.fn(async () => new Map()) }));
vi.mock("./bulkApprove", () => ({
  isInPendingBatch: vi.fn(async () => false),
  approveBatchToPR: vi.fn(),
  yyyymmdd: (d: Date = new Date()) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
}));
vi.mock("./draftManagement", () => ({ regenerateUnlockedDrafts: vi.fn() }));
vi.mock("./tags", () => ({ addTag: vi.fn(async () => {}) }));
vi.mock("./auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("../emailService", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("./warmupGate", () => ({ isWarmedUp: vi.fn() }));
vi.mock("./circuitBreaker", () => ({ checkCircuitBreakerConditions: vi.fn() }));
vi.mock("./autoMerge", () => ({ armHold: vi.fn() }));

import { getDb } from "../../db";
import { findLockedPages } from "../../seo/lockedPages";
import { isInPendingBatch, approveBatchToPR } from "./bulkApprove";
import { regenerateUnlockedDrafts } from "./draftManagement";
import { isWarmedUp } from "./warmupGate";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { armHold } from "./autoMerge";
import { selectNightlyDraftCandidates, runNightlyDraftJob, MAX_NIGHTLY_DRAFTS, type NightlyCandidatePage } from "./nightlyDraftJob";
import { seoPages, seoAiDrafts } from "../../../drizzle/schema";

const NOW = new Date("2026-09-26T06:00:00Z");

function page(overrides: Partial<NightlyCandidatePage> & { pageId: number; pagePath: string }): NightlyCandidatePage {
  return { impressions: 500, position: 15, ctr: 0.02, draftUpdatedAt: null, ...overrides };
}

describe("selectNightlyDraftCandidates (spec Part 1 acceptance tests)", () => {
  it("never includes a locked page", () => {
    const pages = [page({ pageId: 1, pagePath: "/locked-page" })];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(["/locked-page"]), pendingBatchPaths: new Set(), now: NOW });
    expect(result).toEqual([]);
  });

  it("never includes a page in a pending (pr_open) batch", () => {
    const pages = [page({ pageId: 1, pagePath: "/pending-page" })];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(["/pending-page"]), now: NOW });
    expect(result).toEqual([]);
  });

  it("never includes a page with impressions below 20 (insufficient data)", () => {
    const pages = [page({ pageId: 1, pagePath: "/low-impressions", impressions: 19 })];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result).toEqual([]);
  });

  it("includes a page with exactly 20 impressions (the boundary)", () => {
    const pages = [page({ pageId: 1, pagePath: "/boundary", impressions: 20 })];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result.map((r) => r.pagePath)).toEqual(["/boundary"]);
  });

  it("excludes a page drafted less than 14 days ago", () => {
    const recent = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    const pages = [page({ pageId: 1, pagePath: "/recently-drafted", draftUpdatedAt: recent })];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result).toEqual([]);
  });

  it("includes a page drafted exactly 14+ days ago", () => {
    const old = new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1000);
    const pages = [page({ pageId: 1, pagePath: "/old-draft", draftUpdatedAt: old })];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result.map((r) => r.pagePath)).toEqual(["/old-draft"]);
  });

  it("ranks tier 0 (impressions>=100, position 8-20) above tier 1 (impressions>=100, position<=25, low CTR) above tier 2 (everything else)", () => {
    const pages = [
      page({ pageId: 1, pagePath: "/tier2", impressions: 50, position: 3, ctr: 0.1 }),
      page({ pageId: 2, pagePath: "/tier1", impressions: 200, position: 24, ctr: 0.005 }),
      page({ pageId: 3, pagePath: "/tier0", impressions: 150, position: 12, ctr: 0.03 }),
    ];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result.map((r) => r.pagePath)).toEqual(["/tier0", "/tier1", "/tier2"]);
  });

  it("within a tier, ranks by impressions descending", () => {
    const pages = [
      page({ pageId: 1, pagePath: "/low", impressions: 30 }),
      page({ pageId: 2, pagePath: "/high", impressions: 900 }),
      page({ pageId: 3, pagePath: "/mid", impressions: 300 }),
    ];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result.map((r) => r.pagePath)).toEqual(["/high", "/mid", "/low"]);
  });

  it("caps at 20 pages per night", () => {
    const pages = Array.from({ length: 30 }, (_, i) => page({ pageId: i, pagePath: `/page-${i}`, impressions: 100 + i }));
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    expect(result.length).toBe(MAX_NIGHTLY_DRAFTS);
    expect(result.length).toBe(20);
  });

  it("a CTR of exactly 1% does not qualify for tier 1 (< 1% required, not <=) — still selected, just deprioritized to tier 2", () => {
    const pages = [
      page({ pageId: 1, pagePath: "/exactly-1pct", impressions: 200, position: 24, ctr: 0.01 }),
      page({ pageId: 2, pagePath: "/under-1pct", impressions: 200, position: 24, ctr: 0.009 }),
    ];
    const result = selectNightlyDraftCandidates(pages, { lockedPaths: new Set(), pendingBatchPaths: new Set(), now: NOW });
    // /under-1pct is genuinely tier 1 (ranks first); /exactly-1pct falls to tier 2 (ranks second) despite higher impressions ordering not mattering here.
    expect(result.map((r) => r.pagePath)).toEqual(["/under-1pct", "/exactly-1pct"]);
  });
});

describe("runNightlyDraftJob — auto-approve gate (addendum §A1)", () => {
  const pageRow = { id: 1, page: "/hvac-newark-nj", impressions: 500, position: 15, ctr: 0.02 };

  function makeDb() {
    return {
      select: () => ({
        from: (table: unknown) => Promise.resolve(table === seoPages ? [pageRow] : table === seoAiDrafts ? [] : []),
      }),
    };
  }

  beforeEach(() => {
    vi.mocked(getDb).mockReset().mockResolvedValue(makeDb() as never);
    vi.mocked(findLockedPages).mockReset().mockResolvedValue(new Map());
    vi.mocked(isInPendingBatch).mockReset().mockResolvedValue(false);
    vi.mocked(regenerateUnlockedDrafts).mockReset().mockResolvedValue({
      results: [{ pageId: 1, ok: true, draft: null }],
      skippedLocked: [],
    });
    vi.mocked(isWarmedUp).mockReset().mockResolvedValue(false);
    vi.mocked(checkCircuitBreakerConditions).mockReset().mockResolvedValue({ shouldPause: false, reason: null });
    vi.mocked(approveBatchToPR).mockReset().mockResolvedValue({ batch: { id: 99 } as never, prUrl: "url", prNumber: 1 });
    vi.mocked(armHold).mockReset().mockResolvedValue(undefined);
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
  });

  it("stages only (does not call approveBatchToPR) when the meta lane is NOT warmed up", async () => {
    const result = await runNightlyDraftJob(NOW);
    expect(result.ready).toBe(1);
    expect(result.autoApproved).toBe(false);
    expect(result.batchId).toBeUndefined();
    expect(approveBatchToPR).not.toHaveBeenCalled();
    expect(armHold).not.toHaveBeenCalled();
  });

  it("stages only when warmed up but the circuit breaker is paused", async () => {
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(checkCircuitBreakerConditions).mockResolvedValue({ shouldPause: true, reason: "veto" });

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(false);
    expect(approveBatchToPR).not.toHaveBeenCalled();
  });

  it("stages only when warmed up + circuit clear but SEO_AUTOPUBLISH_ENABLED isn't \"true\" (addendum §A5 master switch)", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "false";
    vi.mocked(isWarmedUp).mockResolvedValue(true);

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(false);
    expect(approveBatchToPR).not.toHaveBeenCalled();
    expect(isWarmedUp).not.toHaveBeenCalled(); // the flag is checked first
  });

  it("calls approveBatchToPR with label auto-YYYYMMDD and arms the hold when warmed up AND the circuit is clear", async () => {
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(checkCircuitBreakerConditions).mockResolvedValue({ shouldPause: false, reason: null });

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(true);
    expect(result.batchId).toBe(99);
    expect(approveBatchToPR).toHaveBeenCalledWith({ pageIds: [1], label: "auto-20260926", actorId: null });
    expect(armHold).toHaveBeenCalledWith(99);
  });

  it("does not auto-approve when there are no ready (clean) drafts, even if warmed up", async () => {
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(regenerateUnlockedDrafts).mockResolvedValue({ results: [{ pageId: 1, ok: false, error: "lint blocked" }], skippedLocked: [] });

    const result = await runNightlyDraftJob(NOW);

    expect(result.ready).toBe(0);
    expect(result.autoApproved).toBe(false);
    expect(approveBatchToPR).not.toHaveBeenCalled();
  });

  it("degrades to staged (does not throw) when the auto-approve call itself fails", async () => {
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(approveBatchToPR).mockRejectedValue(new Error("GitHub is down"));

    const result = await runNightlyDraftJob(NOW);

    expect(result.ready).toBe(1); // the draft itself is unaffected
    expect(result.autoApproved).toBe(false);
  });

  it("does not warn about stale price ranges today — VERIFIED_FACTS.priceRanges is empty (docs/positioning-warranty-spec.md §9b)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runNightlyDraftJob(NOW);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("price range"));
    warnSpy.mockRestore();
  });
});
