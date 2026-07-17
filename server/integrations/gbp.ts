/**
 * Google Business Profile API client (Local SEO — READ ONLY).
 *
 * Reuses the single shared Google grant (the OAuth flow behind Google Calendar /
 * Search Console — see server/integrations/google/calendar.ts, which now also
 * requests the business.manage scope). There is NO second OAuth flow: we mint an
 * access token from the existing connection's refresh token, exactly like
 * server/integrations/searchConsole.ts.
 *
 * This module ONLY performs GET reads (location info, reviews, performance
 * insights, media, local posts). Publishing / replying / uploading is a
 * SEPARATE concern owned by server/integrations/google-business.ts +
 * server/services/socialPublisher.ts and is intentionally untouched here.
 *
 * Split into pure mappers (unit-tested) and thin network callers so parsing is
 * verifiable without hitting Google.
 */
import {
  GBP_DAILY_METRICS,
  starRatingToInt,
  type GbpDailyMetricKey,
} from "@shared/gbp";
import { googleCalendarProvider } from "./google/calendar";

const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";
const MYBUSINESS_V4_BASE = "https://mybusiness.googleapis.com/v4";

/** Raised when Business Profile can't be reached / isn't authorized. Callers degrade gracefully. */
export class GbpUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GbpUnavailableError";
  }
}

/* ── Configuration ──────────────────────────────────────────────────────── */

export interface GbpTarget {
  accountId: string;
  locationId: string;
  /** "accounts/{accountId}/locations/{locationId}" — used by v4 (reviews/posts/media). */
  locationName: string;
  /** "locations/{locationId}" — used by the Performance API + Business Information. */
  locationResource: string;
}

/**
 * The Business Profile location to sync, from GBP_ACCOUNT_ID / GBP_LOCATION_ID.
 * Returns null when unconfigured so the sync no-ops instead of throwing.
 */
export function getGbpTarget(): GbpTarget | null {
  const accountId = (process.env.GBP_ACCOUNT_ID || "").trim();
  const locationId = (process.env.GBP_LOCATION_ID || "").trim();
  if (!accountId || !locationId) return null;
  return {
    accountId,
    locationId,
    locationName: `accounts/${accountId}/locations/${locationId}`,
    locationResource: `locations/${locationId}`,
  };
}

/* ── Access token (reuses the shared Google connection) ─────────────────── */

export async function getGbpAccessToken(): Promise<string> {
  try {
    const { accessToken } = await googleCalendarProvider.getValidAccessToken();
    if (!accessToken) throw new Error("empty access token");
    return accessToken;
  } catch (err) {
    throw new GbpUnavailableError(
      `Google not connected or token refresh failed: ${(err as Error).message}`,
    );
  }
}

/* ── Pure helpers (unit-tested) ─────────────────────────────────────────── */

/** Zero-pad a Google `date` object ({year,month,day}) to "YYYY-MM-DD". */
export function fmtGoogleDate(date: { year?: number; month?: number; day?: number } | undefined): string | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

export type MetricDatapoint = { metric: string; date: string; value: number };

/** Flatten a fetchMultiDailyMetricsTimeSeries response into {metric,date,value} rows. */
export function parseDailyMetricSeries(json: unknown): MetricDatapoint[] {
  const out: MetricDatapoint[] = [];
  const multi = (json as { multiDailyMetricTimeSeries?: unknown[] })?.multiDailyMetricTimeSeries;
  if (!Array.isArray(multi)) return out;
  for (const group of multi) {
    const series = (group as { dailyMetricTimeSeries?: unknown[] })?.dailyMetricTimeSeries;
    if (!Array.isArray(series)) continue;
    for (const s of series) {
      const row = s as { dailyMetric?: string; timeSeries?: { datedValues?: unknown[] } };
      const metric = String(row.dailyMetric ?? "");
      const dated = row.timeSeries?.datedValues;
      if (!metric || !Array.isArray(dated)) continue;
      for (const dv of dated) {
        const d = dv as { date?: { year?: number; month?: number; day?: number }; value?: unknown };
        const date = fmtGoogleDate(d.date);
        if (!date) continue;
        out.push({ metric, date, value: Number(d.value ?? 0) || 0 });
      }
    }
  }
  return out;
}

