/**
 * In-memory mock SEO provider.
 *
 * Serves realistic HVAC placeholder data and supports the Phase 2 work-queue
 * mutations (AI actions + status changes) against a module-local store so the
 * dashboard behaves like the real thing within a session. State is intentionally
 * NOT persisted — it resets on process restart. When the live providers land
 * this whole file is replaced; nothing else changes.
 */
import {
  actionToStatus,
  applyActionToProblems,
  hydrateOpportunity,
  type SeoAction,
  type SeoOpportunity,
  type SeoOpportunitySeed,
  type SeoOverview,
  type SeoStatus,
} from "@shared/seo";
import type { SeoDataProvider } from "./provider";

const SITE = "https://mechanicalenterprise.com";

const SEED: SeoOpportunitySeed[] = [
  {
    id: "opp-newark",
    priority: "high",
    page: "/hvac-newark-nj",
    url: `${SITE}/hvac-newark-nj`,
    title: "HVAC Newark NJ | Mechanical Enterprise",
    metaDescription: "HVAC services in Newark, NJ.",
    h1: "HVAC Services in Newark, NJ",
    issue: "Ranking #11 — one spot off page 1 for a high-volume local query",
    searchConsoleIssue: "Indexed, though submitted URL not selected as canonical",
    clicks: 58,
    impressions: 9840,
    ctr: 0.0059,
    position: 11.2,
    indexStatus: "indexed",
    status: "needs_review",
    category: "city_page",
    problems: ["thin_content", "weak_internal_links", "weak_meta"],
  },
  {
    id: "opp-heatpump",
    priority: "high",
    page: "/services/heat-pump-installation",
    url: `${SITE}/services/heat-pump-installation`,
    title: "Heat Pump Installation Services",
    metaDescription: "We install heat pumps.",
    h1: "Heat Pump Installation",
    issue: "High impressions, low CTR — title & meta not compelling",
    searchConsoleIssue: "Indexed",
    clicks: 74,
    impressions: 15230,
    ctr: 0.0049,
    position: 8.6,
    indexStatus: "indexed",
    status: "queued",
    category: "residential",
    problems: ["weak_title", "weak_meta", "missing_faq"],
  },
  {
    id: "opp-emergency",
    priority: "high",
    page: "/lp/emergency-hvac",
    url: `${SITE}/lp/emergency-hvac`,
    title: "Emergency HVAC Repair 24/7",
    metaDescription: "Emergency HVAC repair near you.",
    h1: "24/7 Emergency HVAC Repair",
    issue: "Not indexed — landing page excluded from Google's index",
    searchConsoleIssue: "Discovered – currently not indexed",
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    indexStatus: "discovered_not_indexed",
    status: "needs_review",
    category: "residential",
    problems: ["thin_content", "no_schema"],
  },
  {
    id: "opp-rebates-blog",
    priority: "medium",
    page: "/blog/nj-heat-pump-rebates-2026",
    url: `${SITE}/blog/nj-heat-pump-rebates-2026`,
    title: "NJ Heat Pump Rebates 2026: Complete Guide",
    metaDescription: "Everything about NJ heat pump rebates in 2026.",
    h1: "NJ Heat Pump Rebates in 2026",
    issue: "Position slipped from 4.1 to 6.8 over the last 28 days",
    searchConsoleIssue: "Indexed",
    clicks: 132,
    impressions: 11480,
    ctr: 0.0115,
    position: 6.8,
    indexStatus: "indexed",
    status: "optimizing",
    category: "blog",
    problems: ["cannibalization"],
  },
  {
    id: "opp-commercial",
    priority: "medium",
    page: "/commercial",
    url: `${SITE}/commercial`,
    title: "Commercial HVAC Services | Mechanical Enterprise",
    metaDescription: "Commercial HVAC installation, repair, and maintenance for NJ businesses.",
    h1: "Commercial HVAC Services",
    issue: "Cannibalization with /services — competing for the same query",
    searchConsoleIssue: "Indexed",
    clicks: 41,
    impressions: 6720,
    ctr: 0.0061,
    position: 14.3,
    indexStatus: "indexed",
    status: "needs_review",
    category: "commercial",
    problems: ["cannibalization", "weak_internal_links"],
  },
  {
    id: "opp-rebate-calc",
    priority: "medium",
    page: "/rebate-calculator",
    url: `${SITE}/rebate-calculator`,
    title: "HVAC Rebate Calculator",
    metaDescription: "Calculate your NJ HVAC rebates instantly.",
    h1: "HVAC Rebate Calculator",
    issue: "Slow LCP on mobile hurting rankings (Core Web Vitals)",
    searchConsoleIssue: "Indexed",
    clicks: 96,
    impressions: 8310,
    ctr: 0.0116,
    position: 9.9,
    indexStatus: "indexed",
    status: "published",
    category: "residential",
    problems: ["slow_lcp"],
  },
  {
    id: "opp-vrv",
    priority: "medium",
    page: "/lp/commercial-vrv",
    url: `${SITE}/lp/commercial-vrv`,
    title: "Commercial VRV/VRF Systems",
    metaDescription: "VRV and VRF systems for commercial buildings.",
    h1: "Commercial VRV / VRF Systems",
    issue: "Page 2 ranking with thin content vs. competitors",
    searchConsoleIssue: "Crawled – currently not indexed",
    clicks: 12,
    impressions: 3120,
    ctr: 0.0038,
    position: 17.4,
    indexStatus: "crawled_not_indexed",
    status: "waiting_for_indexing",
    category: "commercial",
    problems: ["thin_content", "no_schema", "missing_faq"],
  },
  {
    id: "opp-maintenance",
    priority: "low",
    page: "/maintenance",
    url: `${SITE}/maintenance`,
    title: "HVAC Maintenance Plans | Mechanical Enterprise",
    metaDescription: "Affordable HVAC maintenance plans in NJ.",
    h1: "HVAC Maintenance Plans",
    issue: "Missing Service schema — page is eligible for rich results",
    searchConsoleIssue: "Indexed",
    clicks: 63,
    impressions: 5140,
    ctr: 0.0123,
    position: 7.4,
    indexStatus: "indexed",
    status: "ranking_improved",
    category: "residential",
    problems: ["no_schema"],
  },
  {
    id: "opp-jersey-city",
    priority: "low",
    page: "/hvac-jersey-city-nj",
    url: `${SITE}/hvac-jersey-city-nj`,
    title: "HVAC Jersey City NJ",
    metaDescription: "HVAC in Jersey City.",
    h1: "HVAC Services in Jersey City, NJ",
    issue: "Thin content vs. competitors ranking above",
    searchConsoleIssue: "Indexed",
    clicks: 29,
    impressions: 4360,
    ctr: 0.0067,
    position: 13.1,
    indexStatus: "indexed",
    status: "queued",
    category: "city_page",
    problems: ["thin_content", "weak_internal_links", "weak_title"],
  },
  {
    id: "opp-furnace-blog",
    priority: "low",
    page: "/blog/how-to-size-a-furnace",
    url: `${SITE}/blog/how-to-size-a-furnace`,
    title: "How to Size a Furnace for Your Home",
    metaDescription: "A simple guide to furnace sizing.",
    h1: "How to Size a Furnace",
    issue: "Page 2 ranking — add FAQ + internal links to push to page 1",
    searchConsoleIssue: "Indexed",
    clicks: 47,
    impressions: 5980,
    ctr: 0.0079,
    position: 12.2,
    indexStatus: "indexed",
    status: "needs_review",
    category: "blog",
    problems: ["missing_faq", "weak_internal_links"],
  },
];

