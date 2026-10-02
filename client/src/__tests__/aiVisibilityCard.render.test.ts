import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AiVisibilityCard from "@/components/AiVisibilityCard";
import type { AiVisibilitySection } from "@shared/aiVisibility";

const base: AiVisibilitySection = {
  checked: true, reason: "", enginesConfigured: ["perplexity", "openai"],
  current: {
    weekOf: "2026-10-05", totalAnswers: 40, reviewPlatformShare: 0.55,
    engines: { perplexity: { checked: 20, named: 3, failed: 0 }, openai: { checked: 18, named: 1, failed: 2 } },
    namedQueries: ["heat pump installation NJ", "HVAC warranty NJ", "HVAC financing NJ"],
    competitorCounts: { "Gold Medal": 7 }, topCited: [{ domain: "yelp.com", count: 9 }],
  },
  previous: { weekOf: "2026-09-28", totalAnswers: 40, reviewPlatformShare: 0.5, engines: { perplexity: { checked: 20, named: 5, failed: 0 } }, namedQueries: ["a", "b", "c", "d", "e"], competitorCounts: {}, topCited: [] },
  change: { namedQueriesDelta: -2, gained: ["HVAC financing NJ"], lost: ["PTAC replacement NJ"], newCompetitors: ["Gold Medal"], droppedCompetitors: [] },
  gaps: [{ query: "PTAC replacement NJ", competitors: ["Gold Medal"], citedDomains: ["yelp.com"] }],
};

describe("AiVisibilityCard", () => {
  it("shows per-engine named counts with a SIGNED week-over-week change, gained/lost queries, competitors, sources and gaps", () => {
    const html = renderToStaticMarkup(h(AiVisibilityCard, { section: base }));
    expect(html).toContain("week of 2026-10-05");
    expect(html).toContain("named in 3 of 20 answers");
    expect(html).toContain("−2 vs last week"); // perplexity 3 vs 5
    expect(html).toContain("named in 1 of 18 answers");
    expect(html).toContain("2 failed");
    expect(html).toContain("gained");
    expect(html).toContain("lost");
    expect(html).toContain("Gold Medal");
    expect(html).toContain("yelp.com (9)");
    expect(html).toContain("55% review/directory platforms");
    expect(html).toContain("Not named for (1)");
  });
  it("says why when it did not run (no keys / no data yet)", () => {
    const html = renderToStaticMarkup(h(AiVisibilityCard, { section: { ...base, checked: false, current: null, reason: "No AI-visibility engine configured (PERPLEXITY_API_KEY / OPENAI_API_KEY)." } }));
    expect(html).toContain("No AI-visibility engine configured");
  });
});
