/**
 * SEO Intelligence — shared domain model (framework-free).
 *
 * Single source of truth for the SEO work-queue: the enums, the row/overview
 * shapes, the SEO-score formula, the filter predicates and the AI-action →
 * workflow-status transitions all live here so the server data provider, the
 * tRPC router and the React UI can never drift apart.
 *
 * FUTURE-READY: none of this depends on where the numbers come from. They are
 * served by the cache-backed GoogleSearchConsoleProvider
 * (server/services/seo/searchConsoleProvider) which reads the MySQL cache a sync
 * populates from Google Search Console. GA4 / the Indexing API / CRM funnel
 * attribution slot in behind the same provider interface — these types, labels,
 * scores and filters stay identical, so the UI does not need to be redesigned.
 */

/* ── Priority ───────────────────────────────────────────────────────────── */

export const SEO_PRIORITY = ["high", "medium", "low"] as const;
export type SeoPriority = (typeof SEO_PRIORITY)[number];

/* ── Workflow status ────────────────────────────────────────────────────── */

export const SEO_STATUS = [
  "needs_review",
  "queued",
  "optimizing",
  "waiting_review",
  "approved",
  "published",
  "waiting_for_indexing",
  "ranking_improved",
] as const;
export type SeoStatus = (typeof SEO_STATUS)[number];

export const SEO_STATUS_LABELS: Record<SeoStatus, string> = {
  needs_review: "Needs Review",
  queued: "Queued",
  optimizing: "Optimizing",
  waiting_review: "Waiting Review",
  approved: "Approved",
  published: "Published",
  waiting_for_indexing: "Request Reindex",
  ranking_improved: "Ranking Improved",
};

/**
 * The Phase-6 workflow order (for the status stepper / dropdown). Publishing is
 * intentionally a manual, non-automated terminal step — nothing here publishes.
 */
export const SEO_WORKFLOW_ORDER: SeoStatus[] = [
  "needs_review",
  "queued",
  "optimizing",
  "waiting_review",
  "approved",
  "published",
  "waiting_for_indexing",
  "ranking_improved",
];

/* ── Page category (drives the category filters) ────────────────────────── */

export const SEO_CATEGORY = ["commercial", "residential", "blog", "city_page", "other"] as const;
export type SeoCategory = (typeof SEO_CATEGORY)[number];

export const SEO_CATEGORY_LABELS: Record<SeoCategory, string> = {
  commercial: "Commercial",
  residential: "Residential",
  blog: "Blog",
  city_page: "City Page",
  other: "Other",
};

/* ── Indexing status ────────────────────────────────────────────────────── */

export const INDEX_STATUS = [
  "indexed",
  "crawled_not_indexed",
  "discovered_not_indexed",
  "excluded",
] as const;
export type IndexStatus = (typeof INDEX_STATUS)[number];

export const INDEX_STATUS_LABELS: Record<IndexStatus, string> = {
  indexed: "Indexed",
  crawled_not_indexed: "Crawled — not indexed",
  discovered_not_indexed: "Discovered — not indexed",
  excluded: "Excluded",
};

/** True for anything that is not fully in Google's index. */
export function isNotIndexed(status: IndexStatus): boolean {
  return status !== "indexed";
}

/* ── Problems (drive the SEO score) ─────────────────────────────────────── */

export const SEO_PROBLEM = [
  "thin_content",
  "missing_faq",
  "weak_title",
  "weak_meta",
  "no_schema",
  "weak_internal_links",
  "slow_lcp",
  "cannibalization",
] as const;
export type SeoProblem = (typeof SEO_PROBLEM)[number];

export const SEO_PROBLEM_LABELS: Record<SeoProblem, string> = {
  thin_content: "Thin Content",
  missing_faq: "Missing FAQ",
  weak_title: "Weak Title",
  weak_meta: "Weak Meta Description",
  no_schema: "No Schema",
  weak_internal_links: "Weak Internal Links",
  slow_lcp: "Slow LCP (Core Web Vitals)",
  cannibalization: "Keyword Cannibalization",
};

