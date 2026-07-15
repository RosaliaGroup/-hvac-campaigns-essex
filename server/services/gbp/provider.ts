/**
 * Cache-backed Google Business Profile provider (READ ONLY).
 *
 * Implements the reads the admin Local SEO dashboard needs by querying the MySQL
 * cache that `runGbpSync` populates — the dashboard never calls Google on the
 * request path. Every read is wrapped so a missing DB / empty cache degrades to
 * safe, empty data instead of throwing (the freshness banner is driven
 * separately by readGbpSyncStatus).
 */
import { desc, eq } from "drizzle-orm";
import {
  ratingTrend,
  summarizeMetric,
  type GbpInsightPoint,
  type GbpOverview,
  type GbpPhoto,
  type GbpPost,
  type GbpReview,
} from "@shared/gbp";
import { getDb } from "../../db";
import {
  gbpLocations,
  gbpDailyMetrics,
  gbpReviews,
  gbpPhotos,
  gbpPosts,
  type GbpDailyMetricRow,
} from "../../../drizzle/schema";
import { getGbpTarget } from "../../integrations/gbp";

const WINDOW_DAYS = 30;

const EMPTY_METRIC = { total: 0, delta: 0 };
const EMPTY_OVERVIEW: GbpOverview = {
  connected: false,
  title: null,
  storefrontAddress: null,
  rating: 0,
  totalReviews: 0,
  totalPhotos: 0,
  totalPosts: 0,
  calls: EMPTY_METRIC,
  directions: EMPTY_METRIC,
  websiteClicks: EMPTY_METRIC,
  searchViews: EMPTY_METRIC,
  mapsViews: EMPTY_METRIC,
  ratingTrend: { current: 0, previous: 0, delta: 0 },
  rangeLabel: `Last ${WINDOW_DAYS} days`,
  lastSyncedAt: null,
};

function rowToPoint(r: GbpDailyMetricRow): GbpInsightPoint {
  return {
    date: r.date,
    callClicks: r.callClicks,
    directionRequests: r.directionRequests,
    websiteClicks: r.websiteClicks,
    searchViews: r.searchViews,
    mapsViews: r.mapsViews,
    rating: Number(r.rating),
    reviewCount: r.reviewCount,
  };
}

export class GbpProvider {
  /** Every daily metric row for the location, oldest → newest. */
  private async allPoints(): Promise<GbpInsightPoint[]> {
    const db = await getDb();
    if (!db) return [];
    const target = getGbpTarget();
    if (!target) return [];
    const rows = await db
      .select()
      .from(gbpDailyMetrics)
      .where(eq(gbpDailyMetrics.locationName, target.locationName));
    return rows.map(rowToPoint).sort((a, b) => a.date.localeCompare(b.date));
  }

  /** The current window's daily points (the trend charts read this). */
  async getInsights(days = WINDOW_DAYS): Promise<GbpInsightPoint[]> {
    try {
      const points = await this.allPoints();
      return points.slice(-days);
    } catch (err) {
      console.warn("[GBP] getInsights failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async getOverview(): Promise<GbpOverview> {
    try {
      const db = await getDb();
      if (!db) return EMPTY_OVERVIEW;
      const target = getGbpTarget();
      if (!target) return EMPTY_OVERVIEW;

      const [loc] = await db
        .select()
        .from(gbpLocations)
        .where(eq(gbpLocations.locationName, target.locationName))
        .limit(1);

      const points = await this.allPoints();
      const current = points.slice(-WINDOW_DAYS);
      const previous = points.slice(-WINDOW_DAYS * 2, -WINDOW_DAYS);

      return {
        connected: !!loc,
        title: loc?.title ?? null,
        storefrontAddress: loc?.storefrontAddress ?? null,
        rating: loc ? Number(loc.rating) : 0,
        totalReviews: loc?.totalReviews ?? 0,
        totalPhotos: loc?.totalPhotos ?? 0,
        totalPosts: loc?.totalPosts ?? 0,
        calls: summarizeMetric(current, previous, "callClicks"),
        directions: summarizeMetric(current, previous, "directionRequests"),
        websiteClicks: summarizeMetric(current, previous, "websiteClicks"),
        searchViews: summarizeMetric(current, previous, "searchViews"),
        mapsViews: summarizeMetric(current, previous, "mapsViews"),
        ratingTrend: ratingTrend(current),
        rangeLabel: `Last ${WINDOW_DAYS} days`,
        lastSyncedAt: loc?.lastSyncedAt ? new Date(loc.lastSyncedAt).toISOString() : null,
      };
    } catch (err) {
      console.warn("[GBP] getOverview failed, serving empty:", (err as Error).message);
      return EMPTY_OVERVIEW;
    }
  }

  async listReviews(limit = 25): Promise<GbpReview[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      const target = getGbpTarget();
      if (!target) return [];
      const rows = await db
        .select()
        .from(gbpReviews)
        .where(eq(gbpReviews.locationName, target.locationName))
        .orderBy(desc(gbpReviews.createTime))
        .limit(limit);
      return rows.map((r) => ({
        id: String(r.id),
        reviewerName: r.reviewerName ?? "Anonymous",
        starRating: r.starRating,
        comment: r.comment ?? "",
        createTime: r.createTime ? new Date(r.createTime).toISOString() : null,
        replyComment: r.replyComment ?? null,
        replyTime: r.replyTime ? new Date(r.replyTime).toISOString() : null,
      }));
    } catch (err) {
      console.warn("[GBP] listReviews failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async listPhotos(limit = 24): Promise<GbpPhoto[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      const target = getGbpTarget();
      if (!target) return [];
      const rows = await db
        .select()
        .from(gbpPhotos)
        .where(eq(gbpPhotos.locationName, target.locationName))
        .orderBy(desc(gbpPhotos.viewCount))
        .limit(limit);
      return rows.map((r) => ({
        id: String(r.id),
        category: r.category ?? "ADDITIONAL",
        googleUrl: r.googleUrl ?? null,
        viewCount: r.viewCount,
        createTime: r.createTime ? new Date(r.createTime).toISOString() : null,
      }));
    } catch (err) {
      console.warn("[GBP] listPhotos failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async listPosts(limit = 20): Promise<GbpPost[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      const target = getGbpTarget();
      if (!target) return [];
      const rows = await db
        .select()
        .from(gbpPosts)
        .where(eq(gbpPosts.locationName, target.locationName))
        .orderBy(desc(gbpPosts.createTime))
        .limit(limit);
      return rows.map((r) => ({
        id: String(r.id),
        summary: r.summary ?? "",
        topicType: r.topicType ?? "STANDARD",
        state: r.state ?? "",
        searchUrl: r.searchUrl ?? null,
        createTime: r.createTime ? new Date(r.createTime).toISOString() : null,
      }));
    } catch (err) {
      console.warn("[GBP] listPosts failed, serving empty:", (err as Error).message);
      return [];
    }
  }
}

/** Process-wide singleton — the cache-backed Business Profile provider. */
let provider: GbpProvider | null = null;

export function getGbpProvider(): GbpProvider {
  if (!provider) provider = new GbpProvider();
  return provider;
}
