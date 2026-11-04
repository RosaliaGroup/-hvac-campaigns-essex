/**
 * Competitors dashboard collector — free sources only (see shared/competitorDashboard.ts header).
 *
 * Per domain (us + every `confirmed` competitor), once a week:
 *   1. Brand search demand + 12-month trend   — Google Ads Keyword Planner (our own account, no cost)
 *   2. Keywords Google ties to their site      — Keyword Planner ideas with a URL seed (no cost)
 *   3. Sitemap size and publishing pace        — their public robots.txt / sitemap.xml
 *   4. Marketing tags on their homepage        — one homepage fetch
 *   5. Mobile speed / real-user field data     — Google PageSpeed Insights API (free; key optional)
 * Each source fails independently; a failure is recorded in `errors` and the rest still saves.
 * Same politeness as competitorWatch.ts: identified User-Agent, robots.txt respected, a few requests per site per week.
 */
import crypto from "crypto";
import { desc, eq, inArray, ne } from "drizzle-orm";
import { enums } from "google-ads-api";
import { getDb, getAiVaCredentials } from "../../../db";
import { seoIntelCompetitors, seoIntelCompetitorMetrics, seoQueries, type SeoIntelCompetitorRow } from "../../../../drizzle/schema";
import { getAdsCustomer } from "../../../googleAds";
import { weekStartET } from "../../../../shared/aiVisibility";
import {
  OUR_BRAND_TERMS,
  OUR_DOMAIN,
  OUR_NAME,
  SUGGESTED_COMPETITOR_DOMAINS,
  brandTermsFor,
  combineTrendsBatches,
  detectAdTech,
  parseTrendsJson,
  trendsBatches,
  trendsTimeline,
  parseSitemap,
  sitemapsFromRobots,
  summarizeSitemapUrls,
  type BrandDemand,
  type DomainMetrics,
  type SiteKeyword,
  type SitemapSummary,
  type SpeedResult,
} from "../../../../shared/competitorDashboard";

const USER_AGENT = "Mechanical Enterprise Market Intel Bot (+https://mechanicalenterprise.com)";
const NJ_GEO = "geoTargetConstants/21164";
const ENGLISH = "languageConstants/1000";
const MAX_SITEMAP_FILES = 8;
const FETCH_TIMEOUT_MS = 20_000;
const PSI_TIMEOUT_MS = 90_000;

/** google-ads-api throws GoogleAdsFailure objects (no .message); pull the real reason out. Exported for tests. */
export function errorDetail(err: unknown): string {
  const e = err as { message?: string; errors?: Array<{ message?: string; error_code?: unknown }>; details?: string };
  const fromErrors = (e?.errors ?? []).map((x) => `${x.message ?? ""} ${x.error_code ? JSON.stringify(x.error_code) : ""}`.trim()).filter(Boolean).join(" | ");
  return fromErrors || e?.message || e?.details || (typeof err === "string" ? err : JSON.stringify(err)?.slice(0, 300)) || "unknown error";
}

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ ok: boolean; status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow", signal: ctrl.signal });
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : "" };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Watchlist (DB, with a graceful fallback before 0084 is applied) ──────── */

export class CompetitorTablesMissingError extends Error {
  constructor() {
    super("The competitor tables aren't in the database yet (drizzle/0084_competitor_dashboard.sql needs to be applied).");
  }
}

function isMissingTable(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return /ER_NO_SUCH_TABLE|doesn't exist|no such table/i.test(msg) || (err as { code?: string })?.code === "ER_NO_SUCH_TABLE";
}

export async function listCompetitors(opts: { includeRemoved?: boolean } = {}): Promise<SeoIntelCompetitorRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const q = db.select().from(seoIntelCompetitors);
    const rows = opts.includeRemoved ? await q : await q.where(ne(seoIntelCompetitors.status, "removed"));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    if (isMissingTable(err)) throw new CompetitorTablesMissingError();
    throw err;
  }
}

/** Inserts the researched suggestions once (status `suggested`); never overwrites an owner's edit. */
export async function seedSuggestedCompetitors(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let added = 0;
  try {
    const existing = await db.select({ domain: seoIntelCompetitors.domain }).from(seoIntelCompetitors);
    const have = new Set(existing.map((e) => e.domain));
    for (const s of SUGGESTED_COMPETITOR_DOMAINS) {
      if (have.has(s.domain)) continue;
      await db.insert(seoIntelCompetitors).values({ name: s.name, domain: s.domain, status: "suggested", note: "Suggested from search results — confirm this is their site." });
      added++;
    }
  } catch (err) {
    if (isMissingTable(err)) throw new CompetitorTablesMissingError();
    throw err;
  }
  return added;
}

