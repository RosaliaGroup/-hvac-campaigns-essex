import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../seo/lockedPages", () => ({ findLockedPages: vi.fn(async () => new Map()) }));
vi.mock("./bulkApprove", () => ({
  isInPendingBatch: vi.fn(async () => false),
  approveBatchToPR: vi.fn(),
  buildBatchDiff: vi.fn(async (ids: number[]) => ids.map((id) => ({ pageId: id, lint: { passes: true, findings: [] } }))),
  yyyymmdd: (d: Date = new Date()) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
}));
vi.mock("./ai/optimizationProvider", () => ({ isMockProvider: (m: string) => m.startsWith("mock") }));
vi.mock("./draftManagement", () => ({ regenerateUnlockedDrafts: vi.fn() }));
vi.mock("./tags", () => ({ addTag: vi.fn(async () => {}) }));
vi.mock("./auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("../emailService", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("./warmupGate", () => ({ isWarmedUp: vi.fn() }));
vi.mock("./circuitBreaker", () => ({ checkCircuitBreakerConditions: vi.fn() }));
vi.mock("./autoMerge", () => ({ armHold: vi.fn() }));

import { getDb } from "../../db";
import { findLockedPages } from "../../seo/lockedPages";
import { isInPendingBatch, approveBatchToPR, buildBatchDiff } from "./bulkApprove";
import { regenerateUnlockedDrafts } from "./draftManagement";
import { isWarmedUp } from "./warmupGate";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { armHold } from "./autoMerge";
import { selectNightlyDraftCandidates, selectCleanDraftPickups, runNightlyDraftJob, MAX_NIGHTLY_DRAFTS, PINNED_PRIORITY_PATHS, pinIndex, type NightlyCandidatePage, type PickupCandidate } from "./nightlyDraftJob";
import { seoPages, seoAiDrafts, seoApprovalBatches } from "../../../drizzle/schema";

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

describe("selectCleanDraftPickups (backlog pickup)", () => {
  const ctx = { lockedPaths: new Set<string>(), pendingBatchPaths: new Set<string>(), excludePageIds: new Set<number>() };
  const cand = (o: Partial<PickupCandidate> & { pageId: number }): PickupCandidate => ({
    pagePath: `/p${o.pageId}`, impressions: 100, title: "A title", metaDescription: "A meta description", draftStatus: "draft", model: "anthropic-claude-sonnet-5", ...o,
  });

  it("ranks by impressions descending and does not cap (the caller lints, then caps)", () => {
    const cands = Array.from({ length: 30 }, (_, i) => cand({ pageId: i + 1, impressions: 20 + i }));
    const out = selectCleanDraftPickups(cands, ctx);
    expect(out).toHaveLength(30);
    expect(out[0].impressions).toBe(49);
    expect(out[29].impressions).toBe(20);
  });

  it.each([
    ["already approved (went to a PR, incl. a vetoed one)", { draftStatus: "approved" }],
    ["a mock draft", { model: "mock-v1" }],
    ["no title", { title: null }],
    ["blank title", { title: "  " }],
    ["no meta description", { metaDescription: null }],
    ["below the 20-impression floor", { impressions: 19 }],
  ])("excludes %s", (_label, over) => {
    expect(selectCleanDraftPickups([cand({ pageId: 1, ...over })], ctx)).toEqual([]);
  });

  it("includes an edited draft and a page at exactly 20 impressions", () => {
    expect(selectCleanDraftPickups([cand({ pageId: 1, draftStatus: "edited", impressions: 20 })], ctx)).toHaveLength(1);
  });

  it("excludes locked pages, pages in an open batch, and ids already chosen for this batch", () => {
    const out = selectCleanDraftPickups(
      [cand({ pageId: 1 }), cand({ pageId: 2 }), cand({ pageId: 3 }), cand({ pageId: 4 })],
      { lockedPaths: new Set(["/p1"]), pendingBatchPaths: new Set(["/p2"]), excludePageIds: new Set([3]) },
    );
    expect(out.map((c) => c.pageId)).toEqual([4]);
  });
});

describe("runNightlyDraftJob — backlog pickup", () => {
  const recent = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000); // inside the 14-day cooldown
  const pagesRows = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, page: `/p${i + 1}`, impressions: 1000 - i, position: 15, ctr: 0.02 }));
  const draftRow = (pageId: number, over: Record<string, unknown> = {}) => ({
    pageId, generatedTitle: `Title ${pageId}`, generatedMetaDescription: `Meta ${pageId}`, status: "draft", model: "anthropic-claude-sonnet-5", updatedAt: recent, ...over,
  });
  let draftRows: Array<ReturnType<typeof draftRow>>;
  let failLint: Set<number>;

  beforeEach(() => {
    draftRows = pagesRows.map((p) => draftRow(p.id));
    failLint = new Set();
    vi.mocked(getDb).mockReset().mockResolvedValue({
      select: () => ({ from: (t: unknown) => Promise.resolve(t === seoPages ? pagesRows : t === seoAiDrafts ? draftRows : []) }),
    } as never);
    vi.mocked(findLockedPages).mockReset().mockResolvedValue(new Map());
    vi.mocked(isInPendingBatch).mockReset().mockResolvedValue(false);
    vi.mocked(regenerateUnlockedDrafts).mockReset().mockResolvedValue({ results: [], skippedLocked: [] });
    vi.mocked(isWarmedUp).mockReset().mockResolvedValue(true);
    vi.mocked(checkCircuitBreakerConditions).mockReset().mockResolvedValue({ shouldPause: false, reason: null });
    vi.mocked(approveBatchToPR).mockReset().mockResolvedValue({ batch: { id: 55 } as never, prUrl: "url", prNumber: 1 });
    vi.mocked(buildBatchDiff).mockReset().mockImplementation((async (ids: number[]) => ids.map((id) => ({ pageId: id, lint: { passes: !failLint.has(id), findings: [] } }))) as never);
    vi.mocked(armHold).mockReset().mockResolvedValue(undefined);
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
  });

  it("ships existing clean drafts even when the cooldown leaves nothing to re-draft — top 20 by impressions, one batch, hold armed", async () => {
    const result = await runNightlyDraftJob(NOW);

    expect(regenerateUnlockedDrafts).not.toHaveBeenCalled();
    expect(result.ready).toBe(0);
    expect(result.autoApproved).toBe(true);
    expect(result.pickedUp).toBe(20);
    expect(result.batchId).toBe(55);
    const args = vi.mocked(approveBatchToPR).mock.calls[0][0];
    expect(args.pageIds).toEqual(Array.from({ length: 20 }, (_, i) => i + 1)); // pages 1..20 have the highest impressions
    expect(args.label).toBe("auto-20260926");
    expect(armHold).toHaveBeenCalledWith(55);
  });

  it("puts this run's fresh drafts first and fills only the remaining room from the backlog (never over 20)", async () => {
    draftRows = pagesRows.map((p) => draftRow(p.id, p.id <= 3 ? { updatedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000) } : {}));
    vi.mocked(regenerateUnlockedDrafts).mockResolvedValue({ results: [1, 2, 3].map((pageId) => ({ pageId, ok: true, draft: null })), skippedLocked: [] } as never);

    const result = await runNightlyDraftJob(NOW);

    const ids = vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds;
    expect(ids.slice(0, 3)).toEqual([1, 2, 3]);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20); // no page twice
    expect(result.ready).toBe(3);
    expect(result.pickedUp).toBe(17);
  });

  it("skips a backlog draft that now fails the diff-level lint and takes the next-ranked one instead", async () => {
    failLint = new Set([2, 5]);

    await runNightlyDraftJob(NOW);

    const ids = vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds;
    expect(ids).toHaveLength(20);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(5);
    expect(ids).toContain(21); // 1..20 minus {2,5} = 18, so 21 and 22 fill in
    expect(ids).toContain(22);
  });

  it("drops a FRESH draft that fails the diff-level lint rather than letting it sink the whole batch", async () => {
    draftRows = pagesRows.map((p) => draftRow(p.id, p.id === 1 ? { updatedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000) } : {}));
    vi.mocked(regenerateUnlockedDrafts).mockResolvedValue({ results: [{ pageId: 1, ok: true, draft: null }], skippedLocked: [] } as never);
    failLint = new Set([1]);

    await runNightlyDraftJob(NOW);

    const ids = vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds;
    expect(ids).not.toContain(1);
    expect(ids).toHaveLength(20);
  });

  it("never re-picks an approved draft (already shipped or vetoed), a mock draft, or a page in an open batch", async () => {
    draftRows = pagesRows.map((p) => draftRow(p.id, p.id === 1 ? { status: "approved" } : p.id === 2 ? { model: "mock-v1" } : {}));
    vi.mocked(isInPendingBatch).mockImplementation(async (path: string) => path === "/p3");

    await runNightlyDraftJob(NOW);

    const ids = vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds;
    for (const banned of [1, 2, 3]) expect(ids).not.toContain(banned);
    expect(ids).toHaveLength(20);
  });

  it("does not touch the backlog (no lint reads, no approve) when the lane is not warmed up", async () => {
    vi.mocked(isWarmedUp).mockResolvedValue(false);

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(false);
    expect(result.pickedUp).toBe(0);
    expect(buildBatchDiff).not.toHaveBeenCalled();
    expect(approveBatchToPR).not.toHaveBeenCalled();
  });

  it("does not touch the backlog when SEO_AUTOPUBLISH_ENABLED isn't \"true\"", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "false";

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(false);
    expect(approveBatchToPR).not.toHaveBeenCalled();
  });

  it("does not approve anything when every backlog draft fails lint", async () => {
    failLint = new Set(pagesRows.map((p) => p.id));

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(false);
    expect(approveBatchToPR).not.toHaveBeenCalled();
    expect(vi.mocked(buildBatchDiff).mock.calls.reduce((n, c) => n + c[0].length, 0)).toBeLessThanOrEqual(60); // bounded GitHub reads
  });

  it("degrades to staged (does not throw, pickedUp stays 0) when the approve call fails", async () => {
    vi.mocked(approveBatchToPR).mockRejectedValue(new Error("GitHub is down"));

    const result = await runNightlyDraftJob(NOW);

    expect(result.autoApproved).toBe(false);
    expect(result.pickedUp).toBe(0);
    expect(armHold).not.toHaveBeenCalled();
  });

  it("with a small backlog, takes just what exists", async () => {
    draftRows = pagesRows.slice(0, 4).map((p) => draftRow(p.id));

    const result = await runNightlyDraftJob(NOW);

    expect(vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds).toEqual([1, 2, 3, 4]);
    expect(result.pickedUp).toBe(4);
  });
});

