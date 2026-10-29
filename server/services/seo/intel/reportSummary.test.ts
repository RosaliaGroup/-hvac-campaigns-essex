import { describe, expect, it } from "vitest";
import { buildSummary } from "./report";

describe("market-intel summary distinguishes recommendations from actual changes", () => {
  const base = { itemCount: 7, executed: 0, circuitClear: true, circuitReason: null, gscStale: false };

  it("does not claim staged suggestions were executed", () => {
    const result = buildSummary(base);
    expect(result).toContain("0 executed");
    expect(result).toContain("staged, report-only, or blocked");
    expect(result).not.toContain("automatically published");
  });

  it("identifies an auto-queued topic as pending drafting, not a published article", () => {
    const result = buildSummary({ ...base, contentHandoff: { queued: 1 } });
    expect(result).toContain("1 evidence-backed topic queued");
    expect(result).toContain("not published yet");
  });

  it("reports queued refreshes as pending, not as executed or published", () => {
    const result = buildSummary({ ...base, refreshesQueued: 3 });
    expect(result).toContain("0 executed");
    expect(result).toContain("3 decaying posts queued for automatic refresh");
    expect(result).toContain("not published yet");
    expect(buildSummary({ ...base, refreshesQueued: 1 })).toContain("1 decaying post queued");
  });

  it("does not claim a ranking change when Search Console data is stale", () => {
    expect(buildSummary({ ...base, gscStale: true })).toContain("No indexing change is inferred");
  });

  it("reports a paused circuit as a safety stop", () => {
    expect(buildSummary({ ...base, circuitClear: false, circuitReason: "manual review required" }))
      .toContain("No changes executed");
  });
});