/** How many points each problem subtracts from a perfect 100. */
const PROBLEM_WEIGHTS: Record<SeoProblem, number> = {
  thin_content: 16,
  missing_faq: 8,
  weak_title: 11,
  weak_meta: 9,
  no_schema: 7,
  weak_internal_links: 9,
  slow_lcp: 13,
  cannibalization: 12,
};

/**
 * SEO score (0–100) derived purely from the outstanding problems. Deriving it
 * (rather than storing it) means an AI action that resolves a problem visibly
 * raises the score with no extra bookkeeping. Floored at 24 so a struggling
 * page never reads as a flat zero.
 */
export function computeSeoScore(problems: SeoProblem[]): number {
  const penalty = problems.reduce((sum, p) => sum + (PROBLEM_WEIGHTS[p] ?? 5), 0);
  return Math.max(24, 100 - penalty);
}

export function seoScoreBand(score: number): "good" | "fair" | "poor" {
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/* ── AI actions ─────────────────────────────────────────────────────────── */

export const SEO_ACTION = [
  "rewrite_title",
  "rewrite_meta",
  "expand_content",
  "generate_faq",
  "add_internal_links",
  "generate_schema",
  "request_reindex",
  "optimize_everything",
] as const;
export type SeoAction = (typeof SEO_ACTION)[number];

export const SEO_ACTION_LABELS: Record<SeoAction, string> = {
  rewrite_title: "Rewrite Title",
  rewrite_meta: "Rewrite Meta Description",
  expand_content: "Expand Content",
  generate_faq: "Generate FAQ",
  add_internal_links: "Add Internal Links",
  generate_schema: "Generate Schema",
  request_reindex: "Request Reindex",
  optimize_everything: "Optimize Everything",
};

/** The AI actions that target a single problem (excludes reindex / optimize-all). */
export const ACTION_RESOLVES: Partial<Record<SeoAction, SeoProblem>> = {
  rewrite_title: "weak_title",
  rewrite_meta: "weak_meta",
  expand_content: "thin_content",
  generate_faq: "missing_faq",
  add_internal_links: "weak_internal_links",
  generate_schema: "no_schema",
};

/** Where a page lands in the workflow after an AI action is triggered. */
export function actionToStatus(action: SeoAction): SeoStatus {
  return action === "request_reindex" ? "waiting_for_indexing" : "optimizing";
}

/**
 * Apply an AI action to a page's problem list (pure). Content actions clear the
 * problem they address; "Optimize Everything" clears all of them; reindex leaves
 * problems untouched (it is an indexing request, not a content edit).
 */
export function applyActionToProblems(problems: SeoProblem[], action: SeoAction): SeoProblem[] {
  if (action === "optimize_everything") return [];
  if (action === "request_reindex") return problems;
  const resolved = ACTION_RESOLVES[action];
  return resolved ? problems.filter((p) => p !== resolved) : problems;
}

/* ── Core shapes ────────────────────────────────────────────────────────── */

export type SeoOpportunity = {
  id: string;
  priority: SeoPriority;
  /** Page path, e.g. "/hvac-newark-nj". */
  page: string;
  /** Fully-qualified URL. */
  url: string;
  /** Current <title>. */
  title: string;
  /** Current <meta name="description">. */
  metaDescription: string;
  /** Current <h1>. */
  h1: string;
  /** Short human summary of the opportunity (table "Issue" column). */
  issue: string;
  /** The Search Console coverage/enhancement message. */
  searchConsoleIssue: string;
  clicks: number;
  impressions: number;
  /** Click-through rate as a fraction (0.021 === 2.1%). */
  ctr: number;
  /** Average Google position (lower is better; 0 === not ranking). */
  position: number;
  indexStatus: IndexStatus;
  /** ISO date of the last successful Google crawl/index, when known. */
  lastIndexedAt: string | null;
  status: SeoStatus;
  category: SeoCategory;
  problems: SeoProblem[];
  /** Derived from `problems` via computeSeoScore — always present on output. */
  seoScore: number;
  /** Derived prioritisation score (0–100) — see computeOpportunityScore. */
  opportunityScore: number;
};

/** Seed shape used by providers — scores are derived, never seeded. */
export type SeoOpportunitySeed = Omit<SeoOpportunity, "seoScore" | "opportunityScore">;

/** Attach the derived SEO + Opportunity scores to a seed record. */
export function hydrateOpportunity(seed: SeoOpportunitySeed): SeoOpportunity {
  return {
    ...seed,
    seoScore: computeSeoScore(seed.problems),
    opportunityScore: computeOpportunityScore(seed),
  };
}

export type SeoOverview = {
  organicClicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  indexedPages: number;
  notIndexedPages: number;
  /** The metric this dashboard exists for — organic-sourced qualified leads. */
  organicLeads: {
    thisMonth: number;
    goal: number;
  };
  /** Percentage / count deltas vs the previous window (fractions). */
  deltas: {
    organicClicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
  };
  rangeLabel: string;
};

/* ── Filters ────────────────────────────────────────────────────────────── */

export type SeoFilterKey =
  | "high_priority"
  | "not_indexed"
  | "low_ctr"
  | "page_2"
  | "commercial"
  | "residential"
  | "blog"
  | "city_page";

/** Attribute filters AND together; category filters OR within their group. */
export type SeoFilterGroup = "attribute" | "category";

export type SeoFilterDef = {
  key: SeoFilterKey;
  label: string;
  group: SeoFilterGroup;
  predicate: (o: SeoOpportunity) => boolean;
};

/** A page ranking on "page 2" of Google (positions 11–20). */
const PAGE_2_MIN = 11;
const PAGE_2_MAX = 20;
/** CTR below this (1%) is considered underperforming for its impressions. */
const LOW_CTR_THRESHOLD = 0.01;

export const SEO_FILTERS: SeoFilterDef[] = [
  { key: "high_priority", label: "High Priority", group: "attribute", predicate: (o) => o.priority === "high" },
  { key: "not_indexed", label: "Not Indexed", group: "attribute", predicate: (o) => isNotIndexed(o.indexStatus) },
  { key: "low_ctr", label: "Low CTR", group: "attribute", predicate: (o) => o.impressions > 0 && o.ctr < LOW_CTR_THRESHOLD },
  { key: "page_2", label: "Page 2 Rankings", group: "attribute", predicate: (o) => o.position >= PAGE_2_MIN && o.position <= PAGE_2_MAX },
  { key: "commercial", label: "Commercial", group: "category", predicate: (o) => o.category === "commercial" },
  { key: "residential", label: "Residential", group: "category", predicate: (o) => o.category === "residential" },
  { key: "blog", label: "Blog", group: "category", predicate: (o) => o.category === "blog" },
  { key: "city_page", label: "City Page", group: "category", predicate: (o) => o.category === "city_page" },
];

/* ── Derivation from Search Console signals ─────────────────────────────── */

/** The raw signals a sync has for one page — enough to derive priority/problems. */
export type SeoPageSignals = {
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
  previousClicks: number;
  indexStatus: IndexStatus;
};

/** A CTR at or below this (1%) underperforms for the impressions it earns. */
const LOW_CTR = 0.01;
/** Clicks below this share of the previous window count count as "declining". */
const DECLINE_RATIO = 0.8;

/**
 * Priority from live Search Console signals (Phase 3 rules):
 *   High   — position 8–20, OR CTR < 1% (with impressions), OR crawled-not-indexed
 *   Medium — position 21–40, OR declining clicks vs. the previous window
 *   Low    — everything else
 */
export function computePriority(s: SeoPageSignals): SeoPriority {
  if (s.indexStatus === "crawled_not_indexed") return "high";
  if (s.position >= 8 && s.position <= 20) return "high";
  if (s.impressions > 0 && s.ctr < LOW_CTR) return "high";
  if (s.position >= 21 && s.position <= 40) return "medium";
  if (s.previousClicks > 0 && s.clicks < s.previousClicks * DECLINE_RATIO) return "medium";
  return "low";
}

/** Whether clicks fell meaningfully vs. the previous window. */
export function isDeclining(s: Pick<SeoPageSignals, "clicks" | "previousClicks">): boolean {
  return s.previousClicks > 0 && s.clicks < s.previousClicks * DECLINE_RATIO;
}

/** Categorise a page from its path (drives the category filters). */
export function deriveCategory(path: string): SeoCategory {
  const p = path.toLowerCase();
  if (p === "/blog" || p.startsWith("/blog/")) return "blog";
  if (/^\/hvac-[a-z-]+-nj\b/.test(p)) return "city_page";
  if (p.startsWith("/commercial") || p.startsWith("/lp/commercial") || p.includes("commercial")) return "commercial";
  if (
    p.startsWith("/residential") ||
    p.startsWith("/services") ||
    p.startsWith("/maintenance") ||
    p.startsWith("/lp/")
  ) {
    return "residential";
  }
  return "other";
}

/**
 * Best-effort problem list derived from Search Console signals alone. This is a
 * heuristic stand-in until the AI Optimization sprint reads the actual page
 * (which will replace this with real on-page findings). Deterministic + deduped.
 */
export function deriveProblems(s: SeoPageSignals): SeoProblem[] {
  const out: SeoProblem[] = [];
  if (isNotIndexed(s.indexStatus)) out.push("thin_content");
  if (s.impressions > 0 && s.ctr < LOW_CTR) out.push("weak_title", "weak_meta");
  if (s.position >= 8 && s.position <= 20) out.push("weak_internal_links");
  if (s.position >= 21) out.push("thin_content");
  return Array.from(new Set(out));
}

/** One-line human summary for the table "Issue" column. */
export function summarizeIssue(s: SeoPageSignals): string {
  if (s.indexStatus === "crawled_not_indexed") return "Crawled — currently not indexed by Google";
  if (isNotIndexed(s.indexStatus)) return "Not indexed — excluded from Google's index";
  if (s.position >= 8 && s.position <= 20) return `Ranking #${s.position.toFixed(0)} — one push from page 1`;
  if (s.impressions > 0 && s.ctr < LOW_CTR) return "High impressions, low CTR — title & meta need work";
  if (isDeclining(s)) return "Declining clicks vs. the previous 90 days";
  if (s.position >= 21 && s.position <= 40) return "Page 3–4 ranking — needs stronger content";
  return "Stable — monitor";
}

/**
 * Filter opportunities. Within the "attribute" group every active filter must
 * pass (AND); within the "category" group any active filter may pass (OR); the
 * two groups are then AND-ed. So "High Priority + Commercial + Residential"
 * reads as: high-priority AND (commercial OR residential).
 */
export function applySeoFilters(items: SeoOpportunity[], activeKeys: SeoFilterKey[]): SeoOpportunity[] {
  if (activeKeys.length === 0) return items;
  const active = new Set(activeKeys);
  const defs = SEO_FILTERS.filter((f) => active.has(f.key));
  const attr = defs.filter((d) => d.group === "attribute");
  const cat = defs.filter((d) => d.group === "category");
  return items.filter(
    (o) => attr.every((d) => d.predicate(o)) && (cat.length === 0 || cat.some((d) => d.predicate(o)))
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * AI SEO Optimization Engine — Phases 2, 4, 7 (framework-free, deterministic).
 * Everything below is pure so the server, the tRPC layer, the mock AI provider
 * and the React workspace share one definition and can be unit-tested without a
 * DB or a network. NONE of this publishes — it scores, projects and models.
 * ════════════════════════════════════════════════════════════════════════ */

/* ── Search-position CTR curve (shared by score + projection) ───────────── */

/** Approximate organic SERP click-through rate for an average position. */
export function expectedCtrForPosition(position: number): number {
  if (position <= 0) return 0.01; // not ranking / unknown
  const curve: Array<[number, number]> = [
    [1, 0.28], [2, 0.15], [3, 0.1], [4, 0.07], [5, 0.055],
    [6, 0.043], [7, 0.035], [8, 0.03], [9, 0.026], [10, 0.023],
    [15, 0.015], [20, 0.011], [30, 0.007], [50, 0.004],
  ];
  for (const [pos, ctr] of curve) if (position <= pos) return ctr;
  return 0.003;
}

/* ── Opportunity Score (Phase 2) ────────────────────────────────────────── */

export type OpportunityScoreInput = {
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
  category: SeoCategory;
};

/** The Phase-2 weighting (must sum to 1.0). Exported for the score breakdown UI. */
export const OPPORTUNITY_WEIGHTS = {
  rankingPotential: 0.4,
  ctrImprovement: 0.25,
  searchVolume: 0.15,
  revenueEstimate: 0.1,
  competition: 0.1,
} as const;

/** Per-category revenue weight — commercial jobs are worth the most. */
const CATEGORY_REVENUE_WEIGHT: Record<SeoCategory, number> = {
  commercial: 1.0,
  city_page: 0.85,
  residential: 0.7,
  other: 0.5,
  blog: 0.35,
};

/** The five 0–1 sub-scores that make up the opportunity score. */
export function opportunityScoreComponents(s: OpportunityScoreInput): {
  rankingPotential: number;
  ctrImprovement: number;
  searchVolume: number;
  revenueEstimate: number;
  competition: number;
} {
  const p = s.position;
  // Ranking potential — highest in the "striking distance" band (page 2 → page 1).
  let rankingPotential: number;
  if (p <= 0) rankingPotential = 0.25;
  else if (p <= 3) rankingPotential = 0.15;
  else if (p <= 7) rankingPotential = 0.55;
  else if (p <= 20) rankingPotential = 1.0;
  else if (p <= 40) rankingPotential = 0.6;
  else rankingPotential = 0.3;

  // CTR improvement — how much of the expected-for-position CTR is being missed.
  const expected = expectedCtrForPosition(p);
  const ctrImprovement = s.impressions > 0 && expected > 0
    ? clamp01((expected - s.ctr) / expected)
    : 0;

  // Search volume — log-scaled impressions (≈50k impressions saturates).
  const searchVolume = s.impressions > 0 ? clamp01(Math.log10(s.impressions + 1) / Math.log10(50_000)) : 0;

  // Revenue estimate — category value.
  const revenueEstimate = CATEGORY_REVENUE_WEIGHT[s.category] ?? 0.5;

  // Competition — winnability; positions already on/near page 1 are most winnable.
  let competition: number;
  if (p <= 0) competition = 0.4;
  else if (p <= 3) competition = 0.3;
  else if (p <= 20) competition = 0.8;
  else if (p <= 40) competition = 0.5;
  else competition = 0.35;

  return { rankingPotential, ctrImprovement, searchVolume, revenueEstimate, competition };
}

/**
 * Opportunity Score (0–100) — the Phase-2 prioritisation number the dashboard
 * sorts by. Weighted blend of ranking potential (40%), CTR improvement (25%),
 * search volume (15%), revenue estimate (10%) and competition (10%).
 */
export function computeOpportunityScore(s: OpportunityScoreInput): number {
  const c = opportunityScoreComponents(s);
  const raw =
    OPPORTUNITY_WEIGHTS.rankingPotential * c.rankingPotential +
    OPPORTUNITY_WEIGHTS.ctrImprovement * c.ctrImprovement +
    OPPORTUNITY_WEIGHTS.searchVolume * c.searchVolume +
    OPPORTUNITY_WEIGHTS.revenueEstimate * c.revenueEstimate +
    OPPORTUNITY_WEIGHTS.competition * c.competition;
  return Math.round(clamp01(raw) * 100);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/* ── AI draft shapes (Phase 1, 3, 7 — store drafts only) ────────────────── */

export type AiFaqItem = { question: string; answer: string };
export type AiInternalLink = { anchor: string; targetPath: string; rationale: string };

export const AI_DRAFT_STATUS = ["draft", "edited", "approved"] as const;
export type AiDraftStatus = (typeof AI_DRAFT_STATUS)[number];

/** The editable AI draft stored per page. NEVER published automatically. */
export type AiOptimizationDraft = {
  pageId: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  faq: AiFaqItem[];
  internalLinks: AiInternalLink[];
  schema: Record<string, unknown> | null;
  contentExpansion: string | null;
  model: string;
  status: AiDraftStatus;
  updatedAt: string | null;
};

/** The editable draft field keys (used by generation + PATCH). */
export const AI_DRAFT_FIELDS = [
  "title",
  "metaDescription",
  "h1",
  "faq",
  "internalLinks",
  "schema",
  "contentExpansion",
] as const;
export type AiDraftField = (typeof AI_DRAFT_FIELDS)[number];

/** Which draft fields each AI action (re)generates. Reindex generates nothing. */
export const ACTION_DRAFT_FIELDS: Record<SeoAction, AiDraftField[]> = {
  rewrite_title: ["title", "h1"],
  rewrite_meta: ["metaDescription"],
  expand_content: ["contentExpansion"],
  generate_faq: ["faq"],
  add_internal_links: ["internalLinks"],
  generate_schema: ["schema"],
  request_reindex: [],
  optimize_everything: [...AI_DRAFT_FIELDS],
};

export function emptyDraft(pageId: number): AiOptimizationDraft {
  return {
    pageId,
    title: null,
    metaDescription: null,
    h1: null,
    faq: [],
    internalLinks: [],
    schema: null,
    contentExpansion: null,
    model: "none",
    status: "draft",
    updatedAt: null,
  };
}

/* ── Business Impact (Phase 4 — placeholder CRM conversion rates) ────────── */

/**
 * Placeholder CRM funnel conversion rates. These are estimates until the live
 * CRM attribution funnel lands; centralised here so the UI and API agree.
 */
export const CRM_FUNNEL = {
  clickToLead: 0.03,
  leadToAppointment: 0.45,
  appointmentToEstimate: 0.7,
  estimateToWon: 0.35,
  avgJobValue: 9000,
} as const;

export type FunnelStage = {
  clicks: number;
  leads: number;
  appointments: number;
  estimates: number;
  revenue: number;
};

/** Roll organic clicks down the CRM funnel to a revenue estimate. */
export function computeFunnel(clicks: number, cfg = CRM_FUNNEL): FunnelStage {
  const c = Math.max(0, clicks);
  const leads = c * cfg.clickToLead;
  const appointments = leads * cfg.leadToAppointment;
  const estimates = appointments * cfg.appointmentToEstimate;
  const won = estimates * cfg.estimateToWon;
  return {
    clicks: Math.round(c),
    leads: Math.round(leads),
    appointments: Math.round(appointments),
    estimates: Math.round(estimates),
    revenue: Math.round(won * cfg.avgJobValue),
  };
}

export type BusinessImpact = {
  current: FunnelStage;
  projected: FunnelStage;
  deltaRevenue: number;
  conversions: typeof CRM_FUNNEL;
};

/** Current vs. projected funnel from aggregate current/projected click counts. */
export function computeBusinessImpact(currentClicks: number, projectedClicks: number): BusinessImpact {
  const current = computeFunnel(currentClicks);
  const projected = computeFunnel(Math.max(currentClicks, projectedClicks));
  return {
    current,
    projected,
    deltaRevenue: projected.revenue - current.revenue,
    conversions: CRM_FUNNEL,
  };
}

/**
 * Estimate post-optimization clicks for one page (deterministic placeholder):
 * capture part of the CTR gap for the page's position, scaled by its
 * opportunity score. Never projects below current clicks.
 */
export function projectClicksForPage(input: {
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
  opportunityScore: number;
}): number {
  const expected = expectedCtrForPosition(input.position);
  const gap = Math.max(0, expected - input.ctr);
  const scoreFactor = clamp01(input.opportunityScore / 100);
  const captured = input.impressions * gap * (0.4 + 0.6 * scoreFactor);
  return Math.max(input.clicks, Math.round(input.clicks + captured));
}
