/**
 * §3a "Search demand" classifiers (docs/market-intel-spec.md). Pure functions
 * first (cheaply fixture-testable per §7), a thin real-I/O collector second.
 *
 * Data source: server/services/seo/sync.ts's GSC cache (seoPages, seoQueries).
 * seoQueries is a point-in-time snapshot the daily sync fully REPLACES on every
 * run (see its own file header) — it has no week-over-week memory. To classify
 * "rising" / "first seen this week" for real (not a stand-in), this module
 * snapshots seoQueries into seoIntelQuerySnapshots once per day
 * (snapshotTodaysQueries()) before classifying against the snapshot history.
 *
 * KNOWN APPROXIMATION: "decaying pages... over 28 days" (§3a bullet 3) is
 * computed from seoPages.clicks vs previousClicks, which is a 90-day-window
 * vs prior-90-day-window comparison (see sync.ts's own comment), not a strict
 * 28-day window — same category of approximation server/services/seo/circuitBreaker.ts
 * already documents for its own "week-over-week" clicks check. Flagged here
 * and in the PR/build report rather than silently treated as exact.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../db";
import { getSiteOrigin } from "../../../integrations/searchConsole";
import { seoPages, seoQueries, seoIntelQuerySnapshots, type SeoIntelQuerySnapshotRow } from "../../../../drizzle/schema";
import { ALL_CITIES } from "../../../../client/src/data/njCounties";
import { COMPETITOR_WATCHLIST } from "../../../../shared/competitorWatchlist";
import type {
  QueryDemandPoint,
  RisingQueryFinding,
  UnservedQueryFinding,
  DecayingPageFinding,
  PossiblyDeindexedFinding,
  CannibalizationFinding,
  SeasonalityFinding,
} from "../../../../shared/marketIntelTypes";

const RISING_MIN_IMPRESSIONS = 20;
const RISING_MIN_PCT_CHANGE = 0.4; // +40% WoW
const NEW_QUERY_MIN_IMPRESSIONS = 10;
/** A query is "served" if ANY of our pages ranks at or better than this. */
const UNSERVED_RANK_EXCLUSION = 30;
const UNSERVED_MIN_IMPRESSIONS = 20;
const DECAY_PCT_THRESHOLD = 0.25; // down >= 25%
/** Decay needs real prior traffic to fall from — impressions alone never qualify. */
const DECAY_MIN_PRIOR_CLICKS = 10;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/* ── Rising queries (§3a bullet 1) ───────────────────────────────────────── */

export type RisingQueryInput = {
  current: QueryDemandPoint[];
  /** Query -> impressions from ~7 days ago (closest snapshot in the 6-8 day lookback). Absent key = no prior snapshot. */
  priorWeekImpressions: Map<string, number>;
  /** Queries seen at all in the 7-28 day lookback (for "new this week" — present in current but NOT here). */
  seenInPriorMonth: Set<string>;
};

export function classifyRisingQueries(input: RisingQueryInput): RisingQueryFinding[] {
  const findings: RisingQueryFinding[] = [];
  for (const q of input.current) {
    const priorImpressions = input.priorWeekImpressions.get(q.query);
    const isNew = !input.seenInPriorMonth.has(q.query);

    if (isNew) {
      if (q.impressions >= NEW_QUERY_MIN_IMPRESSIONS) {
        findings.push({
          query: q.query, page: q.page, position: q.position, impressions: q.impressions,
          impressionsPctChange: null, isNew: true, hasAnsweringPage: !!q.page,
        });
      }
      continue;
    }

    if (q.impressions < RISING_MIN_IMPRESSIONS) continue;
    if (priorImpressions === undefined || priorImpressions <= 0) continue;
    const pctChange = (q.impressions - priorImpressions) / priorImpressions;
    if (pctChange >= RISING_MIN_PCT_CHANGE) {
      findings.push({
        query: q.query, page: q.page, position: q.position, impressions: q.impressions,
        impressionsPctChange: pctChange, isNew: false, hasAnsweringPage: !!q.page,
      });
    }
  }
  return findings;
}

/* ── Unserved queries (§3a bullet 2) ─────────────────────────────────────── */

const NEAR_ME_RE = /\bnear[\s-]*me\b/i;

/**
 * Competitor brand terms. Never match a bare town or generic word (Springfield, Horizon): each term
 * is a phrase that only a brand search would contain. The watchlist-coverage test fails if a
 * watchlist competitor is added without a term here.
 */
