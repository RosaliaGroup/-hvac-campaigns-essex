/**
 * GA4 Analytics — shared domain model (framework-free).
 *
 * Single source of truth for the Marketing → Analytics dashboard: the enums,
 * the report row/summary shapes, the Organic-vs-Paid classifier and the range
 * presets all live here so the server data provider, the tRPC router and the
 * React UI can never drift apart (mirrors @shared/seo).
 *
 * FUTURE-READY: none of this depends on where the numbers come from. They are
 * served by the cache-backed Ga4AnalyticsProvider
 * (server/services/ga4/provider.ts) which reads the MySQL cache a daily sync
 * populates from the Google Analytics Data API. Nothing here couples to SEO
 * (0044/0045), Revenue Attribution (0046) or the Google Ads integration.
 */

/* ── Traffic type (Organic vs Paid vs Other) ────────────────────────────── */

export const GA4_TRAFFIC_TYPES = ["organic", "paid", "other"] as const;
export type Ga4TrafficType = (typeof GA4_TRAFFIC_TYPES)[number];

export const GA4_TRAFFIC_TYPE_LABELS: Record<Ga4TrafficType, string> = {
  organic: "Organic",
  paid: "Paid",
  other: "Other",
};

/** Mediums that indicate paid acquisition (GA4 `sessionMedium`). */
const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsearch",
  "paid-search",
  "cpm",
  "cpv",
  "cpp",
  "cpa",
  "display",
  "banner",
  "retargeting",
  "paidsocial",
  "paid-social",
  "paid_social",
]);

/**
 * Classify an acquisition slice into Organic / Paid / Other.
 *
 * Pure and unit-tested. Prefers GA4's own `sessionDefaultChannelGroup` when it
 * is decisive, then falls back to the raw source/medium — so a custom-tagged
 * campaign ("google / cpc") is still counted as Paid even if the channel group
 * is blank. Unknown/direct traffic is deliberately "other", never guessed.
 */
export function deriveTrafficType(
  source: string | null | undefined,
  medium: string | null | undefined,
  channelGroup?: string | null,
): Ga4TrafficType {
  const g = (channelGroup ?? "").toLowerCase();
  if (g) {
    if (g.includes("paid")) return "paid";
    if (g.includes("organic")) return "organic";
    // Display / Cross-network / Affiliates are paid-adjacent acquisition.
    if (g.includes("display") || g.includes("cross-network") || g.includes("affiliates")) return "paid";
  }
  const m = (medium ?? "").trim().toLowerCase();
  if (m === "organic") return "organic";
  if (PAID_MEDIUMS.has(m)) return "paid";
  return "other";
}

/* ── Metric bundle (shared by most report rows) ─────────────────────────── */

export type Ga4Metrics = {
  pageViews: number;
  sessions: number;
  users: number;
  conversions: number;
  events: number;
};

export const EMPTY_METRICS: Ga4Metrics = {
  pageViews: 0,
  sessions: 0,
  users: 0,
  conversions: 0,
  events: 0,
};

/* ── Date-range presets ─────────────────────────────────────────────────── */

export const GA4_RANGES = ["7d", "28d", "90d"] as const;
export type Ga4Range = (typeof GA4_RANGES)[number];

export const GA4_RANGE_DAYS: Record<Ga4Range, number> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
};

export const GA4_RANGE_LABELS: Record<Ga4Range, string> = {
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "90d": "Last 90 days",
};

export const DEFAULT_GA4_RANGE: Ga4Range = "28d";

/* ── Report shapes (returned by the tRPC analytics router) ──────────────── */

/** Organic vs Paid vs Other split (by sessions), used on the overview + chart. */
export type Ga4ChannelSplit = Record<Ga4TrafficType, Ga4Metrics>;

export type Ga4Overview = {
  range: Ga4Range;
  rangeLabel: string;
  totals: Ga4Metrics;
  /** Percent change vs the immediately preceding window of equal length. */
  deltas: {
    pageViews: number;
    sessions: number;
    users: number;
    conversions: number;
    events: number;
  };
  /** Organic / Paid / Other split of the current window (by sessions etc.). */
  channels: Ga4ChannelSplit;
  /** True when there is no cached data yet (drives the "connect GA4" hint). */
  empty: boolean;
};

/** One day in the traffic timeseries. */
export type Ga4TrafficPoint = {
  date: string; // YYYY-MM-DD
  sessions: number;
  users: number;
  pageViews: number;
};

/** One day in the conversions timeseries. */
export type Ga4ConversionPoint = {
  date: string; // YYYY-MM-DD
  conversions: number;
};

export type Ga4CampaignRow = {
  campaign: string;
  source: string;
  medium: string;
  trafficType: Ga4TrafficType;
  sessions: number;
  users: number;
  conversions: number;
  pageViews: number;
};

export type Ga4LandingPageRow = {
  landingPage: string;
  sessions: number;
  users: number;
  conversions: number;
  pageViews: number;
};

export type Ga4TopPageRow = {
  page: string;
  pageViews: number;
  sessions: number;
  users: number;
};

export type Ga4SyncStatus = {
  connected: boolean;
  propertyId: string | null;
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  rowsSynced: number;
  /** True when there has never been a successful sync, or the last one failed. */
  stale: boolean;
};

/* ── Small pure helpers (shared server + client) ────────────────────────── */

/** Safe percent-change of `current` vs `previous` as a fraction (0.12 = +12%). */
export function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return (current - previous) / previous;
}

/** Add a metric bundle into an accumulator (mutates + returns `acc`). */
export function addMetrics(acc: Ga4Metrics, m: Ga4Metrics): Ga4Metrics {
  acc.pageViews += m.pageViews;
  acc.sessions += m.sessions;
  acc.users += m.users;
  acc.conversions += m.conversions;
  acc.events += m.events;
  return acc;
}

export function emptyChannelSplit(): Ga4ChannelSplit {
  return {
    organic: { ...EMPTY_METRICS },
    paid: { ...EMPTY_METRICS },
    other: { ...EMPTY_METRICS },
  };
}
