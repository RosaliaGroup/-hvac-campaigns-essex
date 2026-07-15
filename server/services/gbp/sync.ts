/**
 * Google Business Profile sync — pulls the location profile, reviews, daily
 * performance insights, photos and local posts from the Business Profile APIs
 * and upserts the on-disk cache (gbpLocations / gbpDailyMetrics / gbpReviews /
 * gbpPhotos / gbpPosts / gbpSyncHistory). The admin Local SEO dashboard reads
 * ONLY from that cache, never from Google directly, so a slow or failing sync
 * never blocks the UI.
 *
 * Each resource is fetched best-effort: a failure in one (e.g. reviews) still
 * lets the others persist. Rating/review-count snapshots are written onto the
 * current day's metric row so the rating trend accumulates one honest datapoint
 * per daily run. Mirrors the SEO Intelligence / Search Console sync design.
 */
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { withDbLock, type LockConnection } from "../../integrations/accounting/dbSyncLock";
import {
  gbpLocations,
  gbpDailyMetrics,
  gbpReviews,
  gbpPhotos,
  gbpPosts,
  gbpSyncHistory,
} from "../../../drizzle/schema";
import {
  fetchDailyMetrics,
  fetchLocation,
  fetchMedia,
  fetchPosts,
  fetchReviews,
  getGbpAccessToken,
  getGbpTarget,
  GbpUnavailableError,
  type DailyInsight,
  type GbpTarget,
} from "../../integrations/gbp";
import type { GbpSyncStatus } from "@shared/gbp";

/** Business Profile performance data lags a few days; the window still ends today. */
const WINDOW_DAYS = 30;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function metricHash(locationName: string, date: string): string {
  return sha256(`${locationName}\n${date}`);
}
function parseTime(iso: string | null): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

export type SyncResult =
  | {
      ok: true;
      reviewsSynced: number;
      metricsSynced: number;
      photosSynced: number;
      postsSynced: number;
    }
  | { ok: false; reason: "no_db" | "unconfigured" | "unavailable" | "already_running" | "error"; error?: string };

let syncing = false;

/** Cross-instance advisory lock name (distinct from the SEO / QBO sync locks). */
const GBP_SYNC_LOCK = "gbp_sync";
const defaultLockFactory = () =>
  import("../../db").then((m) => m.createDedicatedConnection()) as Promise<LockConnection>;

/**
 * Run one full sync. Guards concurrency at two levels (in-process flag + MySQL
 * advisory lock) so a rolling deploy / multi-replica deployment can never run
 * two syncs at once. Records a gbpSyncHistory row and never throws.
 */
export async function runGbpSync(
  opts: { trigger?: string; lockConnectionFactory?: () => Promise<LockConnection> } = {},
): Promise<SyncResult> {
  const trigger = opts.trigger ?? "manual";
  const db = await getDb();
  if (!db) return { ok: false, reason: "no_db", error: "Database not configured" };
  const target = getGbpTarget();
  if (!target) return { ok: false, reason: "unconfigured", error: "Set GBP_ACCOUNT_ID and GBP_LOCATION_ID" };
  if (syncing) return { ok: false, reason: "already_running" };
  syncing = true;
  try {
    const connect = opts.lockConnectionFactory ?? defaultLockFactory;
    return await withDbLock(
      connect,
      GBP_SYNC_LOCK,
      () => performSync(db, target, trigger),
      (reason, error) =>
        reason === "busy"
          ? ({ ok: false, reason: "already_running" } as const)
          : ({ ok: false, reason: "error", error: `advisory lock unavailable: ${error?.message ?? "unknown"}` } as const),
      { requestId: `gbp-${trigger}` },
    );
  } catch (err) {
    return { ok: false, reason: "error", error: (err as Error).message };
  } finally {
    syncing = false;
  }
}

