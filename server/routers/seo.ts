import { protectedProcedure, router } from "../_core/trpc";

/**
 * SEO Intelligence router.
 *
 * PLACEHOLDER DATA ONLY — this endpoint intentionally returns static, mock
 * figures so the Marketing → SEO Intelligence dashboard can be built and
 * reviewed before any Search Console / GSC / third-party SEO API is wired in.
 * When a real integration lands, replace the bodies of these procedures with
 * live fetches (keeping the same return shapes) and the UI will not need to
 * change. No database table is involved yet, so there is no Drizzle migration.
 */

/** A single row in the "SEO Opportunities" table. */
export type SeoOpportunity = {
  id: string;
  /** Prioritisation for the fix — drives the coloured badge in the UI. */
  priority: "high" | "medium" | "low";
  /** Page path the opportunity applies to. */
  page: string;
  /** Short description of the SEO issue detected on the page. */
  issue: string;
  clicks: number;
  impressions: number;
  /** Click-through rate as a fraction (0.021 === 2.1%). */
  ctr: number;
  /** Average Google position (lower is better). */
  position: number;
  /** Suggested next action (label only — no automation yet). */
  action: string;
};

/** Top KPI figures shown in the dashboard cards. */
export type SeoOverview = {
  organicClicks: number;
  impressions: number;
  /** Site-wide CTR as a fraction (0.034 === 3.4%). */
  ctr: number;
  /** Average Google position across tracked queries. */
  averagePosition: number;
  indexedPages: number;
  notIndexedPages: number;
  /** Percentage deltas vs the previous 28-day window (fractions). */
  deltas: {
    organicClicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
  };
  /** Window the figures describe, for the dashboard subtitle. */
  rangeLabel: string;
};

const MOCK_OVERVIEW: SeoOverview = {
  organicClicks: 4820,
  impressions: 142350,
  ctr: 0.0339,
  averagePosition: 12.4,
  indexedPages: 186,
  notIndexedPages: 23,
  deltas: {
    organicClicks: 0.124,
    impressions: 0.081,
    ctr: 0.006,
    averagePosition: -1.3,
  },
  rangeLabel: "Last 28 days",
};

const MOCK_OPPORTUNITIES: SeoOpportunity[] = [
  {
    id: "opp-1",
    priority: "high",
    page: "/hvac-newark-nj",
    issue: "Ranking #11 — one spot from page 1 for a high-volume local query",
    clicks: 58,
    impressions: 9840,
    ctr: 0.0059,
    position: 11.2,
    action: "Add internal links + FAQ schema",
  },
  {
    id: "opp-2",
    priority: "high",
    page: "/services/heat-pump-installation",
    issue: "High impressions, low CTR — title tag not compelling",
    clicks: 74,
    impressions: 15230,
    ctr: 0.0049,
    position: 8.6,
    action: "Rewrite title & meta description",
  },
  {
    id: "opp-3",
    priority: "high",
    page: "/lp/emergency-hvac",
    issue: "Not indexed — excluded by 'crawled, currently not indexed'",
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    action: "Improve content depth, request indexing",
  },
  {
    id: "opp-4",
    priority: "medium",
    page: "/blog/nj-heat-pump-rebates-2026",
    issue: "Position slipped from 4.1 to 6.8 over 28 days",
    clicks: 132,
    impressions: 11480,
    ctr: 0.0115,
    position: 6.8,
    action: "Refresh content, update rebate figures",
  },
  {
    id: "opp-5",
    priority: "medium",
    page: "/commercial",
    issue: "Cannibalization with /services — competing for same query",
    clicks: 41,
    impressions: 6720,
    ctr: 0.0061,
    position: 14.3,
    action: "Consolidate & set canonical",
  },
  {
    id: "opp-6",
    priority: "medium",
    page: "/rebate-calculator",
    issue: "Slow LCP on mobile hurting rankings (Core Web Vitals)",
    clicks: 96,
    impressions: 8310,
    ctr: 0.0116,
    position: 9.9,
    action: "Optimize images, defer scripts",
  },
  {
    id: "opp-7",
    priority: "low",
    page: "/maintenance",
    issue: "Missing structured data for Service schema",
    clicks: 63,
    impressions: 5140,
    ctr: 0.0123,
    position: 7.4,
    action: "Add Service + Offer schema",
  },
  {
    id: "opp-8",
    priority: "low",
    page: "/hvac-jersey-city-nj",
    issue: "Thin content vs. competitors ranking above",
    clicks: 29,
    impressions: 4360,
    ctr: 0.0067,
    position: 13.1,
    action: "Expand with local specifics",
  },
];

export const seoRouter = router({
  /** Top KPI figures for the dashboard cards (placeholder data). */
  getOverview: protectedProcedure.query(async (): Promise<SeoOverview> => {
    return MOCK_OVERVIEW;
  }),

  /** Rows for the SEO Opportunities table (placeholder data). */
  getOpportunities: protectedProcedure.query(async (): Promise<SeoOpportunity[]> => {
    return MOCK_OPPORTUNITIES;
  }),
});