/** Confirmed competitors in the shape competitorWatch.ts uses. Empty (not an error) when the table isn't there yet. */
export async function confirmedCompetitorsForWatch(): Promise<Array<{ name: string; domain: string }>> {
  try {
    const rows = await listCompetitors();
    return rows.filter((r) => r.status === "confirmed").map((r) => ({ name: r.name, domain: r.domain }));
  } catch (err) {
    if (err instanceof CompetitorTablesMissingError) return [];
    throw err;
  }
}

/* ── Source 1 + 2: Keyword Planner (our own Google Ads account) ──────────── */

async function getAdsRefreshToken(): Promise<string | null> {
  const creds = await getAiVaCredentials("google_ads");
  return creds.refresh_token ?? null;
}

type KpCustomer = Awaited<ReturnType<typeof getAdsCustomer>>;

function monthKey(year: unknown, month: unknown): string | null {
  const y = Number(year);
  let m: number | null = null;
  if (typeof month === "number") m = month - 2; // MonthOfYear enum: JANUARY = 2
  if (typeof month === "string") m = MONTHS.indexOf(month.toUpperCase());
  if (!y || m === null || m < 0 || m > 11) return null;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Pure-ish mapper for the historical-metrics response (exported for tests). */
export function mapHistoricalMetrics(terms: string[], response: unknown): BrandDemand {
  const results = ((response as { results?: unknown[] })?.results ?? (Array.isArray(response) ? response : [])) as Array<{
    text?: string;
    close_variants?: string[];
    keyword_metrics?: { avg_monthly_searches?: number | string | null; monthly_search_volumes?: Array<{ year?: number | string; month?: number | string; monthly_searches?: number | string }> };
  }>;
  let avg: number | null = null;
  const byMonth = new Map<string, number>();
  for (const r of results) {
    const km = r.keyword_metrics;
    if (!km) continue;
    if (km.avg_monthly_searches != null) avg = (avg ?? 0) + Number(km.avg_monthly_searches);
    for (const v of km.monthly_search_volumes ?? []) {
      const k = monthKey(v.year, v.month);
      if (k) byMonth.set(k, (byMonth.get(k) ?? 0) + Number(v.monthly_searches ?? 0));
    }
  }
  const monthly = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, searches]) => ({ month, searches }));
  return { terms, avgMonthly: avg, monthly };
}

async function brandDemand(customer: KpCustomer, terms: string[]): Promise<BrandDemand> {
  const res = await customer.keywordPlanIdeas.generateKeywordHistoricalMetrics({
    customer_id: customer.credentials.customer_id,
    keywords: terms,
    geo_target_constants: [NJ_GEO],
    language: ENGLISH,
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
  } as never);
  return mapHistoricalMetrics(terms, res);
}

/** Exported for tests. Keeps the 25 highest-volume ideas. */
export function mapKeywordIdeas(response: unknown, limit = 25): SiteKeyword[] {
  const results = (Array.isArray(response) ? response : ((response as { results?: unknown[] })?.results ?? [])) as Array<{
    text?: string;
    keyword_idea_metrics?: { avg_monthly_searches?: number | string | null; competition?: number | string | null };
  }>;
  const compName = (c: unknown): string | null => {
    if (c == null) return null;
    if (typeof c === "string") return c.toLowerCase();
    return ({ 2: "low", 3: "medium", 4: "high" } as Record<number, string>)[Number(c)] ?? null;
  };
  return results
    .filter((r) => r.text)
    .map((r) => ({ keyword: r.text!.toLowerCase(), avgMonthly: Number(r.keyword_idea_metrics?.avg_monthly_searches ?? 0), competition: compName(r.keyword_idea_metrics?.competition) }))
    .sort((a, b) => b.avgMonthly - a.avgMonthly)
    .slice(0, limit);
}

async function siteKeywords(customer: KpCustomer, domain: string): Promise<SiteKeyword[]> {
  const res = await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: customer.credentials.customer_id,
    language: ENGLISH,
    geo_target_constants: [NJ_GEO],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
    page_size: 200,
    site_seed: { site: domain },
  } as never);
  return mapKeywordIdeas(res);
}

/* ── Source 3: sitemap ───────────────────────────────────────────────────── */

async function robotsText(domain: string): Promise<string> {
  try {
    const r = await fetchText(`https://${domain}/robots.txt`);
    return r.ok ? r.text : "";
  } catch {
    return "";
  }
}

