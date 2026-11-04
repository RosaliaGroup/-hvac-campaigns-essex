/**
 * Competitors dashboard — free data sources only (no paid SEO/traffic API).
 *
 * What a Similarweb-style view shows, and the free stand-in used here:
 *  - "How big is each competitor online"  → brand search demand from our own Google Ads
 *    Keyword Planner (monthly NJ searches for their name), shown as share of search.
 *  - "Which keywords they go after"        → Keyword Planner ideas seeded with their site URL.
 *  - "Are they running ads / what tools"   → tags found on their homepage (Google Ads, GTM,
 *    Meta pixel, call tracking, financing, chat) + links to the free Google Ads Transparency
 *    Center and Meta Ad Library pages for them.
 *  - "How fast they publish"               → their public sitemap (URL count, URLs updated in 30 days).
 *  - "Site quality / real-user traffic"    → Google PageSpeed Insights (mobile score; whether
 *    Chrome has enough real visitors to report field data).
 * None of these is a visit count. Nobody outside a company has its real traffic for free.
 *
 * Everything in this file is pure (no fetch, no DB) so it is unit-tested directly.
 */

export const OUR_DOMAIN = "mechanicalenterprise.com";
export const OUR_NAME = "Mechanical Enterprise";
export const OUR_BRAND_TERMS = ["mechanical enterprise", "mechanical enterprise llc", "mechanical enterprise nj"];

/** Suggested competitor sites (search results / AI-visibility sources, Nov 3 2026). Seeded as `suggested`; the owner confirms each in the CRM. */
export const SUGGESTED_COMPETITOR_DOMAINS: Array<{ name: string; domain: string }> = [
  { name: "A.J. Perri", domain: "ajperri.com" },
  { name: "Gold Medal", domain: "goldmedalservice.com" },
  { name: "Horizon", domain: "horizonservices.com" },
  // Cited by AI answers for our target queries (AI-visibility check, week of Nov 2 2026).
  { name: "Lehigh HVAC", domain: "lehighhvac.com" },
  { name: "Sam's Air Control", domain: "samsaircontrol.com" },
  { name: "Air Professionals", domain: "airprofessionalsnj.com" },
  { name: "NuWatt Energy", domain: "nuwattenergy.com" },
  { name: "C&C Air Conditioning", domain: "candcair.com" },
  { name: "Dimatic Control", domain: "dimaticcontrol.com" },
];

export type BrandDemand = {
  terms: string[];
  /** Sum of the terms' average monthly searches (NJ, Google Search). */
  avgMonthly: number | null;
  /** Last 12 months, oldest first. With source google_trends these are relative interest values, not counts. */
  monthly: Array<{ month: string; searches: number }>;
  /** Where the numbers came from. Absent on rows saved before the Trends fallback existed (= keyword_planner). */
  source?: "keyword_planner" | "google_trends";
  /** Google Trends only: 12-month average relative interest, scaled so all tracked brands are comparable. */
  relativeInterest?: number | null;
};

export type SiteKeyword = { keyword: string; avgMonthly: number; competition: string | null };

export type SitemapSummary = {
  found: boolean;
  urlCount: number;
  updatedLast30: number;
  blogUrlCount: number;
  /** Up to 5 most recently updated URLs. */
  recent: string[];
};

export type AdTech = {
  googleAds: boolean;
  googleTagManager: boolean;
  googleAnalytics: boolean;
  metaPixel: boolean;
  callTracking: string | null;
  financing: string[];
  chat: string | null;
  reviewsWidget: string | null;
};

export type SpeedResult = {
  mobileScore: number | null;
  lcpMs: number | null;
  /** Chrome UX Report has enough real visitors to report field data for this site. */
  hasFieldData: boolean;
};

export type DomainMetrics = {
  domain: string;
  name: string;
  isUs: boolean;
  capturedAt: string;
  brandDemand: BrandDemand | null;
  siteKeywords: SiteKeyword[];
  sitemap: SitemapSummary | null;
  adTech: AdTech | null;
  speed: SpeedResult | null;
  /** One line per source that could not run, so the page can say why a cell is empty. */
  errors: string[];
};

/* ── Domains and brand terms ─────────────────────────────────────────────── */

