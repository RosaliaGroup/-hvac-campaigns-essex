import { describe, it, expect } from "vitest";
import { withinDailyCaps, recordExecution, emptyExecutionCounts, evaluateMarketIntelCircuit, suggestionKeyFor, DAILY_CAPS } from "./guardrails";

describe("withinDailyCaps (§4 daily execution caps)", () => {
  it("allows a meta change under both the total and per-kind cap", () => {
    expect(withinDailyCaps(emptyExecutionCounts(), "meta_change")).toBe(true);
  });

  it("blocks once the total-items cap (10) is reached, regardless of kind", () => {
    const counts = { ...emptyExecutionCounts(), total: DAILY_CAPS.totalItems };
    expect(withinDailyCaps(counts, "meta_change")).toBe(false);
  });

  it("blocks a second new post (cap is 1/day)", () => {
    let counts = emptyExecutionCounts();
    counts = recordExecution(counts, "new_post");
    expect(withinDailyCaps(counts, "new_post")).toBe(false);
  });

  it("blocks a second new page (cap is 1/day)", () => {
    let counts = emptyExecutionCounts();
    counts = recordExecution(counts, "new_page");
    expect(withinDailyCaps(counts, "new_page")).toBe(false);
  });

  it("allows up to 3 refreshes and blocks a 4th", () => {
    let counts = emptyExecutionCounts();
    counts = recordExecution(counts, "refresh_post");
    counts = recordExecution(counts, "refresh_post");
    counts = recordExecution(counts, "refresh_post");
    expect(counts.refreshes).toBe(3);
    expect(withinDailyCaps(counts, "refresh_post")).toBe(false);
  });

  it("allows up to 20 meta changes and blocks a 21st", () => {
    let counts = emptyExecutionCounts();
    for (let i = 0; i < 20; i++) counts = recordExecution(counts, "meta_change");
    expect(withinDailyCaps(counts, "meta_change")).toBe(false);
  });
});

describe("evaluateMarketIntelCircuit (§4: 2 reverts/7d or 1 wrong/off_brand pauses)", () => {
  it("does not pause with zero reverts and zero wrong/off_brand dismissals", () => {
    expect(evaluateMarketIntelCircuit({ revertsInLast7Days: 0, wrongOrOffBrandInLast90Days: 0 })).toEqual({ shouldPause: false, reason: null });
  });

  it("does not pause with only 1 revert in 7 days", () => {
    expect(evaluateMarketIntelCircuit({ revertsInLast7Days: 1, wrongOrOffBrandInLast90Days: 0 }).shouldPause).toBe(false);
  });

  it("pauses at 2 reverts in 7 days", () => {
    expect(evaluateMarketIntelCircuit({ revertsInLast7Days: 2, wrongOrOffBrandInLast90Days: 0 }).shouldPause).toBe(true);
  });

  it("pauses on a single wrong/off_brand dismissal", () => {
    expect(evaluateMarketIntelCircuit({ revertsInLast7Days: 0, wrongOrOffBrandInLast90Days: 1 }).shouldPause).toBe(true);
  });
});

describe("suggestionKeyFor", () => {
  it("is stable for the same kind/title/targetQueue", () => {
    const a = suggestionKeyFor("decaying_page", "/warranty is decaying", "meta_lane");
    const b = suggestionKeyFor("decaying_page", "/warranty is decaying", "meta_lane");
    expect(a).toBe(b);
  });

  it("is case/whitespace-insensitive on title", () => {
    const a = suggestionKeyFor("decaying_page", "/warranty is decaying", "meta_lane");
    const b = suggestionKeyFor("decaying_page", "  /WARRANTY is DECAYING  ", "meta_lane");
    expect(a).toBe(b);
  });

  it("differs for a different kind", () => {
    const a = suggestionKeyFor("decaying_page", "same title", "meta_lane");
    const b = suggestionKeyFor("rising_query", "same title", "meta_lane");
    expect(a).not.toBe(b);
  });
});