function robotsDisallowsAll(robots: string): boolean {
  // Only the "User-agent: *" group matters for us.
  let inStar = false;
  for (const line of robots.split("\n")) {
    const ua = /^\s*user-agent:\s*(\S+)/i.exec(line);
    if (ua) { inStar = ua[1] === "*"; continue; }
    if (inStar && /^\s*disallow:\s*\/\s*$/i.test(line)) return true;
  }
  return false;
}

async function sitemapSummary(domain: string, robots: string, now: Date): Promise<SitemapSummary> {
  const queue = sitemapsFromRobots(robots);
  if (queue.length === 0) queue.push(`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`);
  const seen = new Set<string>();
  const urls: Array<{ loc: string; lastmod: string | null }> = [];
  while (queue.length && seen.size < MAX_SITEMAP_FILES) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    let r: { ok: boolean; text: string };
    try { r = await fetchText(next); } catch { continue; }
    if (!r.ok || !/<(urlset|sitemapindex)[\s>]/i.test(r.text)) continue;
    const parsed = parseSitemap(r.text);
    if (parsed.isIndex) queue.push(...parsed.entries.map((e) => e.loc));
    else urls.push(...parsed.entries);
  }
  return summarizeSitemapUrls(urls, now);
}

/* ── Source 5: PageSpeed Insights ────────────────────────────────────────── */

/** Exported for tests. */
export function mapPageSpeed(json: unknown): SpeedResult {
  const j = json as {
    lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> };
    loadingExperience?: { metrics?: Record<string, unknown>; origin_fallback?: boolean };
    originLoadingExperience?: { metrics?: Record<string, unknown> };
  };
  const score = j.lighthouseResult?.categories?.performance?.score;
  const lcp = j.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
  const field = j.originLoadingExperience?.metrics ?? j.loadingExperience?.metrics;
  return {
    mobileScore: typeof score === "number" ? Math.round(score * 100) : null,
    lcpMs: typeof lcp === "number" ? Math.round(lcp) : null,
    hasFieldData: !!field && Object.keys(field).length > 0,
  };
}

async function pageSpeed(domain: string): Promise<SpeedResult> {
  const params = new URLSearchParams({ url: `https://${domain}/`, strategy: "mobile", category: "performance" });
  const key = process.env.GOOGLE_PSI_API_KEY?.trim();
  if (key) params.set("key", key);
  const r = await fetchText(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, PSI_TIMEOUT_MS);
  if (!r.ok) throw new Error(`PageSpeed HTTP ${r.status}${r.status === 429 ? " (daily free quota used; set GOOGLE_PSI_API_KEY)" : ""}`);
  return mapPageSpeed(JSON.parse(r.text));
}

/* ── One domain ──────────────────────────────────────────────────────────── */

/** Keyword Planner needs Google Ads API Basic access; with Explorer access every call fails the same way. Exported for tests. */
export function keywordPlannerBlockedReason(detail: string): string | null {
  if (/explorer access|basic access|DEVELOPER_TOKEN_NOT_APPROVED|developer token is only approved for use with test accounts/i.test(detail)) {
    return "Keyword Planner is blocked until the Google Ads API has Basic access (apply in Google Ads → Tools → API Center). Brand interest comes from Google Trends meanwhile; the keyword gap stays empty.";
  }
  return null;
}

/** Shared across one refresh: once Keyword Planner is known to be blocked, stop calling it and report it once. */
export type KpState = { blockedReason: string | null; reported: boolean; speedBlocked?: boolean };

