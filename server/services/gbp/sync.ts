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
  // Google media can contain sentinel dates (e.g. year 0001). These are
  // valid JS Dates but outside MySQL TIMESTAMP's supported UTC range.
  return !Number.isFinite(t) || t < 1000 || t > 2_147_483_647_000 ? null : new Date(t);
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

    // Keep successful resources, but never substitute failed downloads with
    // zero totals or report a partial download as a successful sync.
    const failures: string[] = [];
    const read = async <T>(resource: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        const message = `${resource}: ${(err as Error).message}`;
        failures.push(message);
        console.warn("[GBP] fetch failed:", message);
        return null;
      }
    };
    const location = await read("location", () => fetchLocation({ accessToken, target }));
    const reviewsResult = await read("reviews", () => fetchReviews({ accessToken, target }));
    const insights = await read("performance", () => fetchDailyMetrics({ accessToken, target, start, end }));
    const media = await read("photos", () => fetchMedia({ accessToken, target }));
    const posts = await read("posts", () => fetchPosts({ accessToken, target }));

    const rating = reviewsResult?.averageRating ?? null;
    const reviewCount = reviewsResult?.totalReviewCount ?? null;

    // Only update columns whose source was fetched successfully. Omitted
    // columns retain their existing values on duplicate-key updates.
    const snapshot = {
      ...(location ? location : {}),
      ...(reviewsResult ? { rating: reviewsResult.averageRating.toFixed(2), totalReviews: reviewsResult.totalReviewCount } : {}),
      ...(media ? { totalPhotos: media.length } : {}),
      ...(posts ? { totalPosts: posts.length } : {}),
      ...(failures.length === 0 ? { lastSyncedAt: new Date() } : {}),
    };
    if (Object.keys(snapshot).length > 0) await upsertLocation(db, target, snapshot);

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
    // Isolate individual bad media records so they cannot block post persistence.
    let photosSynced = 0;
    let photosFailed = 0;
    for (const m of media ?? []) {
      try {
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
      } catch (err) {
        photosFailed++;
        const cause = (err as Error & { cause?: { code?: string; errno?: number; sqlState?: string } }).cause;
        console.warn("[GBP] photo upsert failed", {
          mediaHashPrefix: sha256(m.mediaName).slice(0, 12),
          code: cause?.code ?? "unknown",
          errno: cause?.errno ?? null,
          sqlState: cause?.sqlState ?? null,
        });
      }
    }

    // ── Local posts ──
    let postsSynced = 0;
    for (const p of posts ?? []) {
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

    if (photosFailed > 0) failures.push(`${photosFailed} photo record(s) failed to save`);
    const error = failures.length > 0 ? failures.join("; ").slice(0, 2000) : null;
    if (historyId > 0) {
      await db
        .update(gbpSyncHistory)
        .set({ status: error ? "error" : "success", error, completedAt: new Date(), reviewsSynced, metricsSynced, photosSynced, postsSynced })
        .where(eq(gbpSyncHistory.id, historyId));
    }
    return error ? { ok: false, reason: "error", error } : { ok: true, reviewsSynced, metricsSynced, photosSynced, postsSynced };
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

async function upsertLocation(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  target: GbpTarget,
  data: Partial<Omit<typeof gbpLocations.$inferInsert, "id" | "accountId" | "locationId" | "locationName">>,
): Promise<void> {
  await db
    .insert(gbpLocations)
    .values({ ...data, accountId: target.accountId, locationId: target.locationId, locationName: target.locationName })
    .onDuplicateKeyUpdate({ set: data });
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
  insights: DailyInsight[] | null,
  today: string,
  rating: number | null,
  reviewCount: number | null,
): Promise<number> {
  const byDate = new Map<string, DailyInsight | null>();
  for (const row of insights ?? []) byDate.set(row.date, row);
  // A rating-only update must not overwrite existing performance with zeros.
  if (rating !== null && reviewCount !== null && !byDate.has(today)) byDate.set(today, null);

  let count = 0;
  for (const [date, row] of Array.from(byDate.entries())) {
    const metricCols = row ? {
      callClicks: row.callClicks,
      directionRequests: row.directionRequests,
      websiteClicks: row.websiteClicks,
      searchViews: row.searchViews,
      mapsViews: row.mapsViews,
    } : {};
    const snapshotCols = date === today && rating !== null && reviewCount !== null
      ? { rating: rating.toFixed(2), reviewCount } : {};
    const columns = { ...metricCols, ...snapshotCols, syncedAt: new Date() };
    await db
      .insert(gbpDailyMetrics)
      .values({ locationName, date, metricHash: metricHash(locationName, date), ...columns })
      .onDuplicateKeyUpdate({ set: columns });
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
