/**
 * AI-visibility check (market-intel addition): for each target query, does an AI answer engine name
 * Mechanical Enterprise, which competitors does it name, and which sources does it cite? Pure analysis +
 * week-over-week comparison; the engine clients and storage live in
 * server/services/seo/intel/aiVisibility.ts.
 */
import type { WatchedCompetitor } from "./competitorWatchlist";

export const AI_ENGINES = ["perplexity", "openai", "google_ai_overview"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

export const OWN_BRAND_RE = /mechanical\s+enterprise/i;
export const OWN_DOMAIN = "mechanicalenterprise.com";

/** Review / directory platforms: when these dominate the cited sources, reviews are what the engines read. */
export const REVIEW_PLATFORM_DOMAINS = ["yelp.com", "angi.com", "homeadvisor.com", "thumbtack.com", "bbb.org", "trustpilot.com", "google.com", "maps.google.com", "nextdoor.com", "facebook.com"];

export type EngineAnswer = { text: string; citations: string[] };

export type Observation = {
  engine: AiEngine;
  query: string;
  status: "ok" | "no_overview" | "error";
  named: boolean;
  /** Our domain is among the cited sources (independent of being named in the text). */
  citedUs: boolean;
  /** How we were named ("Mechanical Enterprise") or null. */
  namedAs: string | null;
  /** Watchlist competitors named in the answer text or whose domain is cited. */
  competitors: string[];
  /** Other company-looking names in the answer ("Foo HVAC"), not on the watchlist. */
  otherCompanies: string[];
  /** Registrable-ish domains of every cited source, de-duplicated, in citation order. */
  citedDomains: string[];
  /** Up to 10 cited URLs. */
  citations: string[];
  excerpt: string;
  error?: string | null;
};

export function domainOf(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const COMPANY_SUFFIX = "(?:HVAC|Heating|Cooling|Air Conditioning|Mechanical|Plumbing|Comfort|Climate|Services|Service|Contractors?|Home Services)";
const OTHER_COMPANY_RE = new RegExp(`\\b((?:[A-Z][A-Za-z&'.\\-]+\\s){1,3}${COMPANY_SUFFIX})\\b`, "g");

export function analyzeAnswer(
  query: string,
  engine: AiEngine,
  answer: EngineAnswer,
  watchlist: Pick<WatchedCompetitor, "name" | "domain">[],
): Observation {
  const text = answer.text ?? "";
  const citedDomains: string[] = [];
  for (const u of answer.citations) {
    const d = domainOf(u);
    if (d && !citedDomains.includes(d)) citedDomains.push(d);
  }
  const brandHit = text.match(OWN_BRAND_RE);
  const named = !!brandHit;
  const citedUs = citedDomains.some((d) => d === OWN_DOMAIN || d.endsWith(`.${OWN_DOMAIN}`));
  const lower = text.toLowerCase();
  const competitors = watchlist
    .filter((c) => lower.includes(c.name.toLowerCase()) || (!!c.domain && citedDomains.some((d) => d === c.domain.toLowerCase() || d.endsWith(`.${c.domain.toLowerCase()}`))))
    .map((c) => c.name);
  const known = new Set(watchlist.map((c) => c.name.toLowerCase()));
  const others: string[] = [];
  for (const m of Array.from(text.matchAll(OTHER_COMPANY_RE))) {
    const name = m[1].trim();
    if (OWN_BRAND_RE.test(name) || known.has(name.toLowerCase()) || Array.from(known).some((k) => name.toLowerCase().includes(k))) continue;
    if (!others.includes(name)) others.push(name);
  }
  return {
    engine,
    query,
    status: "ok",
    named,
    citedUs,
    namedAs: brandHit ? brandHit[0] : null,
    competitors,
    otherCompanies: others.slice(0, 8),
    citedDomains,
    citations: answer.citations.slice(0, 10),
    excerpt: text.slice(0, 600),
  };
}

/** Monday of the America/New_York calendar week containing `d`, as YYYY-MM-DD. */
export function weekStartET(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const local = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")));
  return new Date(local - dow * 86_400_000).toISOString().slice(0, 10);
}

export type EngineTally = { checked: number; named: number; failed: number };
export type WeekSummary = {
  weekOf: string;
  engines: Partial<Record<AiEngine, EngineTally>>;
  /** Queries at least one engine named us for. */
  namedQueries: string[];
  /** How many (engine, query) answers named each competitor. */
  competitorCounts: Record<string, number>;
  /** Most-cited domains across all answers. */
  topCited: Array<{ domain: string; count: number }>;
  /** Share of cited-source mentions that are review/directory platforms (0..1). */
  reviewPlatformShare: number;
  totalAnswers: number;
};

export function isReviewPlatform(domain: string): boolean {
  return REVIEW_PLATFORM_DOMAINS.some((r) => domain === r || domain.endsWith(`.${r}`));
}

export function summarizeWeek(weekOf: string, obs: Observation[]): WeekSummary {
  const engines: WeekSummary["engines"] = {};
  const named = new Set<string>();
  const comp: Record<string, number> = {};
  const cited: Record<string, number> = {};
  let citedTotal = 0;
  let reviewCited = 0;
  for (const o of obs) {
    const t = (engines[o.engine] ??= { checked: 0, named: 0, failed: 0 });
    if (o.status === "error") { t.failed++; continue; }
    t.checked++;
    if (o.named) { t.named++; named.add(o.query); }
    for (const c of o.competitors) comp[c] = (comp[c] ?? 0) + 1;
    for (const d of o.citedDomains) {
      cited[d] = (cited[d] ?? 0) + 1;
      citedTotal++;
      if (isReviewPlatform(d)) reviewCited++;
    }
  }
  return {
    weekOf,
    engines,
    namedQueries: Array.from(named).sort(),
    competitorCounts: comp,
    topCited: Object.entries(cited).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([domain, count]) => ({ domain, count })),
    reviewPlatformShare: citedTotal ? reviewCited / citedTotal : 0,
    totalAnswers: obs.length,
  };
}

export type WeekChange = {
  /** Change in the number of target queries at least one engine names us for. */
  namedQueriesDelta: number;
  gained: string[];
  lost: string[];
  newCompetitors: string[];
  droppedCompetitors: string[];
};

export function compareWeeks(cur: WeekSummary, prev: WeekSummary | null): WeekChange | null {
  if (!prev) return null;
  const curSet = new Set(cur.namedQueries);
  const prevSet = new Set(prev.namedQueries);
  return {
    namedQueriesDelta: cur.namedQueries.length - prev.namedQueries.length,
    gained: cur.namedQueries.filter((q) => !prevSet.has(q)),
    lost: prev.namedQueries.filter((q) => !curSet.has(q)),
    newCompetitors: Object.keys(cur.competitorCounts).filter((c) => !(c in prev.competitorCounts)),
    droppedCompetitors: Object.keys(prev.competitorCounts).filter((c) => !(c in cur.competitorCounts)),
  };
}

export type AiVisibilitySection = {
  /** False when no engine is configured / no data yet — the card then says why. */
  checked: boolean;
  reason: string;
  enginesConfigured: AiEngine[];
  current: WeekSummary | null;
  previous: WeekSummary | null;
  change: WeekChange | null;
  /** Queries (of the target list) no engine named us for in the current week, with the competitors/sources seen. */
  gaps: Array<{ query: string; competitors: string[]; citedDomains: string[] }>;
};