export async function collectDomainMetrics(
  target: { name: string; domain: string; brandTerms: string[]; isUs: boolean },
  customer: KpCustomer | null,
  now: Date = new Date(),
  kp: KpState = { blockedReason: null, reported: false },
): Promise<DomainMetrics> {
  const m: DomainMetrics = {
    domain: target.domain, name: target.name, isUs: target.isUs, capturedAt: now.toISOString(),
    brandDemand: null, siteKeywords: [], sitemap: null, adTech: null, speed: null, errors: [],
  };

  const kpCall = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    if (kp.blockedReason) return null;
    try {
      return await fn();
    } catch (err) {
      const detail = errorDetail(err);
      const blocked = keywordPlannerBlockedReason(detail);
      if (blocked) {
        kp.blockedReason = blocked;
        if (!kp.reported) { m.errors.push(blocked); kp.reported = true; }
      } else {
        m.errors.push(`${label}: ${detail}`);
      }
      return null;
    }
  };

  if (customer) {
    m.brandDemand = await kpCall("Brand searches", () => brandDemand(customer, target.brandTerms));
    if (m.brandDemand) m.brandDemand.source = "keyword_planner";
    if (!target.isUs) m.siteKeywords = (await kpCall("Site keywords", () => siteKeywords(customer, target.domain))) ?? [];
  } else if (!kp.reported) {
    m.errors.push("Brand searches and keywords: Google Ads isn't connected in the CRM. Brand interest comes from Google Trends.");
    kp.reported = true;
  }

  const robots = await robotsText(target.domain);
  if (!target.isUs && robotsDisallowsAll(robots)) {
    m.errors.push("Their robots.txt blocks crawlers, so the sitemap and homepage weren't fetched.");
  } else {
    try { m.sitemap = await sitemapSummary(target.domain, robots, now); } catch (err) { m.errors.push(`Sitemap: ${errorDetail(err)}`); }
    try {
      const home = await fetchText(`https://${target.domain}/`);
      if (home.ok) m.adTech = detectAdTech(home.text);
      else m.errors.push(`Homepage: HTTP ${home.status}`);
    } catch (err) { m.errors.push(`Homepage: ${errorDetail(err)}`); }
  }

  if (!kp.speedBlocked) {
    try {
      m.speed = await pageSpeed(target.domain);
    } catch (err) {
      const detail = errorDetail(err);
      if (/HTTP 429/.test(detail)) {
        kp.speedBlocked = true;
        m.errors.push("Speed: Google's free speed check needs its own key (create a free API key with the PageSpeed Insights API turned on, and add it in Railway as GOOGLE_PSI_API_KEY). Skipped for all sites this week.");
      } else {
        m.errors.push(`Speed: ${detail}`);
      }
    }
  }
  return m;
}

/* ── Google Trends fallback (free, no key; unofficial endpoints, may be rate-limited) ── */

const TRENDS_GEO = "US-NJ";