export const COMPETITOR_BRAND_TERMS: Record<string, string[]> = {
  "A.J. Perri": ["aj perri", "a j perri", "perri"],
  "Gold Medal": ["gold medal"],
  "Horizon": ["horizon services", "horizon hvac", "horizon heating"],
  "Hutchinson": ["hutchinson"],
  "Reiner Group": ["reiner group", "reiner"],
  "Air2Cool": ["air2cool", "air 2 cool"],
  "Springfield Heating & AC": ["springfield heating"],
  "Echelon Services": ["echelon services", "echelon"],
  "OM HVAC": ["om hvac"],
};

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function brandTermsFromWatchlist(): string[] {
  const terms: string[] = [];
  for (const c of COMPETITOR_WATCHLIST) terms.push(...(COMPETITOR_BRAND_TERMS[c.name] ?? []), normalizeText(c.name));
  return Array.from(new Set(terms.map(normalizeText).filter((t) => t.length >= 4)));
}

function containsPhrase(normalizedQuery: string, normalizedPhrase: string): boolean {
  return ` ${normalizedQuery} `.includes(` ${normalizedPhrase} `);
}

/** Service words that make a "{service} {town}" query. */
const SERVICE_TERM_RE = /\b(hvac|ac|a c|air conditioning|air conditioner|furnace|heat pump|heating|cooling|boiler|ductless|mini split|repair|repairs|install|installation|installer|replacement|contractor|contractors|company|companies|service|services|maintenance|tune up|emergency)\b/;

/** Longest-first so "west orange" wins over "orange". */
const TOWN_PHRASES = ALL_CITIES.map((c) => ({ phrase: normalizeText(c.city), city: c.city, slug: c.slug })).sort((a, b) => b.phrase.length - a.phrase.length);

/** The NJ town in a "{service} {town}" query, or null when the query isn't one. */
export function townServiceMatch(query: string): { city: string; slug: string } | null {
  const n = normalizeText(query);
  if (!SERVICE_TERM_RE.test(n)) return null;
  const hit = TOWN_PHRASES.find((t) => containsPhrase(n, t.phrase));
  return hit ? { city: hit.city, slug: hit.slug } : null;
}

const pathOf = (p: string) => p.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";

export type UnservedOptions = {
  /** Paths of every page we have (seoPages.page). Omitted → the canonical /hvac-{town}-nj page is assumed to exist. */
  cityPages?: Iterable<string>;
  /** Override the competitor brand phrases (default: COMPETITOR_BRAND_TERMS via the watchlist). */
  competitorBrands?: string[];
};

type QueryGroup = { query: string; rows: QueryDemandPoint[]; impressions: number; bestRankedRow: QueryDemandPoint | null; bestPosition: number | null };

/**
 * Unserved = we have no page that ranks in the top 30 for it, it has real demand, and it isn't a
 * brand/near-me query we can't or shouldn't serve. "{service} {town}" queries cluster onto that
 * town's city page (one finding per town, not one per phrasing).
 */
