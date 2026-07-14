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
 * Planned real implementations (post-Phase 2):
 *   - GscSeoProvider   → clicks / impressions / CTR / position / coverage
 *   - Ga4LeadsProvider → organicLeads (currently mocked; later from CRM/GA4)
 *   - IndexingProvider → request_reindex actually calls the Indexing API
 */
import type {
  SeoAction,
  SeoOpportunity,
  SeoOverview,
  SeoStatus,
} from "@shared/seo";
import { MockSeoProvider } from "./mockProvider";

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

/**
 * Process-wide singleton. Swap the constructor here (e.g. behind an env flag)
 * once the live providers exist:
 *
 *   provider = process.env.SEO_LIVE === "1" ? new GscSeoProvider(...) : new MockSeoProvider();
 */
let provider: SeoDataProvider | null = null;

export function getSeoProvider(): SeoDataProvider {
  if (!provider) {
    provider = new MockSeoProvider();
  }
  return provider;
}
