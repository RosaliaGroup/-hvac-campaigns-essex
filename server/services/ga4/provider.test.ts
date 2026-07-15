/**
 * Ga4AnalyticsProvider tests: read-only aggregation over the cache, and the
 * "never break the dashboard" contract — a missing DB, unconfigured property or
 * a throwing query all degrade to safe, empty data instead of throwing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn(), createDedicatedConnection: vi.fn() }));

import { getGa4Provider } from "./provider";
import { getDb } from "../../db";

const PROP = "480827123";

const ROWS = [
  {
    date: "2026-07-10", source: "google", medium: "organic", campaign: "(organic)",
    landingPage: "/a", channelGroup: "Organic Search", trafficType: "organic",
    pageViews: 10, sessions: 5, users: 4, conversions: "1.0000", events: 20,
  },
  {
    date: "2026-07-11", source: "google", medium: "cpc", campaign: "promo",
    landingPage: "/b", channelGroup: "Paid Search", trafficType: "paid",
    pageViews: 6, sessions: 3, users: 3, conversions: "2.0000", events: 12,
  },
];

/** A fake db whose select().from().where() resolves the given rows. */
function selectDb(rows: unknown[]) {
  return { select: () => ({ from: () => ({ where: () => Promise.resolve(rows) }) }) };
}
/** A fake db whose query throws (simulates a dead DB mid-request). */
function throwingDb() {
  return { select: () => ({ from: () => ({ where: () => { throw new Error("db down"); } }) }) };
}

const prevProp = process.env.GA4_PROPERTY_ID;
const prevAlt = process.env.GA4_ANALYTICS_PROPERTY_ID;

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  process.env.GA4_PROPERTY_ID = PROP;
  delete process.env.GA4_ANALYTICS_PROPERTY_ID;
});
afterEach(() => {
  if (prevProp === undefined) delete process.env.GA4_PROPERTY_ID;
  else process.env.GA4_PROPERTY_ID = prevProp;
  if (prevAlt === undefined) delete process.env.GA4_ANALYTICS_PROPERTY_ID;
  else process.env.GA4_ANALYTICS_PROPERTY_ID = prevAlt;
});

describe("Ga4AnalyticsProvider — aggregation (read-only)", () => {
  it("sums totals and splits Organic vs Paid on the overview", async () => {
    vi.mocked(getDb).mockResolvedValue(selectDb(ROWS) as never);
    const o = await getGa4Provider().getOverview("28d");
    expect(o.empty).toBe(false);
    expect(o.totals).toMatchObject({ sessions: 8, users: 7, pageViews: 16, conversions: 3, events: 32 });
    expect(o.channels.organic.sessions).toBe(5);
    expect(o.channels.paid.sessions).toBe(3);
    expect(o.channels.other.sessions).toBe(0);
  });

  it("builds a per-day traffic series sorted by date", async () => {
    vi.mocked(getDb).mockResolvedValue(selectDb(ROWS) as never);
    const t = await getGa4Provider().getTraffic("28d");
    expect(t.map((p) => p.date)).toEqual(["2026-07-10", "2026-07-11"]);
    expect(t[0]).toMatchObject({ sessions: 5, users: 4, pageViews: 10 });
  });

  it("ranks campaigns and top pages by their sort key", async () => {
    vi.mocked(getDb).mockResolvedValue(selectDb(ROWS) as never);
    const campaigns = await getGa4Provider().getCampaigns("28d");
    expect(campaigns).toHaveLength(2);
    expect(campaigns[0].sessions).toBeGreaterThanOrEqual(campaigns[1].sessions);
    const top = await getGa4Provider().getTopPages("28d");
    expect(top[0].pageViews).toBeGreaterThanOrEqual(top[1].pageViews);
  });
});

describe("Ga4AnalyticsProvider — graceful degradation", () => {
  it("returns an empty overview (never throws) when there is no DB", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const o = await getGa4Provider().getOverview("28d");
    expect(o.empty).toBe(true);
    expect(o.totals.sessions).toBe(0);
  });

  it("returns empty arrays for every list read when there is no DB", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const p = getGa4Provider();
    expect(await p.getTraffic("28d")).toEqual([]);
    expect(await p.getConversions("28d")).toEqual([]);
    expect(await p.getCampaigns("28d")).toEqual([]);
    expect(await p.getLandingPages("28d")).toEqual([]);
    expect(await p.getTopPages("28d")).toEqual([]);
  });

  it("returns empty when the GA4 property id is unconfigured", async () => {
    delete process.env.GA4_PROPERTY_ID;
    vi.mocked(getDb).mockResolvedValue(selectDb(ROWS) as never); // db present, but no property
    const o = await getGa4Provider().getOverview("28d");
    expect(o.empty).toBe(true);
  });

  it("swallows a throwing query and serves empty", async () => {
    vi.mocked(getDb).mockResolvedValue(throwingDb() as never);
    const o = await getGa4Provider().getOverview("28d");
    expect(o.empty).toBe(true);
    expect(await getGa4Provider().getTraffic("28d")).toEqual([]);
  });
});