export function classifyUnservedQueries(current: QueryDemandPoint[], options: UnservedOptions = {}): UnservedQueryFinding[] {
  const brands = (options.competitorBrands ?? brandTermsFromWatchlist()).map(normalizeText).filter(Boolean);
  const pages = options.cityPages ? new Set(Array.from(options.cityPages, pathOf)) : null;

  // 1) group rows by query (a query can have several landing pages)
  const groups = new Map<string, QueryGroup>();
  for (const r of current) {
    const g = groups.get(r.query) ?? { query: r.query, rows: [], impressions: 0, bestRankedRow: null, bestPosition: null };
    g.rows.push(r);
    g.impressions += r.impressions;
    // A row with no page attribution still carries the site's real position for the query (GSC query-only rows), so it counts toward "we rank".
    if (Number.isFinite(r.position) && r.position > 0 && (g.bestPosition === null || r.position < g.bestPosition)) g.bestPosition = r.position;
    if (r.page && (!g.bestRankedRow || r.position < g.bestRankedRow.position)) g.bestRankedRow = r;
    groups.set(r.query, g);
  }

  // 2) exclusions that apply to every query, clustered or not
  const eligible: QueryGroup[] = [];
  groups.forEach((g) => {
    if (NEAR_ME_RE.test(g.query)) return;
    const nq = normalizeText(g.query);
    if (brands.some((b) => containsPhrase(nq, b))) return;
    if (g.bestPosition !== null && g.bestPosition <= UNSERVED_RANK_EXCLUSION) return; // the site already ranks top-30 for it (any page, attributed or not)
    eligible.push(g);
  });

  const findings: UnservedQueryFinding[] = [];
  const clusters = new Map<string, { city: string; slug: string; members: QueryGroup[] }>();

  for (const g of eligible) {
    const town = townServiceMatch(g.query);
    if (town) {
      const c = clusters.get(town.slug) ?? { city: town.city, slug: town.slug, members: [] };
      c.members.push(g);
      clusters.set(town.slug, c);
      continue;
    }
    if (g.impressions < UNSERVED_MIN_IMPRESSIONS) continue;
    if (!g.bestRankedRow) {
      findings.push({ query: g.query, page: null, position: g.bestPosition ?? g.rows[0].position, impressions: g.impressions, reason: "no_page" });
    } else {
      findings.push({ query: g.query, page: g.bestRankedRow.page, position: g.bestRankedRow.position, impressions: g.impressions, reason: "position_over_30" });
    }
  }

  // 3) one finding per town cluster, anchored on the matching city page
  clusters.forEach((c) => {
    const total = c.members.reduce((s, m) => s + m.impressions, 0);
    if (total < UNSERVED_MIN_IMPRESSIONS) return;
    const members = [...c.members].sort((a, b) => b.impressions - a.impressions);
    const cityPage = `/hvac-${c.slug}-nj`;
    const hasPage = pages ? pages.has(cityPage) : true;
    const positions = members.map((m) => m.bestPosition).filter((x): x is number => x !== null);
    findings.push({
      query: members[0].query,
      page: hasPage ? cityPage : null,
      position: positions.length ? Math.min(...positions) : members[0].rows[0].position,
      impressions: total,
      reason: hasPage ? "position_over_30" : "no_page",
      clusterTown: c.city,
      clusterQueries: members.map((m) => m.query).slice(0, 25),
    });
  });

  return findings;
}

/* ── Decaying pages (§3a bullet 3) ───────────────────────────────────────── */

export type PageClicksPoint = { page: string; clicks: number; previousClicks: number; previousImpressions: number };

/** Decaying = at least 10 prior clicks AND clicks down at least 25%. Impressions alone never qualify. */
export function classifyDecayingPages(pages: PageClicksPoint[]): DecayingPageFinding[] {
  const findings: DecayingPageFinding[] = [];
  for (const p of pages) {
    if (p.previousClicks < DECAY_MIN_PRIOR_CLICKS) continue;
    const pctDown = (p.previousClicks - p.clicks) / p.previousClicks;
    if (pctDown >= DECAY_PCT_THRESHOLD) {
      findings.push({ page: p.page, clicks: p.clicks, previousClicks: p.previousClicks, previousImpressions: p.previousImpressions, pctDown });
    }
  }
  return findings;
}

/* ── Possibly de-indexed (report-only; no item, no lane) ─────────────────── */

const DEINDEX_MIN_PRIOR_IMPRESSIONS = 200;
const DEINDEX_MAX_REMAINING_FRACTION = 0.05; // >=95% of prior impressions gone
const DEINDEX_INSPECTED_MIN_PRIOR_IMPRESSIONS = 50;
const DEINDEX_REPORT_CAP = 15;

export type PageIndexPoint = {
  page: string;
  impressions: number;
  previousImpressions: number;
  indexStatus: "indexed" | "crawled_not_indexed" | "discovered_not_indexed" | "excluded";
};

/** Deep link into Search Console's URL Inspection for one URL of the property. */
export function buildInspectUrl(siteUrl: string, origin: string, page: string): string {
  const full = `${origin.replace(/\/+$/, "")}${page.startsWith("/") ? page : `/${page}`}`;
  return `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(siteUrl)}&id=${encodeURIComponent(full)}`;
}

/** `from` → `to` for every exact-path redirect rule in a netlify.toml (wildcard/splat rules are skipped). */
export function parseNetlifyRedirects(toml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of toml.split(/^\s*\[\[redirects\]\]\s*$/m).slice(1)) {
    const from = /^\s*from\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    const to = /^\s*to\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    const status = Number(/^\s*status\s*=\s*(\d+)/m.exec(block)?.[1] ?? 301);
    if (!from || !to || from.includes("*") || from.includes(":") || status < 300 || status >= 400) continue;
    map.set(pathOf(from), to);
  }
  return map;
}

