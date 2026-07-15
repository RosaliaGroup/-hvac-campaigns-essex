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
  computeOpportunityScore,
  opportunityScoreComponents,
  expectedCtrForPosition,
  computeFunnel,
  computeBusinessImpact,
  projectClicksForPage,
  OPPORTUNITY_WEIGHTS,
  CRM_FUNNEL,
  type OpportunityScoreInput,
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

/* ══════════════════════════════════════════════════════════════════════════
 * AI SEO Optimization Engine — opportunity scoring, funnel & projection
 * ════════════════════════════════════════════════════════════════════════ */

/** Known-valid opportunity-score input; override one axis per test. */
function scoreInput(overrides: Partial<OpportunityScoreInput> = {}): OpportunityScoreInput {
  return { position: 12, ctr: 0.01, impressions: 1000, clicks: 10, category: "residential", ...overrides };
}

describe("computeOpportunityScore — striking-distance prioritisation", () => {
  it("scores positions 8–20 above already-winning, too-deep, and not-ranking pages", () => {
    // Everything held equal except position, so ranking-potential drives the gap.
    const strikingDistance = [8, 10, 12, 15, 20].map((position) =>
      computeOpportunityScore(scoreInput({ position })),
    );
    const alreadyWinning = computeOpportunityScore(scoreInput({ position: 2 })); // page-1 top
    const tooDeep = computeOpportunityScore(scoreInput({ position: 45 }));       // page 5+
    const notRanking = computeOpportunityScore(scoreInput({ position: 0 }));     // unknown/none

    for (const score of strikingDistance) {
      expect(score).toBeGreaterThan(alreadyWinning);
      expect(score).toBeGreaterThan(tooDeep);
      expect(score).toBeGreaterThan(notRanking);
    }
  });

  it("gives the striking-distance band the maximum ranking-potential sub-score", () => {
    expect(opportunityScoreComponents(scoreInput({ position: 12 })).rankingPotential).toBe(1);
    // Just outside the band on either side is strictly lower.
    expect(opportunityScoreComponents(scoreInput({ position: 5 })).rankingPotential).toBeLessThan(1);
    expect(opportunityScoreComponents(scoreInput({ position: 30 })).rankingPotential).toBeLessThan(1);
  });
});

describe("computeOpportunityScore — low CTR + high impressions", () => {
  it("raises the score when impressions rise", () => {
    const low = computeOpportunityScore(scoreInput({ impressions: 200 }));
    const high = computeOpportunityScore(scoreInput({ impressions: 20_000 }));
    expect(high).toBeGreaterThan(low);
  });

  it("raises the score as CTR falls below the expected-for-position rate", () => {
    const healthyCtr = computeOpportunityScore(scoreInput({ ctr: 0.02 }));
    const starvedCtr = computeOpportunityScore(scoreInput({ ctr: 0.001 }));
    expect(starvedCtr).toBeGreaterThan(healthyCtr);
  });

  it("combines high impressions + low CTR into a materially higher score", () => {
    const baseline = computeOpportunityScore(scoreInput({ impressions: 200, ctr: 0.02 }));
    const opportunity = computeOpportunityScore(scoreInput({ impressions: 20_000, ctr: 0.001 }));
    expect(opportunity).toBeGreaterThan(baseline);
  });
});

describe("computeOpportunityScore — category (commercial/service-page) priority", () => {
  it("ranks commercial > city_page > residential > blog for identical signals", () => {
    const commercial = computeOpportunityScore(scoreInput({ category: "commercial" }));
    const cityPage = computeOpportunityScore(scoreInput({ category: "city_page" }));
    const residential = computeOpportunityScore(scoreInput({ category: "residential" }));
    const blog = computeOpportunityScore(scoreInput({ category: "blog" }));
    expect(commercial).toBeGreaterThan(cityPage);
    expect(cityPage).toBeGreaterThan(residential);
    expect(residential).toBeGreaterThan(blog);
  });
});

