import { describe, it, expect } from "vitest";
import { analyzeAnswer, summarizeWeek, compareWeeks, weekStartET, domainOf, type Observation } from "./aiVisibility";

const watch = [
  { name: "Gold Medal", domain: "" },
  { name: "Springfield Heating & AC", domain: "springfieldhvac.example" },
];

describe("analyzeAnswer", () => {
  it("names us when the answer text says Mechanical Enterprise, and records competitors + cited domains", () => {
    const o = analyzeAnswer("HVAC contractor Newark NJ", "perplexity", {
      text: "Top picks include Mechanical Enterprise, Gold Medal and Acme Heating & Cooling in Newark.",
      citations: ["https://www.yelp.com/biz/x", "https://mechanicalenterprise.com/hvac-newark-nj", "https://www.yelp.com/biz/y"],
    }, watch);
    expect(o.named).toBe(true);
    expect(o.namedAs?.toLowerCase()).toBe("mechanical enterprise");
    expect(o.citedUs).toBe(true);
    expect(o.competitors).toEqual(["Gold Medal"]);
    expect(o.citedDomains).toEqual(["yelp.com", "mechanicalenterprise.com"]);
    expect(o.otherCompanies.some((c) => /Acme Heating/.test(c))).toBe(true);
    expect(o.otherCompanies.join(" ")).not.toMatch(/Mechanical Enterprise/);
  });
  it("citing our domain without naming us is NOT 'named'", () => {
    const o = analyzeAnswer("q", "openai", { text: "Several local contractors serve Newark.", citations: ["https://mechanicalenterprise.com/x"] }, watch);
    expect(o.named).toBe(false);
    expect(o.citedUs).toBe(true);
  });
  it("detects a watchlist competitor by cited domain even when the name is absent", () => {
    const o = analyzeAnswer("q", "openai", { text: "See this local company.", citations: ["https://www.springfieldhvac.example/service"] }, watch);
    expect(o.competitors).toEqual(["Springfield Heating & AC"]);
  });
  it("domainOf strips www and tolerates junk", () => {
    expect(domainOf("https://www.Example.com/a?b=1")).toBe("example.com");
    expect(domainOf("not a url ::")).toBeNull();
  });
});

const obs = (engine: Observation["engine"], query: string, over: Partial<Observation> = {}): Observation => ({
  engine, query, status: "ok", named: false, citedUs: false, namedAs: null, competitors: [], otherCompanies: [], citedDomains: [], citations: [], excerpt: "", ...over,
});

describe("summarizeWeek / compareWeeks", () => {
  const w1 = summarizeWeek("2026-09-28", [
    obs("perplexity", "a", { named: true, competitors: ["Gold Medal"], citedDomains: ["yelp.com", "angi.com"] }),
    obs("openai", "a", { named: false, citedDomains: ["yelp.com"] }),
    obs("perplexity", "b", { named: false }),
    obs("openai", "b", { status: "error" }),
  ]);
  it("tallies per engine (errors counted separately, never as 'not named'), named queries and review-platform share", () => {
    expect(w1.engines.perplexity).toEqual({ checked: 2, named: 1, failed: 0 });
    expect(w1.engines.openai).toEqual({ checked: 1, named: 0, failed: 1 });
    expect(w1.namedQueries).toEqual(["a"]);
    expect(w1.competitorCounts).toEqual({ "Gold Medal": 1 });
    expect(w1.topCited[0]).toEqual({ domain: "yelp.com", count: 2 });
    expect(w1.reviewPlatformShare).toBe(1);
  });
  it("week-over-week: gained / lost queries and new competitors", () => {
    const w2 = summarizeWeek("2026-10-05", [
      obs("perplexity", "b", { named: true, competitors: ["Horizon"] }),
      obs("openai", "a", { named: false }),
    ]);
    const c = compareWeeks(w2, w1)!;
    expect(c.gained).toEqual(["b"]);
    expect(c.lost).toEqual(["a"]);
    expect(c.namedQueriesDelta).toBe(0);
    expect(c.newCompetitors).toEqual(["Horizon"]);
    expect(c.droppedCompetitors).toEqual(["Gold Medal"]);
    expect(compareWeeks(w1, null)).toBeNull();
  });
});

describe("weekStartET", () => {
  it("returns the Monday of the New York week (Sunday night ET still belongs to the old week)", () => {
    expect(weekStartET(new Date("2026-10-05T14:00:00Z"))).toBe("2026-10-05"); // Monday
    expect(weekStartET(new Date("2026-10-07T14:00:00Z"))).toBe("2026-10-05"); // Wednesday
    expect(weekStartET(new Date("2026-10-05T02:00:00Z"))).toBe("2026-09-28"); // Sun 22:00 ET
  });
});
