/**
 * SEO data-provider seam.
 *
 * The tRPC router talks ONLY to this interface — it never knows whether the
 * numbers come from an in-memory mock, Google Search Console, GA4 or the
 * Indexing API. That is the whole point of Phase 2's "future ready" rule:
 * connecting the real sources means writing a new class that implements
 * `SeoDataProvider` and returning it from `getSeoProvider()`. No router change,
 * no UI change.
 *
 * Live (Phase 3): GoogleSearchConsoleProvider serves clicks / impressions / CTR
 * / position / coverage from the MySQL cache that runSeoSync populates from
 * Google Search Console. Still on the roadmap behind this same interface:
 *   - request_reindex → call the Indexing API (AI Optimization sprint)
 *   - organicLeads    → CRM funnel attribution (Organic → Leads → … → Revenue)
 */
import type {
  SeoAction,
  SeoOpportunity,
  SeoOverview,
  SeoStatus,
} from "@shared/seo";
import { GoogleSearchConsoleProvider } from "./searchConsoleProvider";

export interface SeoDataProvider {
  /** Top KPI figures for the dashboard cards. */
  getOverview(): Promise<SeoOverview>;
  /** Every opportunity row (unfiltered — filtering is a presentation concern). */
  listOpportunities(): Promise<SeoOpportunity[]>;
  /** A single opportunity by id, or null if it no longer exists. */
  getOpportunity(id: string): Promise<SeoOpportunity | null>;
  /** Run an AI action against one or more pages; returns the updated rows. */
  runAction(ids: string[], action: SeoAction): Promise<SeoOpportunity[]>;
  /** Move one or more pages to a workflow status; returns the updated rows. */
  setStatus(ids: string[], status: SeoStatus): Promise<SeoOpportunity[]>;
}

/** Process-wide singleton — the cache-backed Google Search Console provider. */
let provider: SeoDataProvider | null = null;

export function getSeoProvider(): SeoDataProvider {
  if (!provider) {
    provider = new GoogleSearchConsoleProvider();
  }
  return provider;
}
