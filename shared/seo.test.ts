import { describe, it, expect } from "vitest";
import {
  computeSeoScore,
  seoScoreBand,
  applyActionToProblems,
  actionToStatus,
  applySeoFilters,
  hydrateOpportunity,
  isNotIndexed,
  computePriority,
  isDeclining,
  deriveCategory,
  deriveProblems,
  summarizeIssue,
  type SeoOpportunity,
  type SeoOpportunitySeed,
  type SeoPageSignals,
} from "./seo";

/* A small factory so each test starts from a known, valid row. */
function seed(overrides: Partial<SeoOpportunitySeed> = {}): SeoOpportunitySeed {
  return {
    id: "x",
    priority: "medium",
    page: "/p",
    url: "https://example.com/p",
    title: "t",
    metaDescription: "m",
    h1: "h",
    issue: "i",
    searchConsoleIssue: "s",
    clicks: 10,
    impressions: 1000,
    ctr: 0.01,
    position: 8,
    indexStatus: "indexed",
    lastIndexedAt: null,
    status: "needs_review",
    category: "residential",
    problems: [],
    ...overrides,
  };
}

function opp(overrides: Partial<SeoOpportunity> = {}): SeoOpportunity {
  return hydrateOpportunity(seed(overrides as Partial<SeoOpportunitySeed>));
}

describe("computeSeoScore", () => {
  it("is 100 for a page with no problems", () => {
    expect(computeSeoScore([])).toBe(100);
  });

  it("subtracts weighted penalties per problem", () => {
    // thin_content (16) + weak_title (11) = 27 → 73
    expect(computeSeoScore(["thin_content", "weak_title"])).toBe(73);
  });

  it("never drops below the floor of 24", () => {
    const all = computeSeoScore([
      "thin_content", "missing_faq", "weak_title", "weak_meta",
      "no_schema", "weak_internal_links", "slow_lcp", "cannibalization",
    ]);
    expect(all).toBe(24);
  });

  it("bands scores as good / fair / poor", () => {
    expect(seoScoreBand(80)).toBe("good");
    expect(seoScoreBand(60)).toBe("fair");
    expect(seoScoreBand(40)).toBe("poor");
  });
});

describe("hydrateOpportunity", () => {
  it("derives seoScore from problems", () => {
    expect(hydrateOpportunity(seed({ problems: [] })).seoScore).toBe(100);
    expect(hydrateOpportunity(seed({ problems: ["weak_title"] })).seoScore).toBe(89);
  });
});

describe("applyActionToProblems", () => {
  it("clears the single problem a content action targets", () => {
    expect(applyActionToProblems(["weak_title", "thin_content"], "rewrite_title")).toEqual(["thin_content"]);
    expect(applyActionToProblems(["thin_content"], "expand_content")).toEqual([]);
    expect(applyActionToProblems(["missing_faq"], "generate_faq")).toEqual([]);
    expect(applyActionToProblems(["no_schema"], "generate_schema")).toEqual([]);
    expect(applyActionToProblems(["weak_internal_links"], "add_internal_links")).toEqual([]);
    expect(applyActionToProblems(["weak_meta"], "rewrite_meta")).toEqual([]);
  });

  it("clears everything on optimize_everything", () => {
    expect(applyActionToProblems(["thin_content", "no_schema", "weak_title"], "optimize_everything")).toEqual([]);
  });

  it("leaves problems untouched on request_reindex", () => {
    expect(applyActionToProblems(["thin_content"], "request_reindex")).toEqual(["thin_content"]);
  });

  it("is a no-op when the targeted problem is absent", () => {
    expect(applyActionToProblems(["thin_content"], "rewrite_title")).toEqual(["thin_content"]);
  });
});

describe("actionToStatus", () => {
  it("sends reindex requests to waiting_for_indexing", () => {
    expect(actionToStatus("request_reindex")).toBe("waiting_for_indexing");
  });

  it("sends every content action to optimizing", () => {
    expect(actionToStatus("rewrite_title")).toBe("optimizing");
    expect(actionToStatus("optimize_everything")).toBe("optimizing");
  });
});

describe("isNotIndexed", () => {
  it("is false only for a fully indexed page", () => {
    expect(isNotIndexed("indexed")).toBe(false);
    expect(isNotIndexed("crawled_not_indexed")).toBe(true);
    expect(isNotIndexed("discovered_not_indexed")).toBe(true);
    expect(isNotIndexed("excluded")).toBe(true);
  });
});