describe("computeFunnel — business impact math", () => {
  it("rolls clicks down the CRM funnel to a revenue estimate", () => {
    // 1000 clicks → 3% leads → 45% appts → 70% estimates → 35% won → $9k each.
    expect(computeFunnel(1000)).toEqual({
      clicks: 1000,
      leads: 30,
      appointments: 14, // 13.5 rounded
      estimates: 9,     // 9.45 rounded
      revenue: 29767,   // 3.3075 jobs × $9,000, rounded (float lands at 29767.4999…)
    });
  });

  it("scales linearly with click volume", () => {
    expect(computeFunnel(2000).leads).toBe(2 * computeFunnel(1000).leads);
  });

  it("business impact reports the delta and never regresses below current", () => {
    const growth = computeBusinessImpact(100, 300);
    expect(growth.projected.revenue).toBeGreaterThan(growth.current.revenue);
    expect(growth.deltaRevenue).toBe(growth.projected.revenue - growth.current.revenue);

    // A projection weaker than today is floored at today — no negative delta.
    const noRegression = computeBusinessImpact(500, 100);
    expect(noRegression.projected).toEqual(noRegression.current);
    expect(noRegression.deltaRevenue).toBe(0);
  });
});

describe("projectClicksForPage — never below current clicks", () => {
  it("floors the projection at the page's current clicks", () => {
    // Over-performing page (CTR already above expected) captures nothing.
    expect(
      projectClicksForPage({ clicks: 50, impressions: 1000, position: 12, ctr: 0.9, opportunityScore: 80 }),
    ).toBe(50);

    // Under-performing striking-distance page gains, but is still ≥ current.
    const projected = projectClicksForPage({
      clicks: 10, impressions: 5000, position: 15, ctr: 0.001, opportunityScore: 100,
    });
    expect(projected).toBeGreaterThan(10);
  });

  it("never returns fewer than current clicks across a range of inputs", () => {
    for (const position of [0, 1, 8, 15, 20, 45, 100]) {
      for (const ctr of [0, 0.001, 0.03, 0.5]) {
        const clicks = 25;
        const result = projectClicksForPage({ clicks, impressions: 3000, position, ctr, opportunityScore: 60 });
        expect(result).toBeGreaterThanOrEqual(clicks);
      }
    }
  });
});

describe("scoring & funnel — zero / negative / edge inputs", () => {
  it("returns a finite integer score in [0,100] for degenerate inputs", () => {
    const cases: OpportunityScoreInput[] = [
      scoreInput({ impressions: 0, clicks: 0, ctr: 0 }),
      scoreInput({ position: -5 }),
      scoreInput({ position: 100000 }),
      scoreInput({ ctr: Number.NaN }),
      scoreInput({ impressions: Number.NaN }),
    ];
    for (const c of cases) {
      const score = computeOpportunityScore(c);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("clamps negative click volume to a zero funnel", () => {
    expect(computeFunnel(-100)).toEqual({ clicks: 0, leads: 0, appointments: 0, estimates: 0, revenue: 0 });
    expect(computeFunnel(0).revenue).toBe(0);
  });

  it("keeps the CTR curve bounded and monotonically decreasing by position", () => {
    expect(expectedCtrForPosition(1)).toBeGreaterThan(expectedCtrForPosition(10));
    expect(expectedCtrForPosition(10)).toBeGreaterThan(expectedCtrForPosition(50));
    for (const p of [-1, 0, 1, 8, 20, 100]) {
      const ctr = expectedCtrForPosition(p);
      expect(ctr).toBeGreaterThan(0);
      expect(ctr).toBeLessThanOrEqual(1);
    }
  });
});

describe("hardcoded assumptions are explicit estimates (pinned)", () => {
  it("keeps opportunity weights normalised to 1.0", () => {
    const sum = Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("pins the placeholder CRM funnel rates so any change is deliberate", () => {
    // These are ESTIMATES until live CRM attribution lands — pinned, not derived.
    expect(CRM_FUNNEL).toEqual({
      clickToLead: 0.03,
      leadToAppointment: 0.45,
      appointmentToEstimate: 0.7,
      estimateToWon: 0.35,
      avgJobValue: 9000,
    });
  });

  it("surfaces the assumptions used inside the business-impact result", () => {
    // The UI reads `.conversions` to label projected revenue as an estimate.
    expect(computeBusinessImpact(100, 300).conversions).toEqual(CRM_FUNNEL);
  });
});