async function performSync(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  target: GbpTarget,
  trigger: string,
): Promise<SyncResult> {
  const now = new Date();
  const end = fmtDate(now);
  const start = fmtDate(addDays(now, -(WINDOW_DAYS - 1)));

  const inserted = await db.insert(gbpSyncHistory).values({
    locationName: target.locationName,
    status: "running",
    trigger,
    rangeStart: start,
    rangeEnd: end,
  });
  const historyId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  try {
    const accessToken = await getGbpAccessToken();

    // Best-effort per resource: one failing endpoint must not lose the others.
    const location = await safe(() => fetchLocation({ accessToken, target }));
    const reviewsResult = await safe(() => fetchReviews({ accessToken, target }));
    const insights = (await safe(() => fetchDailyMetrics({ accessToken, target, start, end }))) ?? [];
    const media = (await safe(() => fetchMedia({ accessToken, target }))) ?? [];
    const posts = (await safe(() => fetchPosts({ accessToken, target }))) ?? [];

    const rating = reviewsResult?.averageRating ?? 0;
    const reviewCount = reviewsResult?.totalReviewCount ?? reviewsResult?.reviews.length ?? 0;

    // ── Location snapshot ──
    await upsertLocation(db, target, {
      title: location?.title ?? null,
      storefrontAddress: location?.storefrontAddress ?? null,
      primaryPhone: location?.primaryPhone ?? null,
      websiteUrl: location?.websiteUrl ?? null,
      rating,
      totalReviews: reviewCount,
      totalPhotos: media.length,
      totalPosts: posts.length,
    });

    // ── Daily performance + rating snapshot ──
    const metricsSynced = await upsertDailyMetrics(db, target.locationName, insights, end, rating, reviewCount);

    // ── Reviews ──
    let reviewsSynced = 0;
    for (const r of reviewsResult?.reviews ?? []) {
      await db
        .insert(gbpReviews)
        .values({
          locationName: target.locationName,
          reviewName: r.reviewName,
          reviewHash: sha256(r.reviewName),
          reviewerName: r.reviewerName ?? undefined,
          starRating: r.starRating,
          comment: r.comment ?? undefined,
          createTime: parseTime(r.createTime) ?? undefined,
          updateTime: parseTime(r.updateTime) ?? undefined,
          replyComment: r.replyComment ?? undefined,
          replyTime: parseTime(r.replyTime) ?? undefined,
          syncedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            starRating: r.starRating,
            comment: r.comment ?? null,
            updateTime: parseTime(r.updateTime) ?? null,
            replyComment: r.replyComment ?? null,
            replyTime: parseTime(r.replyTime) ?? null,
            syncedAt: new Date(),
          },
        });
      reviewsSynced++;
    }

    // ── Photos ──
    let photosSynced = 0;
    for (const m of media) {
      await db
        .insert(gbpPhotos)
        .values({
          locationName: target.locationName,
          mediaName: m.mediaName,
          mediaHash: sha256(m.mediaName),
          category: m.category ?? undefined,
          googleUrl: m.googleUrl ?? undefined,
          viewCount: m.viewCount,
          createTime: parseTime(m.createTime) ?? undefined,
          syncedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: { category: m.category ?? null, googleUrl: m.googleUrl ?? null, viewCount: m.viewCount, syncedAt: new Date() },
        });
      photosSynced++;
    }

    // ── Local posts ──
    let postsSynced = 0;
    for (const p of posts) {
      await db
        .insert(gbpPosts)
        .values({
          locationName: target.locationName,
          postName: p.postName,
          postHash: sha256(p.postName),
          summary: p.summary ?? undefined,
          topicType: p.topicType ?? undefined,
          state: p.state ?? undefined,
          searchUrl: p.searchUrl ?? undefined,
          createTime: parseTime(p.createTime) ?? undefined,
          updateTime: parseTime(p.updateTime) ?? undefined,
          syncedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            summary: p.summary ?? null,
            state: p.state ?? null,
            updateTime: parseTime(p.updateTime) ?? null,
            syncedAt: new Date(),
          },
        });
      postsSynced++;
    }

    if (historyId > 0) {
      await db
        .update(gbpSyncHistory)
        .set({ status: "success", completedAt: new Date(), reviewsSynced, metricsSynced, photosSynced, postsSynced })
        .where(eq(gbpSyncHistory.id, historyId));
    }
    return { ok: true, reviewsSynced, metricsSynced, photosSynced, postsSynced };
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    if (historyId > 0) {
      await db
        .update(gbpSyncHistory)
        .set({ status: "error", completedAt: new Date(), error: message.slice(0, 2000) })
        .where(eq(gbpSyncHistory.id, historyId))
        .catch(() => {});
    }
    const unavailable = err instanceof GbpUnavailableError;
    return { ok: false, reason: unavailable ? "unavailable" : "error", error: message };
  }
}

