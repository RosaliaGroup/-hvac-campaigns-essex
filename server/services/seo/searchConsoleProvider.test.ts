import { describe, it, expect } from "vitest";
import { GoogleSearchConsoleProvider } from "./searchConsoleProvider";

/**
 * These run without a configured database (no DATABASE_URL in the test env), so
 * they lock in the "never break the dashboard" contract: every read degrades to
 * safe, empty data instead of throwing, and mutations no-op.
 */
describe("GoogleSearchConsoleProvider — graceful degradation without a DB", () => {
  const provider = new GoogleSearchConsoleProvider();

  it("getOverview returns a well-formed empty overview", async () => {
    const o = await provider.getOverview();
    expect(o.organicClicks).toBe(0);
    expect(o.impressions).toBe(0);
    expect(o.indexedPages).toBe(0);
    expect(o.organicLeads.goal).toBeGreaterThan(0);
    expect(o.rangeLabel).toMatch(/90 days/);
  });

  it("listOpportunities returns []", async () => {
    expect(await provider.listOpportunities()).toEqual([]);
  });

  it("getOpportunity returns null for any id", async () => {
    expect(await provider.getOpportunity("1")).toBeNull();
    expect(await provider.getOpportunity("not-a-number")).toBeNull();
  });

  it("mutations no-op (return []) rather than throw", async () => {
    expect(await provider.runAction(["1"], "optimize_everything")).toEqual([]);
    expect(await provider.setStatus(["1"], "published")).toEqual([]);
  });
});