const OVERVIEW: SeoOverview = {
  organicClicks: 4820,
  impressions: 142350,
  ctr: 0.0339,
  averagePosition: 12.4,
  indexedPages: 186,
  notIndexedPages: 23,
  organicLeads: {
    thisMonth: 12,
    goal: 80,
  },
  deltas: {
    organicClicks: 0.124,
    impressions: 0.081,
    ctr: 0.006,
    averagePosition: -1.3,
  },
  rangeLabel: "Last 28 days",
};

export class MockSeoProvider implements SeoDataProvider {
  /** Live, mutable copy of the seed — mutations edit this in place. */
  private records: SeoOpportunitySeed[] = SEED.map((s) => ({ ...s, problems: [...s.problems] }));

  async getOverview(): Promise<SeoOverview> {
    return OVERVIEW;
  }

  async listOpportunities(): Promise<SeoOpportunity[]> {
    return this.records.map(hydrateOpportunity);
  }

  async getOpportunity(id: string): Promise<SeoOpportunity | null> {
    const rec = this.records.find((r) => r.id === id);
    return rec ? hydrateOpportunity(rec) : null;
  }

  async runAction(ids: string[], action: SeoAction): Promise<SeoOpportunity[]> {
    const target = new Set(ids);
    const nextStatus = actionToStatus(action);
    const updated: SeoOpportunity[] = [];
    for (const rec of this.records) {
      if (!target.has(rec.id)) continue;
      rec.problems = applyActionToProblems(rec.problems, action);
      rec.status = nextStatus;
      updated.push(hydrateOpportunity(rec));
    }
    return updated;
  }

  async setStatus(ids: string[], status: SeoStatus): Promise<SeoOpportunity[]> {
    const target = new Set(ids);
    const updated: SeoOpportunity[] = [];
    for (const rec of this.records) {
      if (!target.has(rec.id)) continue;
      rec.status = status;
      updated.push(hydrateOpportunity(rec));
    }
    return updated;
  }
}