describe("applySeoFilters", () => {
  const rows = [
    opp({ id: "a", priority: "high", category: "commercial", indexStatus: "indexed", ctr: 0.005, position: 12 }),
    opp({ id: "b", priority: "low", category: "residential", indexStatus: "crawled_not_indexed", ctr: 0.05, position: 4 }),
    opp({ id: "c", priority: "high", category: "blog", indexStatus: "indexed", ctr: 0.02, position: 18 }),
    opp({ id: "d", priority: "medium", category: "city_page", indexStatus: "indexed", ctr: 0.008, position: 30 }),
  ];
  const ids = (rs: SeoOpportunity[]) => rs.map((r) => r.id).sort();

  it("returns everything when no filter is active", () => {
    expect(applySeoFilters(rows, [])).toHaveLength(4);
  });

  it("ANDs attribute filters together", () => {
    // high priority AND page 2 (11–20) → a (12) and c (18); not d (30)
    expect(ids(applySeoFilters(rows, ["high_priority", "page_2"]))).toEqual(["a", "c"]);
  });

  it("matches low CTR (<1%) only when there are impressions", () => {
    expect(ids(applySeoFilters(rows, ["low_ctr"]))).toEqual(["a", "d"]);
  });

  it("matches not-indexed pages", () => {
    expect(ids(applySeoFilters(rows, ["not_indexed"]))).toEqual(["b"]);
  });

  it("ORs category filters within their group", () => {
    expect(ids(applySeoFilters(rows, ["commercial", "blog"]))).toEqual(["a", "c"]);
  });

  it("ANDs the attribute group with the category group", () => {
    // high priority AND (commercial OR blog) → a, c
    expect(ids(applySeoFilters(rows, ["high_priority", "commercial", "blog"]))).toEqual(["a", "c"]);
  });
});

/* ── Phase 3: derivation from Search Console signals ─────────────────────── */

function signals(o: Partial<SeoPageSignals> = {}): SeoPageSignals {
  return { position: 5, ctr: 0.05, impressions: 1000, clicks: 50, previousClicks: 50, indexStatus: "indexed", ...o };
}

describe("computePriority (Phase 3 rules)", () => {
  it("HIGH for a page ranking 8–20", () => {
    expect(computePriority(signals({ position: 8 }))).toBe("high");
    expect(computePriority(signals({ position: 20 }))).toBe("high");
  });

  it("HIGH for CTR < 1% (only with impressions)", () => {
    expect(computePriority(signals({ position: 3, ctr: 0.004, impressions: 5000 }))).toBe("high");
    // no impressions → the CTR rule must not fire
    expect(computePriority(signals({ position: 3, ctr: 0, impressions: 0 }))).not.toBe("high");
  });

  it("HIGH for crawled-but-not-indexed regardless of position", () => {
    expect(computePriority(signals({ position: 2, indexStatus: "crawled_not_indexed" }))).toBe("high");
  });

  it("MEDIUM for position 21–40", () => {
    expect(computePriority(signals({ position: 21 }))).toBe("medium");
    expect(computePriority(signals({ position: 40 }))).toBe("medium");
  });

  it("MEDIUM for declining clicks", () => {
    expect(computePriority(signals({ position: 3, clicks: 10, previousClicks: 100 }))).toBe("medium");
  });

  it("LOW otherwise", () => {
    expect(computePriority(signals({ position: 3, ctr: 0.08, clicks: 60, previousClicks: 50 }))).toBe("low");
  });
});

describe("isDeclining", () => {
  it("needs a real previous baseline and a >20% drop", () => {
    expect(isDeclining({ clicks: 10, previousClicks: 100 })).toBe(true);
    expect(isDeclining({ clicks: 90, previousClicks: 100 })).toBe(false);
    expect(isDeclining({ clicks: 0, previousClicks: 0 })).toBe(false);
  });
});

describe("deriveCategory", () => {
  it("classifies by path", () => {
    expect(deriveCategory("/blog/nj-heat-pump-rebates-2026")).toBe("blog");
    expect(deriveCategory("/hvac-newark-nj")).toBe("city_page");
    expect(deriveCategory("/commercial")).toBe("commercial");
    expect(deriveCategory("/lp/commercial-vrv")).toBe("commercial");
    expect(deriveCategory("/services/heat-pump-installation")).toBe("residential");
    expect(deriveCategory("/maintenance")).toBe("residential");
    expect(deriveCategory("/about")).toBe("other");
  });
});

describe("deriveProblems", () => {
  it("flags thin content for not-indexed pages", () => {
    expect(deriveProblems(signals({ indexStatus: "crawled_not_indexed", impressions: 0, ctr: 0 }))).toContain("thin_content");
  });

  it("flags weak title & meta for low CTR", () => {
    const p = deriveProblems(signals({ position: 5, ctr: 0.003, impressions: 4000 }));
    expect(p).toEqual(expect.arrayContaining(["weak_title", "weak_meta"]));
  });

  it("is deduped", () => {
    const p = deriveProblems(signals({ position: 25, indexStatus: "excluded", impressions: 0 }));
    expect(p.filter((x) => x === "thin_content")).toHaveLength(1);
  });
});

describe("summarizeIssue", () => {
  it("leads with the most actionable signal", () => {
    expect(summarizeIssue(signals({ indexStatus: "crawled_not_indexed" }))).toMatch(/not indexed/i);
    expect(summarizeIssue(signals({ position: 11 }))).toMatch(/page 1/i);
    expect(summarizeIssue(signals({ position: 3, ctr: 0.004, impressions: 5000 }))).toMatch(/low CTR/i);
  });
});
