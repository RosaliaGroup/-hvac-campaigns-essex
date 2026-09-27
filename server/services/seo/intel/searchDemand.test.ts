import { describe, it, expect } from "vitest";
import {
  classifyRisingQueries,
  classifyUnservedQueries,
  classifyDecayingPages,
  classifyCannibalization,
  classifySeasonality,
} from "./searchDemand";
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

describe("classifyUnservedQueries (§3a bullet 2 acceptance)", () => {
  it("flags a query with no landing page at all", () => {
    const result = classifyUnservedQueries([q({ query: "x", page: null })]);
    expect(result).toEqual([{ query: "x", page: null, position: 8, impressions: 100, reason: "no_page" }]);
  });

  it("flags a query whose best page ranks worse than position 20", () => {
    const result = classifyUnservedQueries([q({ query: "x", position: 21 })]);
    expect(result[0].reason).toBe("position_over_20");
  });

  it("does not flag a query at exactly position 20", () => {
    const result = classifyUnservedQueries([q({ query: "x", position: 20 })]);
    expect(result).toEqual([]);
  });

  it("flags a commercial-intent query landing on a residential city page", () => {
    const result = classifyUnservedQueries([q({ query: "commercial HVAC contractor NJ", position: 5, page: "/hvac-newark-nj" })]);
    expect(result[0].reason).toBe("intent_mismatch");
  });

  it("does not flag a commercial-intent query landing on the commercial page", () => {
    const result = classifyUnservedQueries([q({ query: "commercial HVAC contractor NJ", position: 5, page: "/commercial" })]);
    expect(result).toEqual([]);
  });

  it("does not flag a residential-intent query on a residential page", () => {
    const result = classifyUnservedQueries([q({ query: "heat pump installation nj", position: 5, page: "/hvac-newark-nj" })]);
    expect(result).toEqual([]);
  });
});

describe("classifyDecayingPages (§3a bullet 3 acceptance)", () => {
  it("flags a page down >=25% clicks", () => {
    const result = classifyDecayingPages([{ page: "/warranty", clicks: 30, previousClicks: 40, previousImpressions: 500 }]); // -25%
    expect(result).toHaveLength(1);
    expect(result[0].pctDown).toBeCloseTo(0.25, 5);
  });

  it("does not flag a page down less than 25%", () => {
    const result = classifyDecayingPages([{ page: "/warranty", clicks: 31, previousClicks: 40, previousImpressions: 500 }]); // -22.5%
    expect(result).toEqual([]);
  });

  it("ignores a page with no prior-window clicks (nothing to compare)", () => {
    const result = classifyDecayingPages([{ page: "/new-page", clicks: 0, previousClicks: 0, previousImpressions: 0 }]);
    expect(result).toEqual([]);
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