describe("pinned priority pages (owner decision 2026-09-29)", () => {
  const ctx0 = { lockedPaths: new Set<string>(), pendingBatchPaths: new Set<string>(), now: NOW };

  it("lists exactly the nine positioning pages, in the owner's order", () => {
    expect([...PINNED_PRIORITY_PATHS]).toEqual([
      "/heat-pump-installation-nj", "/central-ac-installation-nj", "/ductless-mini-split-installation-nj", "/vrv-vrf-installation-nj",
      "/residential", "/commercial", "/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts",
    ]);
    expect(pinIndex("/warranty/")).toBe(6); // trailing slash tolerated
    expect(pinIndex("/blog/warranty")).toBe(-1);
  });

  it("selectNightlyDraftCandidates: a pinned page bypasses the impressions floor and ranks first, in list order, ahead of far-higher-impression pages", () => {
    const pages = [
      page({ pageId: 1, pagePath: "/hvac-newark-nj", impressions: 5000, position: 12 }),
      page({ pageId: 2, pagePath: "/central-ac-installation-nj", impressions: 9 }),
      page({ pageId: 3, pagePath: "/heat-pump-installation-nj", impressions: 4 }),
      page({ pageId: 4, pagePath: "/low-traffic-unpinned", impressions: 9 }),
    ];
    const result = selectNightlyDraftCandidates(pages, ctx0);
    expect(result.map((r) => r.pagePath)).toEqual(["/heat-pump-installation-nj", "/central-ac-installation-nj", "/hvac-newark-nj"]);
  });

  it("selectNightlyDraftCandidates: pinning does NOT bypass locks, open batches, or the 14-day cooldown", () => {
    const recent = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    const pages = [
      page({ pageId: 1, pagePath: "/warranty", impressions: 0 }),
      page({ pageId: 2, pagePath: "/commercial", impressions: 0 }),
      page({ pageId: 3, pagePath: "/residential", impressions: 0, draftUpdatedAt: recent }),
      page({ pageId: 4, pagePath: "/vrv-vrf-installation-nj", impressions: 0 }),
    ];
    const result = selectNightlyDraftCandidates(pages, { ...ctx0, lockedPaths: new Set(["/warranty"]), pendingBatchPaths: new Set(["/commercial"]) });
    expect(result.map((r) => r.pagePath)).toEqual(["/vrv-vrf-installation-nj"]);
  });

  it("selectNightlyDraftCandidates: pinned pages count toward the 20 cap", () => {
    const pages = [
      ...PINNED_PRIORITY_PATHS.map((path, i) => page({ pageId: 100 + i, pagePath: path, impressions: 0 })),
      ...Array.from({ length: 30 }, (_, i) => page({ pageId: i + 1, pagePath: `/p${i + 1}`, impressions: 500 + i })),
    ];
    const result = selectNightlyDraftCandidates(pages, ctx0);
    expect(result).toHaveLength(MAX_NIGHTLY_DRAFTS);
    expect(result.slice(0, 9).map((r) => r.pagePath)).toEqual([...PINNED_PRIORITY_PATHS]);
  });

  it("selectCleanDraftPickups: pinned pages bypass the floor and come first in list order; other exclusions still apply", () => {
    const base = { title: "T", metaDescription: "M", draftStatus: "draft", model: "anthropic-claude-sonnet-5" };
    const out = selectCleanDraftPickups(
      [
        { ...base, pageId: 1, pagePath: "/blog/big", impressions: 3000 },
        { ...base, pageId: 2, pagePath: "/central-ac-installation-nj", impressions: 9 },
        { ...base, pageId: 3, pagePath: "/heat-pump-installation-nj", impressions: 4 },
        { ...base, pageId: 4, pagePath: "/warranty", impressions: 0, draftStatus: "approved" }, // already shipped
        { ...base, pageId: 5, pagePath: "/commercial", impressions: 0, model: "mock-v1" }, // mock
        { ...base, pageId: 6, pagePath: "/residential", impressions: 0, title: null }, // no draft title
        { ...base, pageId: 7, pagePath: "/blog/tiny", impressions: 9 }, // unpinned, under the floor
      ],
      { lockedPaths: new Set(), pendingBatchPaths: new Set(), excludePageIds: new Set() },
    );
    expect(out.map((c) => c.pagePath)).toEqual(["/heat-pump-installation-nj", "/central-ac-installation-nj", "/blog/big"]);
  });
});

