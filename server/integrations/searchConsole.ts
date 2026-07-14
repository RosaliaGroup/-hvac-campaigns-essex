/**
 * Google Search Console API client.
 *
 * Reuses the single shared Google grant (the OAuth flow behind Google Calendar /
 * Google Ads — see server/integrations/google/calendar.ts, which now also
 * requests the webmasters.readonly scope). There is NO second OAuth flow: we
 * mint a Search-Console-scoped access token from the existing connection's
 * refresh token.
 *
 * This module is deliberately split into pure mappers (unit-tested) and thin
 * network callers, so parsing/derivation is verifiable without hitting Google.
 */
import type { IndexStatus } from "@shared/seo";
import { googleCalendarProvider } from "./google/calendar";

const SEARCH_ANALYTICS_BASE = "https://www.googleapis.com/webmasters/v3/sites";
const URL_INSPECTION_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

/** Raised when Search Console can't be reached / isn't authorized. Callers degrade gracefully. */
export class SearchConsoleUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchConsoleUnavailableError";
  }
}

/**
 * The Search Console property to sync. A URL-prefix property ("https://…/") or a
 * domain property ("sc-domain:example.com"). Falls back to the public site URL.
 */
export function getSeoSiteUrl(): string {
  return (
    process.env.SEO_GSC_SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "https://mechanicalenterprise.com/"
  );
}

/** The public origin used to turn a GSC page path back into a clickable URL. */
export function getSiteOrigin(): string {
  const site = getSeoSiteUrl();
  if (site.startsWith("sc-domain:")) {
    return `https://${site.slice("sc-domain:".length).replace(/\/$/, "")}`;
  }
  return site.replace(/\/$/, "");
}

/* ── Pure helpers (unit-tested) ─────────────────────────────────────────── */

export type AnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Parse the `rows` of a searchAnalytics.query response into typed rows. */
export function parseAnalyticsRows(json: unknown): AnalyticsRow[] {
  const rows = (json as { rows?: unknown[] })?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      keys: Array.isArray(row.keys) ? (row.keys as unknown[]).map(String) : [],
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
    };
  });
}

/**
 * Map a URL Inspection `coverageState` / `indexingState` string to our enum.
 * Google's phrasing is matched loosely so wording tweaks don't silently break it.
 */
export function mapCoverageState(coverageState: string | undefined | null): IndexStatus {
  const s = (coverageState ?? "").toLowerCase();
  if (!s) return "indexed";
  if (s.includes("submitted and indexed") || s === "indexed" || s.includes("indexed, not submitted")) {
    return "indexed";
  }
  if (s.includes("crawled") && s.includes("not indexed")) return "crawled_not_indexed";
  if (s.includes("discovered") && s.includes("not indexed")) return "discovered_not_indexed";
  if (s.includes("excluded") || s.includes("not indexed") || s.includes("duplicate") || s.includes("alternate")) {
    return "excluded";
  }
  return "indexed";
}

/** Turn a GSC key (full URL or path) into a site-relative path. */
export function toPath(pageKey: string, origin: string): string {
  if (pageKey.startsWith("http")) {
    try {
      return new URL(pageKey).pathname || "/";
    } catch {
      return pageKey;
    }
  }
  return pageKey.startsWith("/") ? pageKey : `/${pageKey}`;
}

/* ── Access token (reuses the shared Google connection) ─────────────────── */

export async function getSearchConsoleAccessToken(): Promise<string> {
  try {
    const { accessToken } = await googleCalendarProvider.getValidAccessToken();
    if (!accessToken) throw new Error("empty access token");
    return accessToken;
  } catch (err) {
    throw new SearchConsoleUnavailableError(
      `Google not connected or token refresh failed: ${(err as Error).message}`
    );
  }
}

/* ── Network callers ────────────────────────────────────────────────────── */

export type SearchAnalyticsParams = {
  accessToken: string;
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: Array<"page" | "query" | "date" | "device" | "country">;
  rowLimit?: number;
};

export async function querySearchAnalytics(
  params: SearchAnalyticsParams,
  fetchImpl: typeof fetch = fetch
): Promise<AnalyticsRow[]> {
  const endpoint = `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit ?? 1000,
      dataState: "all",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SearchConsoleUnavailableError(`searchAnalytics ${res.status}: ${text.slice(0, 300)}`);
  }
  return parseAnalyticsRows(await res.json());
}

export type UrlInspectionResult = {
  indexStatus: IndexStatus;
  lastCrawlTime: string | null;
  coverageState: string | null;
};

/**
 * Inspect a single URL's index coverage. Best-effort and quota-limited, so the
 * sync only inspects the top pages; callers must tolerate failures.
 */
export async function inspectUrl(
  args: { accessToken: string; siteUrl: string; inspectionUrl: string },
  fetchImpl: typeof fetch = fetch
): Promise<UrlInspectionResult> {
  const res = await fetchImpl(URL_INSPECTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: args.inspectionUrl, siteUrl: args.siteUrl }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SearchConsoleUnavailableError(`urlInspection ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    inspectionResult?: { indexStatusResult?: { coverageState?: string; lastCrawlTime?: string } };
  };
  const r = json.inspectionResult?.indexStatusResult;
  return {
    indexStatus: mapCoverageState(r?.coverageState),
    lastCrawlTime: r?.lastCrawlTime ?? null,
    coverageState: r?.coverageState ?? null,
  };
}