export interface DailyInsight {
  date: string;
  callClicks: number;
  directionRequests: number;
  websiteClicks: number;
  searchViews: number;
  mapsViews: number;
}

/**
 * Fold the raw {metric,date,value} datapoints into one row per date, summing the
 * mobile+desktop Search/Maps impression pairs into single "views" figures.
 */
export function aggregateDailyInsights(points: MetricDatapoint[]): DailyInsight[] {
  const byDate = new Map<string, DailyInsight>();
  const get = (date: string): DailyInsight => {
    let row = byDate.get(date);
    if (!row) {
      row = { date, callClicks: 0, directionRequests: 0, websiteClicks: 0, searchViews: 0, mapsViews: 0 };
      byDate.set(date, row);
    }
    return row;
  };
  for (const p of points) {
    const row = get(p.date);
    switch (p.metric as GbpDailyMetricKey) {
      case "CALL_CLICKS":
        row.callClicks += p.value;
        break;
      case "BUSINESS_DIRECTION_REQUESTS":
        row.directionRequests += p.value;
        break;
      case "WEBSITE_CLICKS":
        row.websiteClicks += p.value;
        break;
      case "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
      case "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
        row.searchViews += p.value;
        break;
      case "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
      case "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
        row.mapsViews += p.value;
        break;
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ParsedReview {
  reviewName: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createTime: string | null;
  updateTime: string | null;
  replyComment: string | null;
  replyTime: string | null;
}

export interface ParsedReviews {
  reviews: ParsedReview[];
  averageRating: number;
  totalReviewCount: number;
}

/** Parse a v4 reviews list response (reviews[] + averageRating + totalReviewCount). */
export function parseReviews(json: unknown): ParsedReviews {
  const obj = json as {
    reviews?: unknown[];
    averageRating?: unknown;
    totalReviewCount?: unknown;
  };
  const reviews: ParsedReview[] = Array.isArray(obj?.reviews)
    ? obj.reviews.map((r) => {
        const row = r as Record<string, any>;
        return {
          reviewName: String(row.name ?? ""),
          reviewerName: row.reviewer?.displayName ? String(row.reviewer.displayName) : null,
          starRating: starRatingToInt(row.starRating),
          comment: row.comment ? String(row.comment) : null,
          createTime: row.createTime ? String(row.createTime) : null,
          updateTime: row.updateTime ? String(row.updateTime) : null,
          replyComment: row.reviewReply?.comment ? String(row.reviewReply.comment) : null,
          replyTime: row.reviewReply?.updateTime ? String(row.reviewReply.updateTime) : null,
        };
      })
    : [];
  return {
    reviews: reviews.filter((r) => r.reviewName),
    averageRating: Number(obj?.averageRating ?? 0) || 0,
    totalReviewCount: Number(obj?.totalReviewCount ?? 0) || 0,
  };
}

export interface ParsedMedia {
  mediaName: string;
  category: string | null;
  googleUrl: string | null;
  viewCount: number;
  createTime: string | null;
}

/** Parse a v4 media list response into photo rows. */
export function parseMedia(json: unknown): ParsedMedia[] {
  const items = (json as { mediaItems?: unknown[] })?.mediaItems;
  if (!Array.isArray(items)) return [];
  return items
    .map((m) => {
      const row = m as Record<string, any>;
      return {
        mediaName: String(row.name ?? ""),
        category: row.locationAssociation?.category ? String(row.locationAssociation.category) : null,
        googleUrl: row.googleUrl ? String(row.googleUrl) : row.sourceUrl ? String(row.sourceUrl) : null,
        viewCount: Number(row.insights?.viewCount ?? 0) || 0,
        createTime: row.createTime ? String(row.createTime) : null,
      };
    })
    .filter((m) => m.mediaName);
}

export interface ParsedPost {
  postName: string;
  summary: string | null;
  topicType: string | null;
  state: string | null;
  searchUrl: string | null;
  createTime: string | null;
  updateTime: string | null;
}

/** Parse a v4 localPosts list response. */
export function parsePosts(json: unknown): ParsedPost[] {
  const items = (json as { localPosts?: unknown[] })?.localPosts;
  if (!Array.isArray(items)) return [];
  return items
    .map((p) => {
      const row = p as Record<string, any>;
      return {
        postName: String(row.name ?? ""),
        summary: row.summary ? String(row.summary) : null,
        topicType: row.topicType ? String(row.topicType) : null,
        state: row.state ? String(row.state) : null,
        searchUrl: row.searchUrl ? String(row.searchUrl) : null,
        createTime: row.createTime ? String(row.createTime) : null,
        updateTime: row.updateTime ? String(row.updateTime) : null,
      };
    })
    .filter((p) => p.postName);
}

export interface ParsedLocation {
  title: string | null;
  storefrontAddress: string | null;
  primaryPhone: string | null;
  websiteUrl: string | null;
}

/** Parse a Business Information `locations.get` response into the fields we cache. */
export function parseLocation(json: unknown): ParsedLocation {
  const row = json as Record<string, any>;
  const addr = row?.storefrontAddress;
  const storefrontAddress = addr
    ? [...(Array.isArray(addr.addressLines) ? addr.addressLines : []), addr.locality, addr.administrativeArea, addr.postalCode]
        .filter(Boolean)
        .join(", ")
    : null;
  return {
    title: row?.title ? String(row.title) : null,
    storefrontAddress: storefrontAddress || null,
    primaryPhone: row?.phoneNumbers?.primaryPhone ? String(row.phoneNumbers.primaryPhone) : null,
    websiteUrl: row?.websiteUri ? String(row.websiteUri) : null,
  };
}

/* ── Network callers ────────────────────────────────────────────────────── */

async function getJson(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<unknown> {
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GbpUnavailableError(`${new URL(url).pathname} ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function fetchLocation(
  args: { accessToken: string; target: GbpTarget },
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedLocation> {
  const readMask = "title,storefrontAddress,phoneNumbers,websiteUri";
  const url = `${BUSINESS_INFO_BASE}/${args.target.locationResource}?readMask=${encodeURIComponent(readMask)}`;
  return parseLocation(await getJson(url, args.accessToken, fetchImpl));
}

export async function fetchReviews(
  args: { accessToken: string; target: GbpTarget; pageSize?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedReviews> {
  const size = args.pageSize ?? 50;
  const url = `${MYBUSINESS_V4_BASE}/${args.target.locationName}/reviews?pageSize=${size}&orderBy=updateTime%20desc`;
  return parseReviews(await getJson(url, args.accessToken, fetchImpl));
}

export async function fetchMedia(
  args: { accessToken: string; target: GbpTarget; pageSize?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedMedia[]> {
  const size = args.pageSize ?? 100;
  const url = `${MYBUSINESS_V4_BASE}/${args.target.locationName}/media?pageSize=${size}`;
  return parseMedia(await getJson(url, args.accessToken, fetchImpl));
}

export async function fetchPosts(
  args: { accessToken: string; target: GbpTarget; pageSize?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedPost[]> {
  const size = args.pageSize ?? 100;
  const url = `${MYBUSINESS_V4_BASE}/${args.target.locationName}/localPosts?pageSize=${size}`;
  return parsePosts(await getJson(url, args.accessToken, fetchImpl));
}

/**
 * Pull the daily performance time series for the configured metrics over
 * [start, end] (inclusive, YYYY-MM-DD). One request, many metrics via
 * `dailyMetrics` repeated query params.
 */
export async function fetchDailyMetrics(
  args: { accessToken: string; target: GbpTarget; start: string; end: string },
  fetchImpl: typeof fetch = fetch,
): Promise<DailyInsight[]> {
  const [sy, sm, sd] = args.start.split("-").map(Number);
  const [ey, em, ed] = args.end.split("-").map(Number);
  const params = new URLSearchParams();
  for (const m of GBP_DAILY_METRICS) params.append("dailyMetrics", m);
  params.set("dailyRange.start_date.year", String(sy));
  params.set("dailyRange.start_date.month", String(sm));
  params.set("dailyRange.start_date.day", String(sd));
  params.set("dailyRange.end_date.year", String(ey));
  params.set("dailyRange.end_date.month", String(em));
  params.set("dailyRange.end_date.day", String(ed));
  const url = `${PERFORMANCE_BASE}/${args.target.locationResource}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
  const json = await getJson(url, args.accessToken, fetchImpl);
  return aggregateDailyInsights(parseDailyMetricSeries(json));
}
