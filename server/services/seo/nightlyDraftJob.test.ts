import { describe, it, expect } from "vitest";
import { selectNightlyDraftCandidates, MAX_NIGHTLY_DRAFTS, type NightlyCandidatePage } from "./nightlyDraftJob";

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