/** "https://www.AJPerri.com/path" → "ajperri.com". Null if it isn't a plausible host. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  if (s.split(".").some((p) => !p || p.startsWith("-") || p.endsWith("-"))) return null;
  return s;
}

/** Search terms people type for this brand: the name without punctuation, plus any extras. Lowercased, deduped, max 10. */
export function brandTermsFor(name: string, extra: string[] = []): string[] {
  const base = name.toLowerCase().replace(/[.&']/g, " ").replace(/\s+/g, " ").trim();
  const squashed = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (const t of [base, squashed, ...extra.map((e) => e.toLowerCase().trim())]) if (t) out.add(t);
  return Array.from(out).slice(0, 10);
}

/* ── Ad libraries (free, public) ─────────────────────────────────────────── */

export function adLibraryLinks(name: string, domain: string): { google: string; meta: string } {
  return {
    google: `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(domain)}`,
    meta: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(name)}`,
  };
}

/* ── Homepage tag detection ──────────────────────────────────────────────── */

const CALL_TRACKING: Array<[string, RegExp]> = [
  ["CallRail", /callrail\.com|cdn\.callrail/i],
  ["CallTrackingMetrics", /tctm\.co|calltrackingmetrics/i],
  ["Invoca", /invoca\.net|solutions\.invocacdn/i],
  ["ServiceTitan Dynamic Numbers", /servicetitan.*(dni|dynamic)|dni\.servicetitan/i],
];
const FINANCING: Array<[string, RegExp]> = [
  ["Synchrony", /synchrony/i],
  ["GreenSky", /greensky/i],
  ["Wisetack", /wisetack/i],
  ["Service Finance", /servicefinance/i],
  ["Hearth", /gethearth|hearth\.com/i],
  ["Affirm", /affirm\.com|cdn1\.affirm/i],
];
const CHAT: Array<[string, RegExp]> = [
  ["Podium", /podium\.com|connect\.podium/i],
  ["Birdeye", /birdeye\.com/i],
  ["LiveChat", /livechatinc\.com|cdn\.livechat/i],
  ["Intercom", /intercom\.io|widget\.intercom/i],
  ["Drift", /js\.driftt|drift\.com/i],
  ["Tidio", /tidio\.co/i],
  ["HubSpot chat", /js\.usemessages\.com|hs-scripts\.com/i],
  ["Scorpion chat", /scorpion\.co/i],
];
const REVIEWS: Array<[string, RegExp]> = [
  ["Birdeye", /birdeye\.com/i],
  ["Podium reviews", /podium\.com\/(reviews|widget)/i],
  ["NiceJob", /nicejob/i],
  ["Trustindex", /trustindex/i],
  ["Elfsight reviews", /elfsight/i],
];

function firstMatch(html: string, list: Array<[string, RegExp]>): string | null {
  for (const [name, re] of list) if (re.test(html)) return name;
  return null;
}

/** Pure — which marketing tags a homepage loads. A Google Ads (AW-) tag or Meta pixel usually means they buy ads. */
export function detectAdTech(html: string): AdTech {
  return {
    googleAds: /\bAW-\d{6,}|googleadservices\.com\/pagead\/conversion|google_conversion_id/i.test(html),
    googleTagManager: /googletagmanager\.com\/gtm\.js|\bGTM-[A-Z0-9]{4,}/.test(html),
    googleAnalytics: /\bG-[A-Z0-9]{6,}\b|google-analytics\.com\/(analytics|ga)\.js|googletagmanager\.com\/gtag\/js/.test(html),
    metaPixel: /connect\.facebook\.net\/[a-z_]+\/fbevents\.js|fbq\(\s*['"]init['"]/i.test(html),
    callTracking: firstMatch(html, CALL_TRACKING),
    financing: FINANCING.filter(([, re]) => re.test(html)).map(([n]) => n),
    chat: firstMatch(html, CHAT),
    reviewsWidget: firstMatch(html, REVIEWS),
  };
}

/* ── Sitemaps ────────────────────────────────────────────────────────────── */

export type ParsedSitemap = { isIndex: boolean; entries: Array<{ loc: string; lastmod: string | null }> };

/** Pure — parses a sitemap or sitemap index (no XML library; sitemaps are flat). */
export function parseSitemap(xml: string): ParsedSitemap {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const blockRe = isIndex ? /<sitemap>([\s\S]*?)<\/sitemap>/gi : /<url>([\s\S]*?)<\/url>/gi;
  const entries: ParsedSitemap["entries"] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml))) {
    const loc = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/i.exec(m[1])?.[1]?.trim();
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(m[1])?.[1]?.trim() ?? null;
    entries.push({ loc: loc.replace(/&amp;/g, "&"), lastmod });
  }
  return { isIndex, entries };
}

const BLOG_PATH_RE = /\/(blog|news|articles?|resources|learn|tips|insights)(\/|$)/i;

/** Pure — totals for the URLs of one site (already flattened from any index). */
export function summarizeSitemapUrls(entries: Array<{ loc: string; lastmod: string | null }>, now: Date): SitemapSummary {
  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const unique = new Map<string, string | null>();
  for (const e of entries) if (!unique.has(e.loc)) unique.set(e.loc, e.lastmod);
  const dated = Array.from(unique.entries())
    .map(([loc, lastmod]) => ({ loc, t: lastmod ? Date.parse(lastmod) : NaN }))
    .filter((e) => !Number.isNaN(e.t));
  const recent = dated.filter((e) => e.t >= cutoff && e.t <= now.getTime() + 24 * 3600 * 1000);
  return {
    found: unique.size > 0,
    urlCount: unique.size,
    updatedLast30: recent.length,
    blogUrlCount: Array.from(unique.keys()).filter((u) => BLOG_PATH_RE.test(u)).length,
    recent: recent.sort((a, b) => b.t - a.t).slice(0, 5).map((e) => e.loc),
  };
}

/** Pure — sitemap URLs listed in robots.txt. */
export function sitemapsFromRobots(robotsTxt: string): string[] {
  return robotsTxt
    .split("\n")
    .map((l) => /^\s*sitemap:\s*(\S+)/i.exec(l)?.[1])
    .filter((u): u is string => !!u);
}

/* ── Share of search and keyword gap ─────────────────────────────────────── */

export type ShareRow = { domain: string; name: string; isUs: boolean; searches: number; share: number };

/** Which source the brand numbers this week come from: Keyword Planner counts when any row has them, else Google Trends. */
export function brandMetricSource(rows: DomainMetrics[]): "keyword_planner" | "google_trends" | null {
  if (rows.some((r) => r.brandDemand?.avgMonthly != null)) return "keyword_planner";
  if (rows.some((r) => r.brandDemand?.relativeInterest != null)) return "google_trends";
  return null;
}

/** The brand number to show for one row under the week's source. */
export function brandValue(r: DomainMetrics, source: ReturnType<typeof brandMetricSource>): number | null {
  if (source === "keyword_planner") return r.brandDemand?.avgMonthly ?? null;
  if (source === "google_trends") return r.brandDemand?.relativeInterest ?? null;
  return null;
}

/** Pure — each brand's slice of the total brand searches (or Trends interest). Domains with no data are left out. */
export function shareOfSearch(rows: DomainMetrics[]): ShareRow[] {
  const source = brandMetricSource(rows);
  const withData = rows.filter((r) => brandValue(r, source) != null);
  const total = withData.reduce((s, r) => s + (brandValue(r, source) ?? 0), 0);
  return withData
    .map((r) => {
      const v = brandValue(r, source) ?? 0;
      return { domain: r.domain, name: r.name, isUs: r.isUs, searches: v, share: total > 0 ? v / total : 0 };
    })
    .sort((a, b) => b.searches - a.searches);
}

/* ── Google Trends (free, no key) ─────────────────────────────────────────── */

export type TrendsSeries = { keyword: string; points: Array<{ date: string; value: number }> };

/** Pure — strips Google's anti-JSON-hijacking prefix and parses. */
export function parseTrendsJson<T = unknown>(text: string): T {
  return JSON.parse(text.replace(/^\)\]\}',?\s*/, "")) as T;
}

/** Pure — one multiline widget response → a series per keyword (weekly points). */
export function trendsTimeline(keywords: string[], json: unknown): TrendsSeries[] {
  const data = (json as { default?: { timelineData?: Array<{ time?: string; value?: number[] }> } })?.default?.timelineData ?? [];
  return keywords.map((keyword, i) => ({
    keyword,
    points: data
      .filter((d) => d.time && Array.isArray(d.value))
      .map((d) => ({ date: new Date(Number(d.time) * 1000).toISOString().slice(0, 10), value: Number(d.value![i] ?? 0) })),
  }));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Pure — Trends compares at most 5 terms at a time, each batch scaled 0–100 to its own peak. Every batch
 * includes the same anchor term; batches are rescaled so the anchor's average matches batch 0, which makes
 * all brands comparable. Returns each keyword's 12-month average and monthly averages in that common scale.
 */
export function combineTrendsBatches(batches: TrendsSeries[][], anchor: string): Array<{ keyword: string; mean: number; monthly: Array<{ month: string; searches: number }> }> {
  const anchorMean = (b: TrendsSeries[]) => mean(b.find((s) => s.keyword === anchor)?.points.map((p) => p.value) ?? []);
  const base = batches.length ? anchorMean(batches[0]) : 0;
  const out = new Map<string, { keyword: string; mean: number; monthly: Array<{ month: string; searches: number }> }>();
  for (const batch of batches) {
    const a = anchorMean(batch);
    const factor = a > 0 && base > 0 ? base / a : 1;
    for (const s of batch) {
      if (out.has(s.keyword)) continue;
      const byMonth = new Map<string, number[]>();
      for (const p of s.points) {
        const m = p.date.slice(0, 7);
        byMonth.set(m, [...(byMonth.get(m) ?? []), p.value * factor]);
      }
      const round = (n: number) => Math.round(n * 10) / 10;
      out.set(s.keyword, {
        keyword: s.keyword,
        mean: round(mean(s.points.map((p) => p.value * factor))),
        monthly: Array.from(byMonth.entries()).sort(([x], [y]) => x.localeCompare(y)).slice(-12).map(([month, vs]) => ({ month, searches: round(mean(vs)) })),
      });
    }
  }
  return Array.from(out.values());
}

/** Pure — splits terms into Trends-sized batches (max 5), each led by the anchor. */
export function trendsBatches(terms: string[], anchor: string): string[][] {
  const others = Array.from(new Set(terms.filter((t) => t !== anchor)));
  const batches: string[][] = [];
  for (let i = 0; i < others.length; i += 4) batches.push([anchor, ...others.slice(i, i + 4)]);
  return batches.length ? batches : [[anchor]];
}

/** Brand words to ignore when comparing a competitor's keywords with ours (their own name isn't a gap for us). */
function stripBrand(keyword: string, brandTerms: string[]): boolean {
  const k = keyword.toLowerCase();
  return brandTerms.some((t) => t && k.includes(t));
}

export type KeywordGapRow = { keyword: string; avgMonthly: number; competitors: string[] };

/**
 * Pure — keywords Google associates with competitors' sites that we get no Search Console
 * impressions for. Brand names (theirs and ours) are excluded. Sorted by volume.
 */
export function keywordGap(
  competitors: Array<{ name: string; brandTerms: string[]; keywords: SiteKeyword[] }>,
  ourQueries: string[],
  limit = 30,
): KeywordGapRow[] {
  const ours = new Set(ourQueries.map((q) => q.toLowerCase().trim()));
  const allBrands = [...OUR_BRAND_TERMS, ...competitors.flatMap((c) => c.brandTerms)];
  const map = new Map<string, KeywordGapRow>();
  for (const c of competitors) {
    for (const kw of c.keywords) {
      const k = kw.keyword.toLowerCase().trim();
      if (!k || ours.has(k) || stripBrand(k, allBrands) || kw.avgMonthly <= 0) continue;
      const row = map.get(k) ?? { keyword: k, avgMonthly: kw.avgMonthly, competitors: [] };
      if (!row.competitors.includes(c.name)) row.competitors.push(c.name);
      row.avgMonthly = Math.max(row.avgMonthly, kw.avgMonthly);
      map.set(k, row);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.competitors.length - a.competitors.length || b.avgMonthly - a.avgMonthly)
    .slice(0, limit);
}

/** Pure — changes worth a line in the weekly report (vs last week's snapshot of the same domain). */
export function weeklyChanges(cur: DomainMetrics, prev: DomainMetrics | null): string[] {
  if (!prev) return [];
  const out: string[] = [];
  const a = cur.adTech, b = prev.adTech;
  if (a && b) {
    if (a.googleAds && !b.googleAds) out.push(`${cur.name} added a Google Ads tag to its homepage (likely started paid search).`);
    if (!a.googleAds && b.googleAds) out.push(`${cur.name} removed its Google Ads tag.`);
    if (a.metaPixel && !b.metaPixel) out.push(`${cur.name} added a Meta (Facebook) pixel.`);
    for (const f of a.financing) if (!b.financing.includes(f)) out.push(`${cur.name} now shows ${f} financing.`);
  }
  if (cur.sitemap && prev.sitemap && cur.sitemap.urlCount - prev.sitemap.urlCount >= 10) {
    out.push(`${cur.name} published ${cur.sitemap.urlCount - prev.sitemap.urlCount} new pages this week.`);
  }
  const sameSource = (cur.brandDemand?.source ?? "keyword_planner") === (prev.brandDemand?.source ?? "keyword_planner");
  const ca = sameSource ? cur.brandDemand?.avgMonthly : null, pa = sameSource ? prev.brandDemand?.avgMonthly : null;
  if (ca != null && pa != null && pa > 0 && Math.abs(ca - pa) / pa >= 0.25) {
    out.push(`${cur.name} brand searches ${ca > pa ? "up" : "down"} ${Math.round((Math.abs(ca - pa) / pa) * 100)}% (${pa} → ${ca}/mo).`);
  }
  return out;
}