async function trendsCookie(): Promise<string> {
  try {
    const res = await fetch(`https://trends.google.com/trends/explore?geo=${TRENDS_GEO}`, { headers: { "User-Agent": USER_AGENT }, redirect: "manual" });
    const set = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    return set.map((c) => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

async function trendsGet(url: string, cookie: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...(cookie ? { Cookie: cookie } : {}) }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Google Trends HTTP ${res.status}${res.status === 429 ? " (Google is limiting requests from our server; it retries next week)" : ""}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function trendsBatch(keywords: string[], cookie: string) {
  const req = { comparisonItem: keywords.map((keyword) => ({ keyword, geo: TRENDS_GEO, time: "today 12-m" })), category: 0, property: "" };
  const explore = parseTrendsJson<{ widgets?: Array<{ id?: string; token?: string; request?: unknown }> }>(
    await trendsGet(`https://trends.google.com/trends/api/explore?hl=en-US&tz=300&req=${encodeURIComponent(JSON.stringify(req))}`, cookie),
  );
  const ts = explore.widgets?.find((w) => w.id === "TIMESERIES");
  if (!ts?.token || !ts.request) throw new Error("Google Trends returned no timeline");
  const data = parseTrendsJson(
    await trendsGet(`https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=300&req=${encodeURIComponent(JSON.stringify(ts.request))}&token=${encodeURIComponent(ts.token)}`, cookie),
  );
  return trendsTimeline(keywords, data);
}

/** Fills brandDemand from Google Trends for every row Keyword Planner didn't fill. Mutates rows; returns an error line or null. */
export async function fillFromTrends(rows: DomainMetrics[]): Promise<string | null> {
  const missing = rows.filter((r) => !r.brandDemand);
  if (missing.length === 0) return null;
  const termOf = (r: DomainMetrics) => r.name.toLowerCase();
  const terms = rows.map(termOf);
  // Anchor on the first competitor (stable across weeks), falling back to us.
  const anchor = termOf(rows.find((r) => !r.isUs) ?? rows[0]);
  try {
    const cookie = await trendsCookie();
    const batches = [];
    for (const batch of trendsBatches(terms, anchor)) {
      batches.push(await trendsBatch(batch, cookie));
      await new Promise((r) => setTimeout(r, 2500));
    }
    const combined = new Map(combineTrendsBatches(batches, anchor).map((c) => [c.keyword, c]));
    for (const r of missing) {
      const c = combined.get(termOf(r));
      if (c) r.brandDemand = { terms: [termOf(r)], avgMonthly: null, monthly: c.monthly, source: "google_trends", relativeInterest: c.mean };
    }
    return null;
  } catch (err) {
    return `Brand interest (Google Trends): ${errorDetail(err)}`;
  }
}

/* ── Weekly snapshot ─────────────────────────────────────────────────────── */

function metricKey(weekOf: string, domain: string): string {
  return crypto.createHash("sha256").update(`${weekOf}|${domain}`).digest("hex");
}

export type RefreshResult = { weekOf: string; domains: number; errors: number };

/** Collects every confirmed competitor plus us and upserts this week's rows. Safe to re-run (same week overwrites). */
export async function refreshCompetitorDashboard(onProgress?: (done: number, total: number) => void, now: Date = new Date()): Promise<RefreshResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const competitors = (await listCompetitors()).filter((c) => c.status === "confirmed");
  const targets = [
    { name: OUR_NAME, domain: OUR_DOMAIN, brandTerms: OUR_BRAND_TERMS, isUs: true },
    ...competitors.map((c) => ({ name: c.name, domain: c.domain, brandTerms: brandTermsFor(c.name, (c.brandTerms as string[] | null) ?? []), isUs: false })),
  ];

  let customer: KpCustomer | null = null;
  const token = await getAdsRefreshToken();
  if (token) {
    try { customer = await getAdsCustomer(token); } catch (err) { console.error("[Competitors] Google Ads client:", errorDetail(err)); }
  }

  const weekOf = weekStartET(now);
  const kp: KpState = { blockedReason: null, reported: false };
  const rows: DomainMetrics[] = [];
  for (let i = 0; i < targets.length; i++) {
    rows.push(await collectDomainMetrics(targets[i], customer, now, kp));
    onProgress?.(i + 1, targets.length);
  }
  // Brand interest from Google Trends wherever Keyword Planner couldn't supply counts.
  const trendsError = await fillFromTrends(rows);
  if (trendsError) rows[0].errors.push(trendsError);

  let errors = 0;
  for (const metrics of rows) {
    errors += metrics.errors.length;
    await db
      .insert(seoIntelCompetitorMetrics)
      .values({ weekOf, domain: metrics.domain, metricKey: metricKey(weekOf, metrics.domain), data: metrics })
      .onDuplicateKeyUpdate({ set: { data: metrics, capturedAt: now } });
  }
  console.log(`[Competitors] week ${weekOf}: ${targets.length} domains, ${errors} source error(s)`);
  return { weekOf, domains: targets.length, errors };
}

/** Latest week's rows, plus the previous week's for comparison. */
export async function getDashboardSnapshot(): Promise<{ weekOf: string | null; current: DomainMetrics[]; previous: DomainMetrics[]; ourQueries: string[] }> {
  const db = await getDb();
  if (!db) return { weekOf: null, current: [], previous: [], ourQueries: [] };
  let weeks: Array<{ weekOf: string }>;
  try {
    weeks = await db.selectDistinct({ weekOf: seoIntelCompetitorMetrics.weekOf }).from(seoIntelCompetitorMetrics).orderBy(desc(seoIntelCompetitorMetrics.weekOf)).limit(2);
  } catch (err) {
    if (isMissingTable(err)) throw new CompetitorTablesMissingError();
    throw err;
  }
  const ourQueries = (await db.selectDistinct({ query: seoQueries.query }).from(seoQueries).limit(5000)).map((r) => r.query);
  if (weeks.length === 0) return { weekOf: null, current: [], previous: [], ourQueries };
  const rows = await db.select().from(seoIntelCompetitorMetrics).where(inArray(seoIntelCompetitorMetrics.weekOf, weeks.map((w) => w.weekOf)));
  const pick = (w: string | undefined) => rows.filter((r) => r.weekOf === w).map((r) => r.data as DomainMetrics);
  return { weekOf: weeks[0].weekOf, current: pick(weeks[0].weekOf), previous: pick(weeks[1]?.weekOf), ourQueries };
}

export async function upsertCompetitor(input: { id?: number; name: string; domain: string; status: "suggested" | "confirmed" | "removed"; brandTerms?: string[] }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    if (input.id) {
      await db.update(seoIntelCompetitors).set({ name: input.name, domain: input.domain, status: input.status, brandTerms: input.brandTerms ?? null }).where(eq(seoIntelCompetitors.id, input.id));
    } else {
      await db
        .insert(seoIntelCompetitors)
        .values({ name: input.name, domain: input.domain, status: input.status, brandTerms: input.brandTerms ?? null })
        .onDuplicateKeyUpdate({ set: { name: input.name, status: input.status, brandTerms: input.brandTerms ?? null } });
    }
  } catch (err) {
    if (isMissingTable(err)) throw new CompetitorTablesMissingError();
    throw err;
  }
}