describe("runNightlyDraftJob — pinned pages lead every batch", () => {
  const recent = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
  const old = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
  const mk = (id: number, path: string, impressions: number) => ({ id, page: path, impressions, position: 15, ctr: 0.02 });
  const dr = (pageId: number, over: Record<string, unknown> = {}) => ({ pageId, generatedTitle: `T${pageId}`, generatedMetaDescription: `M${pageId}`, status: "draft", model: "anthropic-claude-sonnet-5", updatedAt: recent, ...over });

  beforeEach(() => {
    vi.mocked(findLockedPages).mockReset().mockResolvedValue(new Map());
    vi.mocked(isInPendingBatch).mockReset().mockResolvedValue(false);
    vi.mocked(isWarmedUp).mockReset().mockResolvedValue(true);
    vi.mocked(checkCircuitBreakerConditions).mockReset().mockResolvedValue({ shouldPause: false, reason: null });
    vi.mocked(approveBatchToPR).mockReset().mockResolvedValue({ batch: { id: 7 } as never, prUrl: "u", prNumber: 1 });
    vi.mocked(buildBatchDiff).mockReset().mockImplementation((async (ids: number[]) => ids.map((id) => ({ pageId: id, lint: { passes: true, findings: [] } }))) as never);
    vi.mocked(armHold).mockReset().mockResolvedValue(undefined);
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
  });

  it("batch order: pinned fresh, pinned backlog, other fresh, other backlog — pinned pages with 4-9 impressions included", async () => {
    const pagesRows = [mk(1, "/blog/top", 3000), mk(2, "/hvac-newark-nj", 900), mk(3, "/central-ac-installation-nj", 9), mk(4, "/heat-pump-installation-nj", 4), mk(5, "/warranty", 0), mk(6, "/blog/fresh-other", 800)];
    // 5 and 6 are out of cooldown -> re-drafted fresh; 1-4 are existing clean drafts (backlog).
    const draftRows = [dr(1), dr(2), dr(3), dr(4), dr(5, { updatedAt: old }), dr(6, { updatedAt: old })];
    vi.mocked(getDb).mockReset().mockResolvedValue({ select: () => ({ from: (t: unknown) => Promise.resolve(t === seoPages ? pagesRows : t === seoAiDrafts ? draftRows : []) }) } as never);
    vi.mocked(regenerateUnlockedDrafts).mockReset().mockResolvedValue({ results: [5, 6].map((pageId) => ({ pageId, ok: true, draft: null })), skippedLocked: [] } as never);

    await runNightlyDraftJob(NOW);

    // fresh pinned (/warranty=5) -> backlog pinned in list order (heat-pump=4, central-ac=3) -> other fresh (6) -> other backlog by impressions (1, 2)
    expect(vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds).toEqual([5, 4, 3, 6, 1, 2]);
  });

  it("a pinned page that now fails the diff-level lint is dropped, not forced", async () => {
    const pagesRows = [mk(1, "/heat-pump-installation-nj", 4), mk(2, "/central-ac-installation-nj", 9), mk(3, "/blog/x", 500)];
    const draftRows = [dr(1), dr(2), dr(3)];
    vi.mocked(getDb).mockReset().mockResolvedValue({ select: () => ({ from: (t: unknown) => Promise.resolve(t === seoPages ? pagesRows : t === seoAiDrafts ? draftRows : []) }) } as never);
    vi.mocked(regenerateUnlockedDrafts).mockReset().mockResolvedValue({ results: [], skippedLocked: [] });
    vi.mocked(buildBatchDiff).mockImplementation((async (ids: number[]) => ids.map((id) => ({ pageId: id, lint: { passes: id !== 1, findings: [] } }))) as never);

    await runNightlyDraftJob(NOW);

    expect(vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds).toEqual([2, 3]);
  });
});

