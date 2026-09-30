/**
 * Shared types for the Daily Market Intelligence Report (docs/market-intel-spec.md).
 * Used by both the server (server/services/seo/intel/*) and the client
 * (client/src/pages/MarketIntel.tsx) so the report/item shapes never drift.
 */
import type { SEO_INTEL_ITEM_KIND, SEO_INTEL_ITEM_STATUS, SEO_INTEL_DISMISS_REASON } from "../drizzle/schema";

export type SeoIntelItemKind = (typeof SEO_INTEL_ITEM_KIND)[number];
export type SeoIntelItemStatus = (typeof SEO_INTEL_ITEM_STATUS)[number];
export type SeoIntelDismissReason = (typeof SEO_INTEL_DISMISS_REASON)[number];

/** One row of §3a "search demand" evidence — a query's current state, for rising/unserved/decay classification. */
export type QueryDemandPoint = {
  query: string;
  /** Landing page path currently receiving this query, or null if unknown. */
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** A rising-query finding (§3a bullet 1). */
export type RisingQueryFinding = {
  query: string;
  page: string | null;
  position: number;
  impressions: number;
  /** Null when this is a brand-new query (no prior-week snapshot to compare against). */
  impressionsPctChange: number | null;
  isNew: boolean;
  hasAnsweringPage: boolean;
};

/** An unserved-query finding (§3a bullet 2). */
export type UnservedQueryFinding = {
  query: string;
  page: string | null;
  position: number;
  impressions: number;
  /** "position_over_20" / "intent_mismatch" only appear on findings stored before the 2026-09 calibration. */
  reason: "position_over_30" | "position_over_20" | "intent_mismatch" | "no_page";
  /** Set when several "{service} {town}" queries were clustered onto one city page. */
  clusterTown?: string;
  clusterQueries?: string[];
};

/** A decaying-page finding (§3a bullet 3). */
export type DecayingPageFinding = {
  page: string;
  clicks: number;
  previousClicks: number;
  previousImpressions: number;
  pctDown: number;
};

/** Report-only flag: a page whose search visibility collapsed, or that URL Inspection reports as not indexed. Heuristic — points at where to look. */
export type PossiblyDeindexedFinding = {
  page: string;
  previousImpressions: number;
  impressions: number;
  pctDown: number;
  indexStatus: "indexed" | "crawled_not_indexed" | "discovered_not_indexed" | "excluded";
  /** Search Console URL Inspection deep link for this page. */
  inspectUrl: string;
  /** Set when the page 301s elsewhere (netlify.toml), i.e. the loss is expected, not a de-index. */
  redirectsTo: string | null;
};

/** A cannibalization finding (§3a bullet 4). */
export type CannibalizationFinding = {
  query: string;
  pages: string[];
};

/** A seasonality finding (§3a bullet 5). */
export type SeasonalityFinding = {
  query: string;
  month: number; // 1-12, the month interest historically rises
  leadTimeWeeks: number;
  note: string;
};

/** §3b competitor page-diff classification. */
export type CompetitorDiffKind =
  | "new_offer"
  | "price_change"
  | "warranty_change"
  | "new_page"
  | "service_area_change"
  | "messaging_change"
  | "cosmetic";

export type CompetitorDiffFinding = {
  competitor: string;
  domain: string;
  pagePath: string;
  kind: CompetitorDiffKind;
  before: string | null;
  after: string | null;
  field: "title" | "meta" | "heading" | "offer";
};

export type MarketIntelSections = {
  searchDemand: {
    rising: RisingQueryFinding[];
    unserved: UnservedQueryFinding[];
    decaying: DecayingPageFinding[];
    cannibalization: CannibalizationFinding[];
    seasonality: SeasonalityFinding[];
    /** Absent on reports generated before this field existed. */
    possiblyDeindexed?: PossiblyDeindexedFinding[];
    skipped: boolean;
    skippedReason: string | null;
  };
  competitors: {
    diffs: CompetitorDiffFinding[];
    skippedDomains: string[];
  };
  positioning: {
    theirClaims: Array<{ differentiator: string; competitor: string; evidence: string }>;
    ourStaleClaims: Array<{ page: string; issue: string }>;
  };
  serp: { checked: boolean; reason: string };
  trends: { checked: boolean; reason: string; risingTerms: string[] };
  numbers: {
    clicks7d: number;
    clicksPrior7d: number;
    impressions7d: number;
    impressionsPrior7d: number;
    topRisingQueries: string[];
  };
};