/** Run a fetch, swallowing failures to null so one bad endpoint can't fail the whole sync. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn("[GBP] fetch failed (best-effort):", (err as Error).message);
    return null;
  }
}

async function upsertLocation(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  target: GbpTarget,
  data: {
    title: string | null;
    storefrontAddress: string | null;
    primaryPhone: string | null;
    websiteUrl: string | null;
    rating: number;
    totalReviews: number;
    totalPhotos: number;
    totalPosts: number;
  },
): Promise<void> {
  const shared = {
    title: data.title ?? undefined,
    storefrontAddress: data.storefrontAddress ?? undefined,
    primaryPhone: data.primaryPhone ?? undefined,
    websiteUrl: data.websiteUrl ?? undefined,
    rating: data.rating.toFixed(2),
    totalReviews: data.totalReviews,
    totalPhotos: data.totalPhotos,
    totalPosts: data.totalPosts,
    lastSyncedAt: new Date(),
  };
  await db
    .insert(gbpLocations)
    .values({ accountId: target.accountId, locationId: target.locationId, locationName: target.locationName, ...shared })
    .onDuplicateKeyUpdate({ set: shared });
}

/**
 * Upsert the daily metric rows. The row dated `today` also carries the current
 * rating + review-count snapshot (performance data itself lags, so `today` is
 * usually metric-empty but is the anchor for the rating trend). Older rows keep
 * whatever rating snapshot an earlier run recorded.
 */
async function upsertDailyMetrics(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  locationName: string,
  insights: DailyInsight[],
  today: string,
  rating: number,
  reviewCount: number,
): Promise<number> {
  const byDate = new Map<string, DailyInsight>();
  for (const row of insights) byDate.set(row.date, row);
  // Guarantee a datapoint for today so the rating trend always advances.
  if (!byDate.has(today)) {
    byDate.set(today, { date: today, callClicks: 0, directionRequests: 0, websiteClicks: 0, searchViews: 0, mapsViews: 0 });
  }

  let count = 0;
  for (const row of Array.from(byDate.values())) {
    const isToday = row.date === today;
    const metricCols = {
      callClicks: row.callClicks,
      directionRequests: row.directionRequests,
      websiteClicks: row.websiteClicks,
      searchViews: row.searchViews,
      mapsViews: row.mapsViews,
      syncedAt: new Date(),
    };
    // Only today's row updates the rating/review snapshot; earlier snapshots are preserved.
    const snapshotCols = isToday ? { rating: rating.toFixed(2), reviewCount } : {};
    await db
      .insert(gbpDailyMetrics)
      .values({
        locationName,
        date: row.date,
        metricHash: metricHash(locationName, row.date),
        ...metricCols,
        ...(isToday ? { rating: rating.toFixed(2), reviewCount } : {}),
      })
      .onDuplicateKeyUpdate({ set: { ...metricCols, ...snapshotCols } });
    count++;
  }
  return count;
}

/* ── Sync status (for the dashboard freshness banner) ───────────────────── */

export async function readGbpSyncStatus(): Promise<GbpSyncStatus> {
  const empty: GbpSyncStatus = {
    connected: false,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessAt: null,
    lastError: null,
    stale: true,
  };
  const db = await getDb();
  if (!db) return empty;
  const target = getGbpTarget();
  if (!target) return empty;

  const [latest] = await db
    .select()
    .from(gbpSyncHistory)
    .where(eq(gbpSyncHistory.locationName, target.locationName))
    .orderBy(desc(gbpSyncHistory.startedAt))
    .limit(1);

  const [lastSuccess] = await db
    .select()
    .from(gbpSyncHistory)
    .where(and(eq(gbpSyncHistory.locationName, target.locationName), eq(gbpSyncHistory.status, "success")))
    .orderBy(desc(gbpSyncHistory.startedAt))
    .limit(1);

  if (!latest) return empty;
  return {
    connected: !!lastSuccess,
    lastRunAt: latest.startedAt ? new Date(latest.startedAt).toISOString() : null,
    lastRunStatus: latest.status,
    lastSuccessAt: lastSuccess?.completedAt ? new Date(lastSuccess.completedAt).toISOString() : null,
    lastError: latest.status === "error" ? latest.error ?? null : null,
    stale: !lastSuccess || latest.status === "error",
  };
}