describe("selectCleanDraftPickups — never-batched and no-op checks", () => {
  const cand = (o: Partial<PickupCandidate> & { pageId: number }): PickupCandidate => ({
    pagePath: `/p${o.pageId}`, impressions: 100, title: "New title", metaDescription: "New meta", draftStatus: "draft", model: "anthropic-claude-sonnet-5", ...o,
  });
  const base = { lockedPaths: new Set<string>(), pendingBatchPaths: new Set<string>(), excludePageIds: new Set<number>() };

  it("excludes pages that are in ANY batch (open, merged or reverted) via batchedPaths, not just open ones", () => {
    const out = selectCleanDraftPickups([cand({ pageId: 1 }), cand({ pageId: 2 }), cand({ pageId: 3 })], { ...base, batchedPaths: new Set(["/p1", "/p3"]) });
    expect(out.map((c) => c.pageId)).toEqual([2]);
  });

  it("batchedPaths is optional — callers that don't pass it behave exactly as before", () => {
    expect(selectCleanDraftPickups([cand({ pageId: 1 })], base)).toHaveLength(1);
  });

  it("skips a draft identical to the live title AND meta, ignoring surrounding whitespace", () => {
    const out = selectCleanDraftPickups(
      [cand({ pageId: 1, title: "Same", metaDescription: "Same meta", pageTitle: "  Same ", pageMeta: "Same meta\n" })],
      base,
    );
    expect(out).toEqual([]);
  });

  it("keeps a draft that changes only the title, or only the meta description", () => {
    const out = selectCleanDraftPickups(
      [
        cand({ pageId: 1, title: "New", metaDescription: "Same meta", pageTitle: "Old", pageMeta: "Same meta" }),
        cand({ pageId: 2, title: "Same", metaDescription: "New meta", pageTitle: "Same", pageMeta: "Old meta" }),
      ],
      base,
    );
    expect(out.map((c) => c.pageId)).toEqual([1, 2]);
  });

  it("keeps a draft for a page with NO live title/meta (null) — that's a real change, not a no-op", () => {
    expect(selectCleanDraftPickups([cand({ pageId: 1, pageTitle: null, pageMeta: null })], base)).toHaveLength(1);
  });

  it("does not run the no-op check when the live values weren't provided (undefined)", () => {
    expect(selectCleanDraftPickups([cand({ pageId: 1, title: "Same", metaDescription: "Same", pageTitle: undefined, pageMeta: undefined })], base)).toHaveLength(1);
    // one side missing is not enough to conclude "identical"
    expect(selectCleanDraftPickups([cand({ pageId: 2, title: "Same", metaDescription: "Same", pageTitle: "Same" })], base)).toHaveLength(1);
  });

  it("applies to pinned pages too (a pinned no-op or already-batched page is still skipped)", () => {
    const pinned = PINNED_PRIORITY_PATHS[0];
    const out = selectCleanDraftPickups(
      [cand({ pageId: 1, pagePath: pinned, impressions: 0, title: "Same", metaDescription: "Same", pageTitle: "Same", pageMeta: "Same" })],
      base,
    );
    expect(out).toEqual([]);
    expect(selectCleanDraftPickups([cand({ pageId: 2, pagePath: pinned, impressions: 0 })], { ...base, batchedPaths: new Set([pinned]) })).toEqual([]);
  });
});

