/**
 * Cache-backed SEO provider.
 *
 * Implements the unchanged SeoDataProvider interface by reading the MySQL cache
 * that `runSeoSync` populates from Google Search Console — the dashboard never
 * calls Google on the request path. Every read is wrapped so a missing DB / empty
 * cache degrades to safe, empty data instead of throwing: the dashboard must
 * never break (the warning banner is driven separately by readSyncStatus).
 *
 * Mutations (AI actions + status changes) persist to the operational columns of
 * seoPages; the next sync leaves those columns untouched.
 */
import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  actionToStatus,
  applyActionToProblems,
  hydrateOpportunity,
  type SeoAction,
  type SeoOpportunity,
  type SeoOpportunitySeed,
  type SeoOverview,
  type SeoProblem,
  type SeoStatus,
} from "@shared/seo";
import { getDb } from "../../db";
import { leadCaptures, seoPages, type SeoPageRow } from "../../../drizzle/schema";
import { getSeoSiteUrl } from "../../integrations/searchConsole";
import type { SeoDataProvider } from "./provider";

const EMPTY_OVERVIEW: SeoOverview = {
  organicClicks: 0,
  impressions: 0,
  ctr: 0,
  averagePosition: 0,
  indexedPages: 0,
  notIndexedPages: 0,
  organicLeads: { thisMonth: 0, goal: leadsGoal() },
  deltas: { organicClicks: 0, impressions: 0, ctr: 0, averagePosition: 0 },
  rangeLabel: "Last 90 days",
};

function leadsGoal(): number {
  const n = Number(process.env.SEO_LEADS_GOAL);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

function rowToSeed(r: SeoPageRow): SeoOpportunitySeed {
  const problems = Array.isArray(r.problems) ? (r.problems as SeoProblem[]) : [];
  return {
    id: String(r.id),
    priority: r.priority,
    page: r.page,
    url: r.url,
    title: r.title ?? "",
    metaDescription: r.metaDescription ?? "",
    h1: r.h1 ?? "",
    issue: r.issue ?? "",
    searchConsoleIssue: r.searchConsoleIssue ?? "",
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: Number(r.ctr),
    position: Number(r.position),
    indexStatus: r.indexStatus,
    lastIndexedAt: r.lastIndexedAt ? new Date(r.lastIndexedAt).toISOString() : null,
    status: r.status,
    category: r.category,
    problems,
  };
}

function rowToOpportunity(r: SeoPageRow): SeoOpportunity {
  return hydrateOpportunity(rowToSeed(r));
}

/** High → Medium → Low, then by impressions desc — the morning work order. */
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export class GoogleSearchConsoleProvider implements SeoDataProvider {
  async getOverview(): Promise<SeoOverview> {
    try {
      const db = await getDb();
      if (!db) return EMPTY_OVERVIEW;
      const siteUrl = getSeoSiteUrl();
      const rows = await db.select().from(seoPages).where(eq(seoPages.siteUrl, siteUrl));

      let clicks = 0, impressions = 0, prevClicks = 0, prevImpressions = 0;
      let weightedPos = 0, indexed = 0, notIndexed = 0;
      for (const r of rows) {
        clicks += r.clicks;
        impressions += r.impressions;
        prevClicks += r.previousClicks;
        prevImpressions += r.previousImpressions;
        weightedPos += Number(r.position) * r.impressions;
        if (r.indexStatus === "indexed") indexed++;
        else notIndexed++;
      }
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const prevCtr = prevImpressions > 0 ? prevClicks / prevImpressions : 0;
      const averagePosition = impressions > 0 ? weightedPos / impressions : 0;

      return {
        organicClicks: clicks,
        impressions,
        ctr,
        averagePosition,
        indexedPages: indexed,
        notIndexedPages: notIndexed,
        organicLeads: { thisMonth: await countOrganicLeadsThisMonth(), goal: leadsGoal() },
        deltas: {
          organicClicks: prevClicks > 0 ? (clicks - prevClicks) / prevClicks : 0,
          impressions: prevImpressions > 0 ? (impressions - prevImpressions) / prevImpressions : 0,
          ctr: ctr - prevCtr,
          averagePosition: 0, // previous-window position not tracked per page
        },
        rangeLabel: "Last 90 days",
      };
    } catch (err) {
      console.warn("[SEO] getOverview failed, serving empty:", (err as Error).message);
      return EMPTY_OVERVIEW;
    }
  }

  async listOpportunities(): Promise<SeoOpportunity[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      const siteUrl = getSeoSiteUrl();
      const rows = await db.select().from(seoPages).where(eq(seoPages.siteUrl, siteUrl)).orderBy(desc(seoPages.impressions));
      return rows
        .map(rowToOpportunity)
        .sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || b.impressions - a.impressions);
    } catch (err) {
      console.warn("[SEO] listOpportunities failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async getOpportunity(id: string): Promise<SeoOpportunity | null> {
    try {
      const numId = Number(id);
      if (!Number.isInteger(numId)) return null;
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(seoPages).where(eq(seoPages.id, numId)).limit(1);
      return row ? rowToOpportunity(row) : null;
    } catch (err) {
      console.warn("[SEO] getOpportunity failed:", (err as Error).message);
      return null;
    }
  }

  async runAction(ids: string[], action: SeoAction): Promise<SeoOpportunity[]> {
    const db = await getDb();
    if (!db) return [];
    const numIds = ids.map(Number).filter(Number.isInteger);
    if (numIds.length === 0) return [];
    const nextStatus = actionToStatus(action);
    const rows = await db.select().from(seoPages).where(inArray(seoPages.id, numIds));
    const updated: SeoOpportunity[] = [];
    for (const r of rows) {
      const problems = Array.isArray(r.problems) ? (r.problems as SeoProblem[]) : [];
      const nextProblems = applyActionToProblems(problems, action);
      await db.update(seoPages).set({ problems: nextProblems, status: nextStatus }).where(eq(seoPages.id, r.id));
      updated.push(rowToOpportunity({ ...r, problems: nextProblems, status: nextStatus }));
    }
    return updated;
  }

  async setStatus(ids: string[], status: SeoStatus): Promise<SeoOpportunity[]> {
    const db = await getDb();
    if (!db) return [];
    const numIds = ids.map(Number).filter(Number.isInteger);
    if (numIds.length === 0) return [];
    await db.update(seoPages).set({ status }).where(inArray(seoPages.id, numIds));
    const rows = await db.select().from(seoPages).where(inArray(seoPages.id, numIds));
    return rows.map(rowToOpportunity);
  }
}

/**
 * Real count of leads captured this calendar month — a live proxy for organic
 * leads until the CRM-attribution funnel (Organic → Leads → Estimates → Won →
 * Revenue) lands in a later sprint. Never throws.
 */
async function countOrganicLeadsThisMonth(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(leadCaptures)
      .where(gte(leadCaptures.createdAt, startOfMonth));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}