/**
 * A page that had real demand and now shows almost none — or that URL Inspection already reports as
 * not indexed — is flagged "possibly de-indexed" with a URL Inspection link. A page that 301s
 * elsewhere is still listed but marked (redirectsTo) so it isn't mistaken for a lost page.
 * Heuristic only: GSC gives no daily "was deindexed" signal, so this points at where to look.
 */
export function classifyPossiblyDeindexed(
  pages: PageIndexPoint[],
  ctx: { siteUrl: string; origin: string; redirects?: Map<string, string> },
): PossiblyDeindexedFinding[] {
  const findings: PossiblyDeindexedFinding[] = [];
  for (const p of pages) {
    const collapsed = p.previousImpressions >= DEINDEX_MIN_PRIOR_IMPRESSIONS && p.impressions <= p.previousImpressions * DEINDEX_MAX_REMAINING_FRACTION;
    const inspectedNotIndexed = p.indexStatus !== "indexed" && p.previousImpressions >= DEINDEX_INSPECTED_MIN_PRIOR_IMPRESSIONS;
    if (!collapsed && !inspectedNotIndexed) continue;
    findings.push({
      page: p.page,
      previousImpressions: p.previousImpressions,
      impressions: p.impressions,
      pctDown: p.previousImpressions > 0 ? (p.previousImpressions - p.impressions) / p.previousImpressions : 0,
      indexStatus: p.indexStatus,
      inspectUrl: buildInspectUrl(ctx.siteUrl, ctx.origin, p.page),
      redirectsTo: ctx.redirects?.get(pathOf(p.page)) ?? null,
    });
  }
  return findings.sort((a, b) => b.previousImpressions - a.previousImpressions).slice(0, DEINDEX_REPORT_CAP);
}

/* ── Cannibalization (§3a bullet 4) ──────────────────────────────────────── */

/** history: query -> distinct pages that have held the "top page" slot for it across recent snapshots. */
export function classifyCannibalization(history: Map<string, Set<string>>): CannibalizationFinding[] {
  const findings: CannibalizationFinding[] = [];
  for (const query of Array.from(history.keys())) {
    const pages = history.get(query)!;
    if (pages.size >= 2) {
      findings.push({ query, pages: (Array.from(pages) as string[]).sort() });
    }
  }
  return findings;
}

/* ── Seasonality (§3a bullet 5) ──────────────────────────────────────────── */

export type MonthlyInterestSeries = { query: string; monthlyInterest: number[] /* index 0 = Jan .. 11 = Dec, 12 entries */ };

const SEASONALITY_RISE_THRESHOLD = 0.3; // next month's interest >= 30% above this month's

/** Flags a query whose interest historically jumps >=30% next month — "starts rising in ~2 weeks" (spec's own approximation: month-boundary granularity, ~2-week lead framed loosely). */
export function classifySeasonality(series: MonthlyInterestSeries[], now: Date = new Date()): SeasonalityFinding[] {
  const findings: SeasonalityFinding[] = [];
  const currentMonthIdx = now.getUTCMonth(); // 0-11
  const nextMonthIdx = (currentMonthIdx + 1) % 12;
  for (const s of series) {
    if (s.monthlyInterest.length !== 12) continue;
    const thisMonth = s.monthlyInterest[currentMonthIdx];
    const nextMonth = s.monthlyInterest[nextMonthIdx];
    if (thisMonth <= 0) continue;
    const rise = (nextMonth - thisMonth) / thisMonth;
    if (rise >= SEASONALITY_RISE_THRESHOLD) {
      findings.push({
        query: s.query,
        month: nextMonthIdx + 1,
        leadTimeWeeks: 2,
        note: `${s.query}: interest historically rises ${(rise * 100).toFixed(0)}% heading into month ${nextMonthIdx + 1} — lead it now.`,
      });
    }
  }
  return findings;
}

/* ── Real I/O: snapshot + collect ────────────────────────────────────────── */

/** sha256(siteUrl+query+date) — see drizzle/schema.ts's seoIntelQuerySnapshots.snapshotKey doc. */
function querySnapshotKey(siteUrl: string, query: string, snapshotDate: string): string {
  return createHash("sha256").update(`${siteUrl}\n${query}\n${snapshotDate}`).digest("hex");
}

