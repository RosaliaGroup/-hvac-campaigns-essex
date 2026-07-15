/**
 * Google Analytics Data API (GA4) client.
 *
 * Reuses the single shared Google grant (the OAuth flow behind Google Calendar /
 * Search Console — see server/integrations/google/calendar.ts, which now also
 * requests the analytics.readonly scope). There is NO second OAuth flow: we mint
 * an Analytics-scoped access token from the existing connection's refresh token,
 * exactly like server/integrations/searchConsole.ts does for Search Console.
 *
 * The module is split into pure mappers (unit-tested) and thin network callers
 * (retry/backoff around one `runReport`), so parsing/derivation is verifiable
 * without hitting Google.
 */
import { googleCalendarProvider } from "./google/calendar";

const ANALYTICS_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

/** Raised when GA4 can't be reached / isn't authorized. Callers degrade gracefully. */
export class Ga4UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ga4UnavailableError";
  }
}

/**
 * A GA4 property id is the numeric id from the property settings (NOT the
 * "G-XXXX" measurement id, NOT a "UA-…" Universal Analytics id). Validated so a
 * mis-pasted measurement id degrades to "unconfigured" instead of 400-ing GA4.
 */
export function isValidGa4PropertyId(id: string): boolean {
  return /^[0-9]+$/.test(id);
}

/**
 * The GA4 property to sync (numeric id, e.g. "480827123"). Accepts a bare id or
 * a "properties/480827123" form. Returns "" when unconfigured OR when the value
 * is not a valid numeric property id — the sync reports "unconfigured" and the
 * dashboard stays empty rather than throwing.
 */
export function getGa4PropertyId(): string {
  const raw = (process.env.GA4_PROPERTY_ID || process.env.GA4_ANALYTICS_PROPERTY_ID || "").trim();
  const cleaned = raw.replace(/^properties\//, "");
  if (!cleaned) return "";
  if (!isValidGa4PropertyId(cleaned)) {
    console.warn(
      `[GA4] GA4_PROPERTY_ID="${raw}" is not a numeric property id (expected e.g. "480827123", not a "G-"/"UA-" id) — analytics disabled`,
    );
    return "";
  }
  return cleaned;
}

/* ── Report definition (the single runReport this integration issues) ────── */

/**
 * Dimensions requested, in order. `date` first so the timeseries is cheap to
 * build; the rest are the acquisition slice the cache is keyed on.
 */
export const GA4_DIMENSIONS = [
  "date",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "landingPage",
  "sessionDefaultChannelGroup",
] as const;

/** Metrics requested, in order — matches the ga4DailyMetrics columns. */
export const GA4_METRICS = [
  "screenPageViews",
  "sessions",
  "totalUsers",
  "conversions",
  "eventCount",
] as const;

/* ── Pure helpers (unit-tested) ─────────────────────────────────────────── */

/** GA4's `date` dimension is "YYYYMMDD"; normalise to "YYYY-MM-DD". */
export function normalizeGa4Date(value: string | undefined | null): string {
  const s = (value ?? "").trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

/**
 * Normalise a GA4 `landingPage` value to a stable site-relative path so the
 * cache never splits the same page across "/x", "x" and "https://host/x", and
 * the dashboard's "top landing pages" grouping is exact.
 *
 * GA4 placeholder tokens like "(not set)" / "(direct)" are preserved verbatim.
 * A full URL is reduced to path + query; a bare path gets a leading slash.
 */
export function normalizeLandingPage(value: string | undefined | null): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  if (s.startsWith("(") && s.endsWith(")")) return s; // "(not set)", "(direct)", …
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return `${u.pathname || "/"}${u.search}`;
    } catch {
      /* fall through to the bare-path handling */
    }
  }
  return s.startsWith("/") ? s : `/${s}`;
}

