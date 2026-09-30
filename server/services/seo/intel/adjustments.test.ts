import { describe, it, expect, vi } from "vitest";
import { buildItemDrafts, executeItem, emptyExecutionCounts } from "./adjustments";
import type { RisingQueryFinding, DecayingPageFinding } from "../../../../shared/marketIntelTypes";

vi.mock("../contentQueue", () => ({
  proposeTopic: vi.fn().mockResolvedValue({}),
  hasExistingProposal: vi.fn().mockResolvedValue(false),
}));
import { proposeTopic, hasExistingProposal } from "../contentQueue";

const EMPTY = { rising: [], unserved: [], decaying: [], cannibalization: [], seasonality: [], competitorDiffs: [], differentiatorMatches: [], staleClaims: [] };

describe("buildItemDrafts (§3d suggestion routing)", () => {
  it("routes an unserved query with no page to the page-PR backlog, never auto-built", () => {
    const items = buildItemDrafts({ ...EMPTY, unserved: [{ query: "x", page: null, position: 0, impressions: 30, reason: "no_page" }] });
    expect(items.find((i) => i.kind === "unserved_query")?.targetQueue).toBe("page_pr_backlog");
  });

  it("routes a decaying page to the content queue (refresh lane), not the meta lane", () => {
    const items = buildItemDrafts({ ...EMPTY, decaying: [{ page: "/warranty", clicks: 10, previousClicks: 20, previousImpressions: 0, pctDown: 0.5 }] });
    expect(items.find((i) => i.kind === "decaying_page")?.targetQueue).toBe("content_queue");
  });

  describe("§3a significance floor + section cap (decaying pages)", () => {
    const decayingAt = (previousClicks: number, previousImpressions = 0) =>
      ({ page: `/p-${previousClicks}-${previousImpressions}`, clicks: 1, previousClicks, previousImpressions, pctDown: 0.9 });

    it("excludes a page below the click floor, and rolls it into one aggregate item", () => {
      const items = buildItemDrafts({ ...EMPTY, decaying: [decayingAt(5, 50)] });
      const decayingItems = items.filter((i) => i.kind === "decaying_page");
      expect(decayingItems).toHaveLength(1);
      expect(decayingItems[0].aggregate).toBe(true);
      expect(decayingItems[0].title).toContain("1 low-traffic pages");
      expect(decayingItems[0].targetQueue).toBe("report_only");
    });

    it("keeps a page that clears the click floor even with low impressions", () => {
      const items = buildItemDrafts({ ...EMPTY, decaying: [decayingAt(10, 0)] });
      const decayingItems = items.filter((i) => i.kind === "decaying_page");
      expect(decayingItems).toHaveLength(1);
      expect(decayingItems[0].aggregate).toBeUndefined();
    });

    it("does NOT keep a page on impressions alone: high impressions with few clicks still rolls into the aggregate", () => {
      const items = buildItemDrafts({ ...EMPTY, decaying: [decayingAt(1, 200), decayingAt(7, 50000)] });
      const decayingItems = items.filter((i) => i.kind === "decaying_page");
      expect(decayingItems).toHaveLength(1);
      expect(decayingItems[0].aggregate).toBe(true);
      expect(decayingItems[0].title).toContain("2 low-traffic pages");
    });

    it("caps individual items at 15, ranked by prior-window clicks, folding neither the excess nor the below-floor ones together", () => {
      const significant = Array.from({ length: 20 }, (_, i) => decayingAt(20 + i)); // all clear the floor
      const belowFloor = [decayingAt(3), decayingAt(4)];
      const items = buildItemDrafts({ ...EMPTY, decaying: [...significant, ...belowFloor] });
      const decayingItems = items.filter((i) => i.kind === "decaying_page");
      const individual = decayingItems.filter((i) => !i.aggregate);
      const aggregate = decayingItems.filter((i) => i.aggregate);
      expect(individual).toHaveLength(15);
      expect(aggregate).toHaveLength(1);
      expect(aggregate[0].title).toContain("2 low-traffic pages"); // only the genuinely below-floor ones, not cap overflow
      // Ranked highest-clicks-first: the top 15 of 20..39 previousClicks are 25..39.
      expect((individual[0].evidence as { previousClicks: number }).previousClicks).toBe(39);
      expect((individual[14].evidence as { previousClicks: number }).previousClicks).toBe(25);
    });

    it("never marks a real decaying-page item as aggregate, and never routes an aggregate item through execution", async () => {
      const items = buildItemDrafts({ ...EMPTY, decaying: [decayingAt(2, 10)] });
      const aggregateItem = items.find((i) => i.kind === "decaying_page" && i.aggregate)!;
      expect(aggregateItem).toBeDefined();
      const { result } = await executeItem(aggregateItem, { counts: emptyExecutionCounts(), metaWarmedUp: true, circuitClear: true });
      expect(result.status).toBe("not_executable");
    });
  });

  describe("§3a section cap (rising queries)", () => {
    const risingAt = (impressions: number): RisingQueryFinding => ({
      query: `q-${impressions}`, page: null, position: 5, impressions, impressionsPctChange: null, isNew: true, hasAnsweringPage: false,
    });

    it("caps rising_query and ads_keyword_suggestion items at 15 each, ranked by impressions", () => {
      const rising = Array.from({ length: 20 }, (_, i) => risingAt(100 + i));
      const items = buildItemDrafts({ ...EMPTY, rising });
      expect(items.filter((i) => i.kind === "rising_query")).toHaveLength(15);
      expect(items.filter((i) => i.kind === "ads_keyword_suggestion")).toHaveLength(15);
      const risingItems = items.filter((i) => i.kind === "rising_query");
      expect((risingItems[0].evidence as { impressions: number }).impressions).toBe(119);
      expect((risingItems[14].evidence as { impressions: number }).impressions).toBe(105);
    });
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

describe("executeItem: decaying_page proposes a refresh, deduped on (page, kind)", () => {
  const decayingItem = (page: string): { kind: string; title: string; evidence: DecayingPageFinding; suggestion: string; targetQueue: "content_queue"; factsBlocked: boolean } => ({
    kind: "decaying_page", title: `Decaying page: ${page}`,
    evidence: { page, clicks: 1, previousClicks: 20, previousImpressions: 0, pctDown: 0.9 },
    suggestion: "x", targetQueue: "content_queue", factsBlocked: false,
  });

  it("proposes a refresh when none exists yet for this (page, kind)", async () => {
    vi.mocked(hasExistingProposal).mockResolvedValueOnce(false);
    const { result } = await executeItem(decayingItem("/warranty"), { counts: emptyExecutionCounts(), metaWarmedUp: true, circuitClear: true });
    expect(result.status).toBe("staged");
    expect(proposeTopic).toHaveBeenCalledWith(expect.objectContaining({ refreshesSlug: "warranty", source: "market-intel:decaying_page" }));
    expect(hasExistingProposal).toHaveBeenCalledWith("warranty", "market-intel:decaying_page");
  });

  it("does not re-propose when one already exists for this (page, kind) — no duplicate row", async () => {
    vi.mocked(hasExistingProposal).mockResolvedValueOnce(true);
    vi.mocked(proposeTopic).mockClear();
    const { result } = await executeItem(decayingItem("/warranty"), { counts: emptyExecutionCounts(), metaWarmedUp: true, circuitClear: true });
    expect(result).toEqual({ status: "staged", reason: "already proposed for /warranty — not re-queued" });
    expect(proposeTopic).not.toHaveBeenCalled();
  });
});
