import { describe, it, expect, beforeEach } from "vitest";
import { computeSeoScore } from "@shared/seo";
import { MockSeoProvider } from "./mockProvider";

describe("MockSeoProvider", () => {
  let provider: MockSeoProvider;

  beforeEach(() => {
    // Fresh instance per test so mutations don't leak across cases.
    provider = new MockSeoProvider();
  });

  it("lists opportunities with a derived seoScore", async () => {
    const rows = await provider.listOpportunities();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.seoScore).toBe(computeSeoScore(r.problems));
    }
  });

  it("exposes an overview including organic-leads goal tracking", async () => {
    const o = await provider.getOverview();
    expect(o.organicLeads.thisMonth).toBeGreaterThanOrEqual(0);
    expect(o.organicLeads.goal).toBeGreaterThan(0);
  });

  it("getOpportunity returns null for an unknown id", async () => {
    expect(await provider.getOpportunity("nope")).toBeNull();
  });

  it("runAction('optimize_everything') clears problems, raises score, sets status", async () => {
    const [first] = await provider.listOpportunities();
    expect(first.problems.length).toBeGreaterThan(0);

    const [updated] = await provider.runAction([first.id], "optimize_everything");
    expect(updated.problems).toEqual([]);
    expect(updated.seoScore).toBe(100);
    expect(updated.status).toBe("optimizing");

    // Persisted on the provider, not just returned.
    const reread = await provider.getOpportunity(first.id);
    expect(reread?.problems).toEqual([]);
  });

  it("runAction('request_reindex') sets waiting_for_indexing without touching content", async () => {
    const [first] = await provider.listOpportunities();
    const before = first.problems;
    const [updated] = await provider.runAction([first.id], "request_reindex");
    expect(updated.status).toBe("waiting_for_indexing");
    expect(updated.problems).toEqual(before);
  });

  it("runAction applies to every id passed (bulk)", async () => {
    const rows = await provider.listOpportunities();
    const ids = rows.slice(0, 3).map((r) => r.id);
    const updated = await provider.runAction(ids, "optimize_everything");
    expect(updated.map((u) => u.id).sort()).toEqual([...ids].sort());
    expect(updated.every((u) => u.status === "optimizing")).toBe(true);
  });

  it("setStatus moves pages to the requested status (Mark Complete → published)", async () => {
    const rows = await provider.listOpportunities();
    const ids = rows.slice(0, 2).map((r) => r.id);
    const updated = await provider.setStatus(ids, "published");
    expect(updated.every((u) => u.status === "published")).toBe(true);
  });
});