/** Snapshot today's seoQueries into seoIntelQuerySnapshots (idempotent per siteUrl+query+day via snapshotKey's unique index). Call once per report run, before classifying. */
export async function snapshotTodaysQueries(siteUrl: string, now: Date = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = fmtDate(now);
  const rows = await db.select().from(seoQueries).where(eq(seoQueries.siteUrl, siteUrl));
  let count = 0;
  for (const r of rows) {
    await db
      .insert(seoIntelQuerySnapshots)
      .values({
        siteUrl, query: r.query, page: r.page, clicks: r.clicks, impressions: r.impressions,
        ctr: r.ctr, position: r.position, snapshotDate: today,
        snapshotKey: querySnapshotKey(siteUrl, r.query, today),
      })
      .onDuplicateKeyUpdate({ set: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, page: r.page } });
    count++;
  }
  return count;
}

async function snapshotsInRange(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, siteUrl: string, start: string, end: string): Promise<SeoIntelQuerySnapshotRow[]> {
  return db
    .select()
    .from(seoIntelQuerySnapshots)
    .where(and(eq(seoIntelQuerySnapshots.siteUrl, siteUrl), gte(seoIntelQuerySnapshots.snapshotDate, start), lte(seoIntelQuerySnapshots.snapshotDate, end)));
}

export type SearchDemandCollection = {
  rising: RisingQueryFinding[];
  unserved: UnservedQueryFinding[];
  decaying: DecayingPageFinding[];
  possiblyDeindexed: PossiblyDeindexedFinding[];
  cannibalization: CannibalizationFinding[];
};

/** Best-effort read of the repo's own netlify.toml; an unreadable file just means no redirect annotations. */
function loadNetlifyRedirects(): Map<string, string> {
  try {
    return parseNetlifyRedirects(readFileSync(path.resolve(import.meta.dirname, "../../../../netlify.toml"), "utf8"));
  } catch {
    return new Map();
  }
}

/** Real I/O: read seoPages/seoQueries + the snapshot history and run every §3a classifier. */
export async function collectSearchDemand(siteUrl: string, now: Date = new Date()): Promise<SearchDemandCollection> {
  const db = await getDb();
  if (!db) return { rising: [], unserved: [], decaying: [], possiblyDeindexed: [], cannibalization: [] };

  const pages = await db.select().from(seoPages).where(eq(seoPages.siteUrl, siteUrl));
  const queries = await db.select().from(seoQueries).where(eq(seoQueries.siteUrl, siteUrl));

  const current: QueryDemandPoint[] = queries.map((q) => ({
    query: q.query, page: q.page, clicks: q.clicks, impressions: q.impressions, ctr: Number(q.ctr), position: Number(q.position),
  }));

  // Prior-week snapshot: closest day in the 6-8-day-ago window.
  const priorWeekRows = await snapshotsInRange(db, siteUrl, fmtDate(addDays(now, -8)), fmtDate(addDays(now, -6)));
  const priorWeekImpressions = new Map<string, number>();
  for (const r of priorWeekRows) {
    // Keep the row closest to exactly 7 days ago if a query appears on more than one day in the window.
    if (!priorWeekImpressions.has(r.query)) priorWeekImpressions.set(r.query, r.impressions);
  }

  // Prior-month lookback (7-28 days ago) — anything seen there is NOT "new".
  const priorMonthRows = await snapshotsInRange(db, siteUrl, fmtDate(addDays(now, -28)), fmtDate(addDays(now, -7)));
  const seenInPriorMonth = new Set(priorMonthRows.map((r) => r.query));

  const rising = classifyRisingQueries({ current, priorWeekImpressions, seenInPriorMonth });
  const unserved = classifyUnservedQueries(current, { cityPages: pages.map((p) => p.page) });
  const decaying = classifyDecayingPages(pages.map((p) => ({ page: p.page, clicks: p.clicks, previousClicks: p.previousClicks, previousImpressions: p.previousImpressions })));

  const possiblyDeindexed = classifyPossiblyDeindexed(
    pages.map((p) => ({ page: p.page, impressions: p.impressions, previousImpressions: p.previousImpressions, indexStatus: p.indexStatus })),
    { siteUrl, origin: getSiteOrigin(), redirects: loadNetlifyRedirects() },
  );

  // Cannibalization: which pages have held the "top page" slot for each query over the last 14 days.
  const recentRows = await snapshotsInRange(db, siteUrl, fmtDate(addDays(now, -14)), fmtDate(now));
  const history = new Map<string, Set<string>>();
  for (const r of recentRows) {
    if (!r.page) continue;
    if (!history.has(r.query)) history.set(r.query, new Set());
    history.get(r.query)!.add(r.page);
  }
  const cannibalization = classifyCannibalization(history);

  return { rising, unserved, decaying, possiblyDeindexed, cannibalization };
}
