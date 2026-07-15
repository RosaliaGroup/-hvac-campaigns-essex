/**
 * Google Business Profile (Local SEO) — shared domain model (framework-free).
 *
 * Single source of truth for the Local SEO dashboard: the overview / review /
 * insight / post shapes plus the pure helpers (star-rating mapping, review
 * summarisation, trend/total derivation) live here so the server provider, the
 * admin tRPC router and the React UI can never drift apart.
 *
 * FUTURE-READY: none of this depends on where the numbers come from. They are
 * served by the cache-backed GbpProvider (server/services/gbp/provider.ts) which
 * reads the MySQL cache the daily `runGbpSync` populates from the Business
 * Profile APIs. The dashboard is strictly READ-ONLY — there is no publish /
 * reply / upload surface here.
 */

/* ── Star rating ────────────────────────────────────────────────────────── */

/** Google's `starRating` enum, in ascending order. Index 0 = "unspecified". */
export const GBP_STAR_RATING = ["STAR_RATING_UNSPECIFIED", "ONE", "TWO", "THREE", "FOUR", "FIVE"] as const;
export type GbpStarRatingEnum = (typeof GBP_STAR_RATING)[number];

/** Map Google's `starRating` enum string to an integer 1–5 (0 when unspecified). */
export function starRatingToInt(rating: string | number | null | undefined): number {
  if (typeof rating === "number") {
    return Number.isFinite(rating) ? Math.min(5, Math.max(0, Math.round(rating))) : 0;
  }
  const idx = GBP_STAR_RATING.indexOf((rating ?? "") as GbpStarRatingEnum);
  return idx > 0 ? idx : 0;
}

/* ── Daily metric keys ──────────────────────────────────────────────────── */

/**
 * The Business Profile Performance `dailyMetric` enum values we pull. Search and
 * Maps impressions each split mobile/desktop, so the sync sums the pair into a
 * single "views" figure.
 */
export const GBP_DAILY_METRICS = [
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
] as const;
export type GbpDailyMetricKey = (typeof GBP_DAILY_METRICS)[number];

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One day of performance figures for the trend charts + totals. */
export interface GbpInsightPoint {
  date: string; // YYYY-MM-DD
  callClicks: number;
  directionRequests: number;
  websiteClicks: number;
  searchViews: number;
  mapsViews: number;
  rating: number;
  reviewCount: number;
}

/** Sum of a metric across the window, with its previous-window delta fraction. */
export interface GbpMetricSummary {
  total: number;
  /** Fractional change vs the previous equal-length window (0.12 === +12%). */
  delta: number;
}

export interface GbpOverview {
  connected: boolean;
  title: string | null;
  storefrontAddress: string | null;
  rating: number;
  totalReviews: number;
  totalPhotos: number;
  totalPosts: number;
  /** Windowed engagement totals (+ deltas vs the prior equal window). */
  calls: GbpMetricSummary;
  directions: GbpMetricSummary;
  websiteClicks: GbpMetricSummary;
  searchViews: GbpMetricSummary;
  mapsViews: GbpMetricSummary;
  /** Rating at the start vs end of the window (for the trend arrow). */
  ratingTrend: { current: number; previous: number; delta: number };
  rangeLabel: string;
  lastSyncedAt: string | null;
}

export interface GbpReview {
  id: string;
  reviewerName: string;
  starRating: number;
  comment: string;
  createTime: string | null;
  replyComment: string | null;
  replyTime: string | null;
}

export interface GbpPhoto {
  id: string;
  category: string;
  googleUrl: string | null;
  viewCount: number;
  createTime: string | null;
}

export interface GbpPost {
  id: string;
  summary: string;
  topicType: string;
  state: string;
  searchUrl: string | null;
  createTime: string | null;
}

export interface GbpSyncStatus {
  connected: boolean;
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** True when there has never been a successful sync, or the last one failed. */
  stale: boolean;
}

/* ── Pure derivations (unit-tested) ─────────────────────────────────────── */

/** Sum a metric field across insight points and compare to the prior window. */
export function summarizeMetric(
  current: GbpInsightPoint[],
  previous: GbpInsightPoint[],
  field: keyof Pick<GbpInsightPoint, "callClicks" | "directionRequests" | "websiteClicks" | "searchViews" | "mapsViews">,
): GbpMetricSummary {
  const sum = (rows: GbpInsightPoint[]) => rows.reduce((n, r) => n + (r[field] ?? 0), 0);
  const total = sum(current);
  const prev = sum(previous);
  const delta = prev > 0 ? (total - prev) / prev : 0;
  return { total, delta };
}

/**
 * Rating trend across a window: the earliest non-zero snapshot vs the latest.
 * Snapshots of 0 (days before any review existed / missing data) are ignored so
 * the trend reflects real rating movement.
 */
export function ratingTrend(points: GbpInsightPoint[]): { current: number; previous: number; delta: number } {
  const rated = points.filter((p) => p.rating > 0);
  if (rated.length === 0) return { current: 0, previous: 0, delta: 0 };
  const previous = rated[0].rating;
  const current = rated[rated.length - 1].rating;
  return { current, previous, delta: current - previous };
}

/** Average star rating from a set of reviews (0 when empty). */
export function averageRating(reviews: Pick<GbpReview, "starRating">[]): number {
  const rated = reviews.filter((r) => r.starRating > 0);
  if (rated.length === 0) return 0;
  const sum = rated.reduce((n, r) => n + r.starRating, 0);
  return Math.round((sum / rated.length) * 100) / 100;
}

/** A short, safe one-line preview of a review comment for list rows. */
export function reviewSnippet(comment: string | null | undefined, max = 160): string {
  const text = (comment ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/* ── Formatting helpers (shared by cards/labels) ────────────────────────── */

export const GBP_METRIC_LABELS = {
  calls: "Calls",
  directions: "Directions",
  websiteClicks: "Website Clicks",
  searchViews: "Search Visibility",
  mapsViews: "Maps Visibility",
} as const;
export type GbpMetricKey = keyof typeof GBP_METRIC_LABELS;
