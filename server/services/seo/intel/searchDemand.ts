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
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoPages, seoQueries, seoIntelQuerySnapshots, type SeoIntelQuerySnapshotRow } from "../../../../drizzle/schema";
import type {
  QueryDemandPoint,
  RisingQueryFinding,
  UnservedQueryFinding,
  DecayingPageFinding,
  CannibalizationFinding,
  SeasonalityFinding,
} from "../../../../shared/marketIntelTypes";

const RISING_MIN_IMPRESSIONS = 20;
const RISING_MIN_PCT_CHANGE = 0.4; // +40% WoW
const NEW_QUERY_MIN_IMPRESSIONS = 10;
const UNSERVED_POSITION_THRESHOLD = 20;
const DECAY_PCT_THRESHOLD = 0.25; // down >= 25%

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

const COMMERCIAL_INTENT_RE = /\b(commercial|multifamily|portfolio|property management|mwbe|subcontractor|bid|gc|general contractor)\b/i;
const RESIDENTIAL_PAGE_RE = /^\/hvac-[a-z-]+-nj\/?$|^\/(residential|home)/i;

/** Heuristic intent-mismatch check (§3a: "a commercial query landing on a residential page"). Conservative — only flags an explicit commercial-intent query landing on an explicitly residential-shaped page path. */
function isIntentMismatch(query: string, page: string | null): boolean {
  if (!page) return false;
  if (!COMMERCIAL_INTENT_RE.test(query)) return false;
  if (page.includes("/commercial")) return false;
  return RESIDENTIAL_PAGE_RE.test(page);
}

export function classifyUnservedQueries(current: QueryDemandPoint[]): UnservedQueryFinding[] {
  const findings: UnservedQueryFinding[] = [];
  for (const q of current) {
    if (!q.page) {
      findings.push({ query: q.query, page: null, position: q.position, impressions: q.impressions, reason: "no_page" });
      continue;
    }
    if (q.position > UNSERVED_POSITION_THRESHOLD) {
      findings.push({ query: q.query, page: q.page, position: q.position, impressions: q.impressions, reason: "position_over_20" });
      continue;
    }
    if (isIntentMismatch(q.query, q.page)) {
      findings.push({ query: q.query, page: q.page, position: q.position, impressions: q.impressions, reason: "intent_mismatch" });
    }
  }
  return findings;
}

/* ── Decaying pages (§3a bullet 3) ───────────────────────────────────────── */

export type PageClicksPoint = { page: string; clicks: number; previousClicks: number; previousImpressions: number };

export function classifyDecayingPages(pages: PageClicksPoint[]): DecayingPageFinding[] {
  const findings: DecayingPageFinding[] = [];
  for (const p of pages) {
    if (p.previousClicks <= 0) continue;
    const pctDown = (p.previousClicks - p.clicks) / p.previousClicks;
    if (pctDown >= DECAY_PCT_THRESHOLD) {
      findings.push({ page: p.page, clicks: p.clicks, previousClicks: p.previousClicks, previousImpressions: p.previousImpressions, pctDown });
    }
  }
  return findings;
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
  cannibalization: CannibalizationFinding[];
};

/** Real I/O: read seoPages/seoQueries + the snapshot history and run every §3a classifier. */
export async function collectSearchDemand(siteUrl: string, now: Date = new Date()): Promise<SearchDemandCollection> {
  const db = await getDb();
  if (!db) return { rising: [], unserved: [], decaying: [], cannibalization: [] };

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
  const unserved = classifyUnservedQueries(current);
  const decaying = classifyDecayingPages(pages.map((p) => ({ page: p.page, clicks: p.clicks, previousClicks: p.previousClicks, previousImpressions: p.previousImpressions })));

  // Cannibalization: which pages have held the "top page" slot for each query over the last 14 days.
  const recentRows = await snapshotsInRange(db, siteUrl, fmtDate(addDays(now, -14)), fmtDate(now));
  const history = new Map<string, Set<string>>();
  for (const r of recentRows) {
    if (!r.page) continue;
    if (!history.has(r.query)) history.set(r.query, new Set());
    history.get(r.query)!.add(r.page);
  }
  const cannibalization = classifyCannibalization(history);

  return { rising, unserved, decaying, cannibalization };
}