describe("runNightlyDraftJob — backlog pickup skips batched pages and no-op drafts", () => {
  const recent = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000); // inside the 14-day cooldown: nothing is re-drafted
  const mkPage = (id: number, over: Record<string, unknown> = {}) => ({ id, page: `/p${id}`, impressions: 1000 - id, position: 15, ctr: 0.02, title: `Live title ${id}`, metaDescription: `Live meta ${id}`, ...over });
  const mkDraft = (pageId: number, over: Record<string, unknown> = {}) => ({ pageId, generatedTitle: `New title ${pageId}`, generatedMetaDescription: `New meta ${pageId}`, status: "draft", model: "anthropic-claude-sonnet-5", updatedAt: recent, ...over });
  let pagesRows: ReturnType<typeof mkPage>[];
  let draftRows: ReturnType<typeof mkDraft>[];
  let batchRows: Array<{ status: string; pages: string[] }>;

  beforeEach(() => {
    pagesRows = [1, 2, 3, 4, 5, 6].map((id) => mkPage(id));
    draftRows = pagesRows.map((p) => mkDraft(p.id));
    batchRows = [];
    vi.mocked(getDb).mockReset().mockResolvedValue({
      select: () => ({
        from: (t: unknown) => Promise.resolve(t === seoPages ? pagesRows : t === seoAiDrafts ? draftRows : t === seoApprovalBatches ? batchRows : []),
      }),
    } as never);
    vi.mocked(findLockedPages).mockReset().mockResolvedValue(new Map());
    vi.mocked(isInPendingBatch).mockReset().mockResolvedValue(false);
    vi.mocked(regenerateUnlockedDrafts).mockReset().mockResolvedValue({ results: [], skippedLocked: [] });
    vi.mocked(isWarmedUp).mockReset().mockResolvedValue(true);
    vi.mocked(checkCircuitBreakerConditions).mockReset().mockResolvedValue({ shouldPause: false, reason: null });
    vi.mocked(approveBatchToPR).mockReset().mockResolvedValue({ batch: { id: 77 } as never, prUrl: "url", prNumber: 1 });
    vi.mocked(buildBatchDiff).mockReset().mockImplementation((async (ids: number[]) => ids.map((id) => ({ pageId: id, lint: { passes: true, findings: [] } }))) as never);
    vi.mocked(armHold).mockReset().mockResolvedValue(undefined);
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
  });

  it("does not re-ship a page whose earlier batch MERGED or was REVERTED (the draft row stays 'draft', so status alone can't tell)", async () => {
    batchRows = [
      { status: "merged", pages: ["/p1", "/p2"] },
      { status: "reverted", pages: ["/p3"] },
    ];

    const result = await runNightlyDraftJob(NOW);

    expect(vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds).toEqual([4, 5, 6]);
    expect(result.pickedUp).toBe(3);
  });

  it("skips a draft that is identical to the live title and meta, but ships one that differs in either", async () => {
    draftRows = [
      mkDraft(1, { generatedTitle: "Live title 1", generatedMetaDescription: "Live meta 1" }), // pure no-op
      mkDraft(2, { generatedTitle: " Live title 2 ", generatedMetaDescription: "Live meta 2\n" }), // no-op modulo whitespace
      mkDraft(3, { generatedTitle: "Live title 3" }), // meta differs -> real change
      mkDraft(4, { generatedMetaDescription: "Live meta 4" }), // title differs -> real change
      mkDraft(5),
      mkDraft(6),
    ];

    await runNightlyDraftJob(NOW);

    expect(vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds).toEqual([3, 4, 5, 6]);
  });

  it("treats a page with no live title/meta (null in the DB) as a real change", async () => {
    pagesRows = [mkPage(1, { title: null, metaDescription: null })];
    draftRows = [mkDraft(1)];

    await runNightlyDraftJob(NOW);

    expect(vi.mocked(approveBatchToPR).mock.calls[0][0].pageIds).toEqual([1]);
  });

  it("opens NO PR when every candidate is batched or a no-op", async () => {
    batchRows = [{ status: "merged", pages: ["/p1", "/p2", "/p3"] }];
    draftRows = draftRows.map((d) => (d.pageId >= 4 ? { ...d, generatedTitle: `Live title ${d.pageId}`, generatedMetaDescription: `Live meta ${d.pageId}` } : d));

    const result = await runNightlyDraftJob(NOW);

    expect(approveBatchToPR).not.toHaveBeenCalled();
    expect(armHold).not.toHaveBeenCalled();
    expect(result).toMatchObject({ autoApproved: false, pickedUp: 0 });
  });
});
