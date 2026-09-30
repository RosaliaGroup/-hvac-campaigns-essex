import { describe, it, expect } from "vitest";
import {
  classifyRisingQueries,
  classifyUnservedQueries,
  classifyDecayingPages,
  classifyCannibalization,
  classifySeasonality,
  townServiceMatch,
  COMPETITOR_BRAND_TERMS,
} from "./searchDemand";
import { COMPETITOR_WATCHLIST } from "../../../../shared/competitorWatchlist";
import type { QueryDemandPoint } from "../../../../shared/marketIntelTypes";

function q(overrides: Partial<QueryDemandPoint> & { query: string }): QueryDemandPoint {
  return { page: "/heat-pump-installation-nj", clicks: 5, impressions: 100, ctr: 0.05, position: 8, ...overrides };
}

describe("classifyRisingQueries (§3a bullet 1 acceptance)", () => {
  it("flags a query with >=20 impressions and >=40% WoW growth", () => {
    const result = classifyRisingQueries({
      current: [q({ query: "heat pump installation nj", impressions: 100 })],
      priorWeekImpressions: new Map([["heat pump installation nj", 70]]), // +42.8%
      seenInPriorMonth: new Set(["heat pump installation nj"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].impressionsPctChange).toBeCloseTo(0.4286, 3);
  });

  it("does not flag growth under the +40% threshold", () => {
    const result = classifyRisingQueries({
      current: [q({ query: "heat pump installation nj", impressions: 100 })],
      priorWeekImpressions: new Map([["heat pump installation nj", 80]]), // +25%
      seenInPriorMonth: new Set(["heat pump installation nj"]),
    });
    expect(result).toEqual([]);
  });

  it("does not flag a query under 20 impressions even with huge WoW growth", () => {
    const result = classifyRisingQueries({
      current: [q({ query: "niche query", impressions: 19 })],
      priorWeekImpressions: new Map([["niche query", 1]]),
      seenInPriorMonth: new Set(["niche query"]),
    });
    expect(result).toEqual([]);
  });

  it("flags a brand-new query (not seen in the prior month) with >=10 impressions", () => {
    const result = classifyRisingQueries({
      current: [q({ query: "on-bill repayment hvac nj", impressions: 10 })],
      priorWeekImpressions: new Map(),
      seenInPriorMonth: new Set(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].isNew).toBe(true);
    expect(result[0].impressionsPctChange).toBeNull();
  });

  it("does not flag a new query under 10 impressions", () => {
    const result = classifyRisingQueries({
      current: [q({ query: "obscure query", impressions: 9 })],
      priorWeekImpressions: new Map(),
      seenInPriorMonth: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("skips a non-new query with no prior-week snapshot (insufficient data, not a false rise)", () => {
    const result = classifyRisingQueries({
      current: [q({ query: "gap query", impressions: 100 })],
      priorWeekImpressions: new Map(),
      seenInPriorMonth: new Set(["gap query"]),
    });
    expect(result).toEqual([]);
  });
});

describe("classifyUnservedQueries (§3a bullet 2, calibrated 2026-09)", () => {
  const NO_PAGE = { page: null, position: 45 } as const;

  it("flags a query with no landing page at all", () => {
    const result = classifyUnservedQueries([q({ query: "x", ...NO_PAGE })]);
    expect(result).toEqual([{ query: "x", page: null, position: 45, impressions: 100, reason: "no_page" }]);
  });

  it("requires >=20 impressions", () => {
    expect(classifyUnservedQueries([q({ query: "x", ...NO_PAGE, impressions: 19 })])).toEqual([]);
    expect(classifyUnservedQueries([q({ query: "x", ...NO_PAGE, impressions: 20 })])).toHaveLength(1);
    expect(classifyUnservedQueries([q({ query: "y", position: 45, impressions: 19 })])).toEqual([]);
  });

  it("flags a query whose best page ranks worse than position 30, and not one at exactly 30", () => {
    const worse = classifyUnservedQueries([q({ query: "x", position: 31 })]);
    expect(worse[0].reason).toBe("position_over_30");
    expect(classifyUnservedQueries([q({ query: "x", position: 30 })])).toEqual([]);
    expect(classifyUnservedQueries([q({ query: "x", position: 21 })])).toEqual([]); // used to be flagged at >20
  });

  it("excludes a query the site ranks top-30 for even when GSC gave no page attribution (own-brand, pseg rebate cases seen in prod)", () => {
    for (const [query, position] of [["mechanical enterprise", 4], ["pseg heat pump rebate", 12], ["air conditioning installation cost in nj", 29]] as const) {
      expect(classifyUnservedQueries([q({ query, page: null, position })]), query).toEqual([]);
    }
    expect(classifyUnservedQueries([q({ query: "x", page: null, position: 31 })])).toHaveLength(1);
  });

  it("excludes a query when ANY of our pages ranks <=30, even if another page ranks far worse", () => {
    const result = classifyUnservedQueries([q({ query: "x", page: "/a", position: 45 }), q({ query: "x", page: "/b", position: 12 })]);
    expect(result).toEqual([]);
  });

  it("when no page ranks <=30, reports the best-ranked page and sums impressions across pages", () => {
    const result = classifyUnservedQueries([q({ query: "x", page: "/a", position: 45, impressions: 12 }), q({ query: "x", page: "/b", position: 38, impressions: 15 })]);
    expect(result).toEqual([{ query: "x", page: "/b", position: 38, impressions: 27, reason: "position_over_30" }]);
  });

  it('excludes "near me" queries', () => {
    for (const query of ["hvac near me", "ac repair near-me", "emergency furnace repair Near Me open now"]) {
      expect(classifyUnservedQueries([q({ query, ...NO_PAGE })])).toEqual([]);
    }
  });

  it("excludes competitor brand queries (watchlist + aliases), matching whole phrases only", () => {
    for (const query of ["gold medal hvac reviews", "a.j. perri hvac", "aj perri", "Reiner Group careers", "springfield heating and ac", "air 2 cool nj", "echelon services jobs"]) {
      expect(classifyUnservedQueries([q({ query, ...NO_PAGE })]), query).toEqual([]);
    }
    // Springfield the TOWN is not the brand "Springfield Heating"
    expect(classifyUnservedQueries([q({ query: "springfield nj heat pump cost", ...NO_PAGE })])).toHaveLength(1);
  });

  it("accepts an explicit competitor brand list", () => {
    expect(classifyUnservedQueries([q({ query: "acme hvac", ...NO_PAGE })], { competitorBrands: ["acme hvac"] })).toEqual([]);
  });

  it("every watchlist competitor has at least one brand term (guards watchlist drift)", () => {
    for (const c of COMPETITOR_WATCHLIST) expect(COMPETITOR_BRAND_TERMS[c.name]?.length, c.name).toBeGreaterThan(0);
  });

  it("no longer flags an intent-mismatch query that already ranks <=30 (it is 'served' by the rule)", () => {
    expect(classifyUnservedQueries([q({ query: "commercial HVAC contractor NJ", position: 5, page: "/hvac-newark-nj" })])).toEqual([]);
  });

  describe("{service} {town} clustering onto the city page", () => {
    const cluster = (over: Partial<QueryDemandPoint> & { query: string }) => q({ position: 45, impressions: 10, page: "/somewhere", ...over });
    it("a cluster member with no page attribution but position <=30 is dropped too", () => {
      const r = classifyUnservedQueries([cluster({ query: "ac replacement short hills", page: null, position: 17, impressions: 27 }), cluster({ query: "hvac short hills", impressions: 12 }), cluster({ query: "furnace short hills", impressions: 10 })], { cityPages: ["/hvac-short-hills-nj"] });
      expect(r).toHaveLength(1);
      expect(r[0].impressions).toBe(22);
      expect(r[0].clusterQueries).not.toContain("ac replacement short hills");
    });

    const newark = [cluster({ query: "hvac newark" }), cluster({ query: "ac repair newark nj" }), cluster({ query: "furnace installation newark" })];

    it("rolls several phrasings into ONE finding on the matching city page, summing impressions", () => {
      const result = classifyUnservedQueries(newark, { cityPages: ["/hvac-newark-nj", "/x"] });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ page: "/hvac-newark-nj", impressions: 30, reason: "position_over_30", clusterTown: "Newark" });
      expect(result[0].clusterQueries).toHaveLength(3);
    });

    it("the ≥20 floor applies to the cluster total, so long-tail phrasings can add up", () => {
      expect(classifyUnservedQueries(newark.slice(0, 1), { cityPages: ["/hvac-newark-nj"] })).toEqual([]); // 10 alone
      expect(classifyUnservedQueries(newark.slice(0, 2), { cityPages: ["/hvac-newark-nj"] })).toHaveLength(1); // 20 together
    });

    it("no city page for that town → one no_page finding for the town", () => {
      const result = classifyUnservedQueries(newark, { cityPages: ["/hvac-paterson-nj"] });
      expect(result[0]).toMatchObject({ page: null, reason: "no_page", clusterTown: "Newark" });
    });

    it("members that already rank <=30, or are near-me/brand, never join the cluster", () => {
      const result = classifyUnservedQueries(
        [...newark, cluster({ query: "hvac contractor newark nj", page: "/hvac-newark-nj", position: 8, impressions: 500 }), cluster({ query: "hvac newark near me", impressions: 500 })],
        { cityPages: ["/hvac-newark-nj"] },
      );
      expect(result).toHaveLength(1);
      expect(result[0].impressions).toBe(30);
      expect(result[0].clusterQueries).not.toContain("hvac contractor newark nj");
    });

    it("prefers the longest town name (West Orange, not Orange)", () => {
      expect(townServiceMatch("hvac west orange nj")).toMatchObject({ city: "West Orange", slug: "west-orange" });
      expect(townServiceMatch("hvac orange nj")).toMatchObject({ city: "Orange" });
    });

    it("needs BOTH a service word and a known town; other queries stay individual", () => {
      expect(townServiceMatch("newark weather")).toBeNull();
      expect(townServiceMatch("heat pump cost nj")).toBeNull();
      const result = classifyUnservedQueries([q({ query: "heat pump cost nj", ...NO_PAGE, impressions: 40 })]);
      expect(result[0].clusterTown).toBeUndefined();
    });
  });
});

describe("classifyDecayingPages (§3a bullet 3, calibrated 2026-09)", () => {
  it("flags a page with >=10 prior clicks and clicks down >=25%", () => {
    const result = classifyDecayingPages([{ page: "/warranty", clicks: 30, previousClicks: 40, previousImpressions: 500 }]); // -25%
    expect(result).toHaveLength(1);
    expect(result[0].pctDown).toBeCloseTo(0.25, 5);
    expect(classifyDecayingPages([{ page: "/p", clicks: 9, previousClicks: 12, previousImpressions: 0 }])).toHaveLength(1); // exactly -25%
    expect(classifyDecayingPages([{ page: "/p", clicks: 7, previousClicks: 10, previousImpressions: 0 }])).toHaveLength(1); // exactly 10 prior
  });

  it("does not flag a page down less than 25%", () => {
    expect(classifyDecayingPages([{ page: "/warranty", clicks: 31, previousClicks: 40, previousImpressions: 500 }])).toEqual([]); // -22.5%
  });

  it("does not flag a page with fewer than 10 prior clicks, however far it fell", () => {
    expect(classifyDecayingPages([{ page: "/p", clicks: 0, previousClicks: 9, previousImpressions: 5000 }])).toEqual([]);
  });

  it("impressions alone never qualify", () => {
    expect(classifyDecayingPages([{ page: "/p", clicks: 0, previousClicks: 0, previousImpressions: 100000 }])).toEqual([]);
    expect(classifyDecayingPages([{ page: "/p", clicks: 1, previousClicks: 7, previousImpressions: 100000 }])).toEqual([]);
  });

  it("the four real 2026-09 decays: three qualify; hvac-contractor-newark-nj (7 prior clicks) does not", () => {
    const real = [
      { page: "/blog/heat-pump-vs-gas-furnace-nj-2026", clicks: 1, previousClicks: 28, previousImpressions: 2719 },
      { page: "/blog/nj-heat-pump-rebates-2026", clicks: 1, previousClicks: 23, previousImpressions: 3490 },
      { page: "/blog/nj-hvac-rebates-2026-complete-guide", clicks: 2, previousClicks: 12, previousImpressions: 1248 },
      { page: "/blog/hvac-contractor-newark-nj", clicks: 1, previousClicks: 7, previousImpressions: 1552 },
    ];
    expect(classifyDecayingPages(real).map((f) => f.page)).toEqual(real.slice(0, 3).map((r) => r.page));
  });
});

describe("classifyCannibalization (§3a bullet 4 acceptance)", () => {
  it("flags a query with two distinct top pages in the history window", () => {
    const history = new Map([["heat pump installation nj", new Set(["/heat-pump-installation-nj", "/hvac-newark-nj"])]]);
    const result = classifyCannibalization(history);
    expect(result).toEqual([{ query: "heat pump installation nj", pages: ["/heat-pump-installation-nj", "/hvac-newark-nj"] }]);
  });

  it("does not flag a query with a single stable top page", () => {
    const history = new Map([["heat pump installation nj", new Set(["/heat-pump-installation-nj"])]]);
    expect(classifyCannibalization(history)).toEqual([]);
  });
});

describe("classifySeasonality", () => {
  it("flags a query whose interest jumps >=30% next month", () => {
    const now = new Date("2026-09-15T00:00:00Z"); // September (month idx 8) -> checks October (idx 9)
    const monthlyInterest = new Array(12).fill(50);
    monthlyInterest[9] = 80; // October +60%
    const result = classifySeasonality([{ query: "heat pump installation nj", monthlyInterest }], now);
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe(10);
  });

  it("does not flag a flat series", () => {
    const now = new Date("2026-09-15T00:00:00Z");
    const monthlyInterest = new Array(12).fill(50);
    const result = classifySeasonality([{ query: "flat query", monthlyInterest }], now);
    expect(result).toEqual([]);
  });
});