export type Ga4ReportRow = {
  date: string; // normalised YYYY-MM-DD
  source: string;
  medium: string;
  campaign: string;
  landingPage: string;
  channelGroup: string;
  pageViews: number;
  sessions: number;
  users: number;
  conversions: number;
  events: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a runReport response into typed rows, tolerant of missing fields.
 * Assumes the dimension/metric order declared in GA4_DIMENSIONS / GA4_METRICS.
 */
export function parseRunReport(json: unknown): Ga4ReportRow[] {
  const rows = (json as { rows?: unknown[] })?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
    const d = row.dimensionValues ?? [];
    const m = row.metricValues ?? [];
    return {
      date: normalizeGa4Date(d[0]?.value),
      source: (d[1]?.value ?? "").slice(0, 255),
      medium: (d[2]?.value ?? "").slice(0, 255),
      campaign: (d[3]?.value ?? "").slice(0, 512),
      landingPage: normalizeLandingPage(d[4]?.value).slice(0, 1024),
      channelGroup: (d[5]?.value ?? "").slice(0, 64),
      pageViews: Math.round(num(m[0]?.value)),
      sessions: Math.round(num(m[1]?.value)),
      users: Math.round(num(m[2]?.value)),
      conversions: num(m[3]?.value),
      events: Math.round(num(m[4]?.value)),
    };
  });
}

/* ── Access token (reuses the shared Google connection) ─────────────────── */

export async function getGa4AccessToken(): Promise<string> {
  try {
    const { accessToken } = await googleCalendarProvider.getValidAccessToken();
    if (!accessToken) throw new Error("empty access token");
    return accessToken;
  } catch (err) {
    throw new Ga4UnavailableError(
      `Google not connected or token refresh failed: ${(err as Error).message}`,
    );
  }
}

/* ── Retry / backoff ────────────────────────────────────────────────────── */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST with exponential backoff on transient failures (429 + 5xx + network
 * errors). Pure-ish: the delay function and fetch impl are injectable so the
 * backoff is unit-testable without real timers. Non-retryable responses (4xx
 * other than 429) return immediately for the caller to surface.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: {
    retries?: number;
    baseDelayMs?: number;
    fetchImpl?: typeof fetch;
    sleepImpl?: (ms: number) => Promise<void>;
  } = {},
): Promise<Response> {
  const retries = opts.retries ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleepImpl = opts.sleepImpl ?? sleep;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, init);
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        return res;
      }
      // Honour Retry-After when present, else exponential backoff w/ jitter-free step.
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** attempt;
      await sleepImpl(delay);
    } catch (err) {
      lastErr = err as Error;
      if (attempt === retries) break;
      await sleepImpl(baseDelayMs * 2 ** attempt);
    }
  }
  throw new Ga4UnavailableError(`GA4 request failed after retries: ${lastErr?.message ?? "network error"}`);
}

/* ── Network caller ─────────────────────────────────────────────────────── */

export type RunReportParams = {
  accessToken: string;
  propertyId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  limit?: number;
  offset?: number;
};

/**
 * Issue one GA4 runReport for the fixed dimension/metric set and return typed
 * rows. Throws Ga4UnavailableError on a non-OK response so runGa4Sync can record
 * the failure and the dashboard degrades gracefully.
 */
export async function runReport(
  params: RunReportParams,
  deps: { fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void> } = {},
): Promise<Ga4ReportRow[]> {
  const endpoint = `${ANALYTICS_DATA_BASE}/properties/${encodeURIComponent(params.propertyId)}:runReport`;
  const res = await fetchWithRetry(
    endpoint,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
        dimensions: GA4_DIMENSIONS.map((name) => ({ name })),
        metrics: GA4_METRICS.map((name) => ({ name })),
        limit: params.limit ?? 100_000,
        offset: params.offset ?? 0,
        keepEmptyRows: false,
      }),
    },
    deps,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Ga4UnavailableError(`runReport ${res.status}: ${text.slice(0, 300)}`);
  }
  return parseRunReport(await res.json());
}
