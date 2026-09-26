import { describe, it, expect } from "vitest";
import { buildItemDrafts, executeItem, emptyExecutionCounts } from "./adjustments";

const EMPTY = { rising: [], unserved: [], decaying: [], cannibalization: [], seasonality: [], competitorDiffs: [], differentiatorMatches: [], staleClaims: [] };

describe("buildItemDrafts (§3d suggestion routing)", () => {
  it("routes an unserved query with no page to the page-PR backlog, never auto-built", () => {
    const items = buildItemDrafts({ ...EMPTY, unserved: [{ query: "x", page: null, position: 0, impressions: 30, reason: "no_page" }] });
    expect(items.find((i) => i.kind === "unserved_query")?.targetQueue).toBe("page_pr_backlog");
  });

  it("routes a decaying page to the content queue (refresh lane), not the meta lane", () => {
    const items = buildItemDrafts({ ...EMPTY, decaying: [{ page: "/warranty", clicks: 10, previousClicks: 20, pctDown: 0.5 }] });
    expect(items.find((i) => i.kind === "decaying_page")?.targetQueue).toBe("content_queue");
  });

  it("routes a stale-claims item to the meta lane", () => {
    const items = buildItemDrafts({ ...EMPTY, staleClaims: [{ page: "/heat-pump-installation-nj", issue: "stale price range" }] });
    expect(items.find((i) => i.kind === "our_claims_stale")?.targetQueue).toBe("meta_lane");
  });

  it("routes cannibalization to report-only (never auto-executed)", () => {
    const items = buildItemDrafts({ ...EMPTY, cannibalization: [{ query: "x", pages: ["/a", "/b"] }] });
    expect(items.find((i) => i.kind === "cannibalization")?.targetQueue).toBe("report_only");
  });

  it("routes a competitor differentiator match to an owner-decision item, facts-blocked", () => {
    const diff = { competitor: "Test Co", domain: "testco.example", pagePath: "/warranty", kind: "messaging_change" as const, before: null, after: "Now with 10-year parts and labor", field: "meta" as const };
    const items = buildItemDrafts({ ...EMPTY, competitorDiffs: [diff], differentiatorMatches: [{ differentiator: "10-yr parts & labor", competitor: "Test Co", evidence: diff.after! }] });
    const item = items.find((i) => i.kind === "positioning_match");
    expect(item?.targetQueue).toBe("owner_decision");
    expect(item?.factsBlocked).toBe(true);
  });

  it("routes a competitor price change (non-match) to an owner-decision item, facts-blocked", () => {
    const diff = { competitor: "Test Co", domain: "testco.example", pagePath: "/pricing", kind: "price_change" as const, before: "$4,500", after: "$3,999", field: "title" as const };
    const items = buildItemDrafts({ ...EMPTY, competitorDiffs: [diff] });
    const item = items.find((i) => i.kind === "competitor_price_change");
    expect(item?.targetQueue).toBe("owner_decision");
    expect(item?.factsBlocked).toBe(true);
  });

  it("routes a plain messaging-change diff to report-only (watch)", () => {
    const diff = { competitor: "Test Co", domain: "testco.example", pagePath: "/", kind: "messaging_change" as const, before: "old tagline", after: "new tagline", field: "title" as const };
    const items = buildItemDrafts({ ...EMPTY, competitorDiffs: [diff] });
    expect(items.find((i) => i.kind === "competitor_messaging_change")?.targetQueue).toBe("report_only");
  });
});

describe("executeItem guardrail short-circuits", () => {
  it("never attempts execution for a report-only item", async () => {
    const { result } = await executeItem(
      { kind: "cannibalization", title: "x", evidence: {}, suggestion: "x", targetQueue: "report_only", factsBlocked: false },
      { counts: emptyExecutionCounts(), metaWarmedUp: true, circuitClear: true },
    );
    expect(result.status).toBe("not_executable");
  });

  it("stages (never executes) when the circuit breaker is open", async () => {
    const { result } = await executeItem(
      { kind: "our_claims_stale", title: "x", evidence: { page: "/warranty" }, suggestion: "x", targetQueue: "meta_lane", factsBlocked: false },
      { counts: emptyExecutionCounts(), metaWarmedUp: true, circuitClear: false },
    );
    expect(result).toEqual({ status: "staged", reason: "circuit breaker is open" });
  });

  it("stages (never executes) when the meta lane isn't warmed up", async () => {
    const { result } = await executeItem(
      { kind: "our_claims_stale", title: "x", evidence: { page: "/warranty" }, suggestion: "x", targetQueue: "meta_lane", factsBlocked: false },
      { counts: emptyExecutionCounts(), metaWarmedUp: false, circuitClear: true },
    );
    expect(result.status).toBe("staged");
  });

  it("stages once the daily meta-change cap is reached", async () => {
    const counts = { ...emptyExecutionCounts(), total: 5, metaChanges: 20 };
    const { result } = await executeItem(
      { kind: "our_claims_stale", title: "x", evidence: { page: "/warranty" }, suggestion: "x", targetQueue: "meta_lane", factsBlocked: false },
      { counts, metaWarmedUp: true, circuitClear: true },
    );
    expect(result).toEqual({ status: "staged", reason: "daily execution cap reached" });
  });
});
