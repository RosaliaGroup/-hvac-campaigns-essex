/**
 * SEO sync — pulls the last 90 days from Google Search Console and upserts the
 * on-disk cache (seoPages / seoQueries / seoSyncHistory). The dashboard reads
 * ONLY from that cache, never from Google directly, so a slow or failing sync
 * never blocks the UI.
 *
 * Sync overwrites the GSC-sourced + derived columns; it PRESERVES the
 * operational columns (`status`, `problems`) which are owned by the team/AI.
 */
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  computePriority,
  deriveCategory,
  deriveProblems,
  summarizeIssue,
  type IndexStatus,
  type SeoPageSignals,
} from "@shared/seo";
import { getDb } from "../../db";
import { withDbLock, type LockConnection } from "../../integrations/accounting/dbSyncLock";
import { seoPages, seoQueries, seoSyncHistory } from "../../../drizzle/schema";
import {
  getSearchConsoleAccessToken,
  getSeoSiteUrl,
  getSiteOrigin,
  querySearchAnalytics,
  inspectUrl,
  toPath,
  SearchConsoleUnavailableError,
  type AnalyticsRow,
} from "../../integrations/searchConsole";

/** Google Search Console data lags ~2–3 days; end the window before the gap. */
const DATA_LAG_DAYS = 3;
const WINDOW_DAYS = 90;
const TOP_QUERIES = 100;
const PAGE_ROW_LIMIT = 500;

export type SyncWindow = { start: string; end: string };
export type SyncWindows = { current: SyncWindow; previous: SyncWindow };

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/**
 * Two back-to-back 90-day windows ending `DATA_LAG_DAYS` before `now`. Pure so
 * the date arithmetic is unit-testable.
 */
export function computeSyncWindows(now: Date): SyncWindows {
  const end = addDays(now, -DATA_LAG_DAYS);
  const currentStart = addDays(end, -(WINDOW_DAYS - 1));
  const prevEnd = addDays(currentStart, -1);
  const prevStart = addDays(prevEnd, -(WINDOW_DAYS - 1));
  return {
    current: { start: fmtDate(currentStart), end: fmtDate(end) },
    previous: { start: fmtDate(prevStart), end: fmtDate(prevEnd) },
  };
}

function pageHash(siteUrl: string, path: string): string {
  return crypto.createHash("sha256").update(`${siteUrl}\n${path}`).digest("hex");
}

export type SyncResult =
  | { ok: true; pagesSynced: number; queriesSynced: number; window: SyncWindow }
  | { ok: false; reason: "no_db" | "unavailable" | "already_running" | "error"; error?: string };

let syncing = false;

/** Cross-instance advisory lock name (distinct from the QBO sync locks). */
const SEO_SYNC_LOCK = "seo_gsc_sync";
const defaultLockFactory = () =>
  import("../../db").then((m) => m.createDedicatedConnection()) as Promise<LockConnection>;

/**
 * Run one full sync. Guards against concurrency at TWO levels:
 *   - an in-process flag (fast path within one Node process), and
 *   - a MySQL GET_LOCK advisory lock (across ALL instances — so a rolling
 *     deploy or multi-replica deployment can never run two syncs at once).
 * Records a seoSyncHistory row for the whole lifecycle and never throws.
 */
export async function runSeoSync(
  opts: { trigger?: string; lockConnectionFactory?: () => Promise<LockConnection> } = {}
): Promise<SyncResult> {
  const trigger = opts.trigger ?? "manual";
  const db = await getDb();
  if (!db) return { ok: false, reason: "no_db", error: "Database not configured" };
  if (syncing) return { ok: false, reason: "already_running" };
  syncing = true;
  try {
    const connect = opts.lockConnectionFactory ?? defaultLockFactory;
    return await withDbLock(
      connect,
      SEO_SYNC_LOCK,
      // Only the instance that holds the lock reaches performSync.
      () => performSync(db, trigger),
      (reason, error) =>
        reason === "busy"
          ? ({ ok: false, reason: "already_running" } as const)
          : ({ ok: false, reason: "error", error: `advisory lock unavailable: ${error?.message ?? "unknown"}` } as const),
      { requestId: `seo-${trigger}` }
    );
  } catch (err) {
    // Last-resort guard: runSeoSync must NEVER throw (a DB error while opening
    // the history row could otherwise escape performSync's own try/catch).
    return { ok: false, reason: "error", error: (err as Error).message };
  } finally {
    syncing = false;
  }
}

async function performSync(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  trigger: string
): Promise<SyncResult> {
  const siteUrl = getSeoSiteUrl();
  const origin = getSiteOrigin();
  const windows = computeSyncWindows(new Date());

  // Open a history row so a crash still leaves an audit trail.
  const inserted = await db.insert(seoSyncHistory).values({
    siteUrl,
    status: "running",
    trigger,
    rangeStart: windows.current.start,
    rangeEnd: windows.current.end,
  });
  // drizzle/mysql2 returns [ResultSetHeader, FieldPacket[]] — the id is on [0]
  // (same pattern as createSocialPostReturningId in server/db.ts).
  const historyId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  try {
    const accessToken = await getSearchConsoleAccessToken();

    const cur = { startDate: windows.current.start, endDate: windows.current.end };
    const prv = { startDate: windows.previous.start, endDate: windows.previous.end };
    const [currentPages, previousPages, topQueries] = await Promise.all([
      querySearchAnalytics({ accessToken, siteUrl, ...cur, dimensions: ["page"], rowLimit: PAGE_ROW_LIMIT }),
      querySearchAnalytics({ accessToken, siteUrl, ...prv, dimensions: ["page"], rowLimit: PAGE_ROW_LIMIT }),
      querySearchAnalytics({ accessToken, siteUrl, ...cur, dimensions: ["query"], rowLimit: TOP_QUERIES }),
    ]);

    // Previous-window clicks/impressions keyed by path (for decline + deltas).
    const prev = new Map<string, { clicks: number; impressions: number }>();
    for (const r of previousPages) {
      prev.set(toPath(r.keys[0] ?? "", origin), { clicks: r.clicks, impressions: r.impressions });
    }

    // Best-effort index coverage for the top pages (quota-limited).
    const inspectLimit = Number(process.env.SEO_INSPECT_LIMIT ?? 20);
    const inspectMap = await inspectTopPages(accessToken, siteUrl, origin, currentPages, inspectLimit);

    let pagesSynced = 0;
    for (const row of currentPages) {
      const path = toPath(row.keys[0] ?? "", origin);
      if (!path) continue;
      const inspected = inspectMap.get(path);
      const indexStatus: IndexStatus = inspected?.indexStatus ?? "indexed";
      const prior = prev.get(path);
      const signals: SeoPageSignals = {
        position: row.position,
        ctr: row.ctr,
        impressions: row.impressions,
        clicks: row.clicks,
        previousClicks: prior?.clicks ?? 0,
        indexStatus,
      };
      await upsertPage({ db, siteUrl, origin, path, row, signals, prior, inspected });
      pagesSynced++;
    }

    // Replace the top-queries snapshot for this site.
    await db.delete(seoQueries).where(eq(seoQueries.siteUrl, siteUrl));
    let queriesSynced = 0;
    if (topQueries.length > 0) {
      await db.insert(seoQueries).values(
        topQueries.map((q) => ({
          siteUrl,
          query: (q.keys[0] ?? "").slice(0, 512),
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr.toFixed(6),
          position: q.position.toFixed(2),
        }))
      );
      queriesSynced = topQueries.length;
    }

    if (historyId > 0) {
      await db
        .update(seoSyncHistory)
        .set({ status: "success", completedAt: new Date(), pagesSynced, queriesSynced })
        .where(eq(seoSyncHistory.id, historyId));
    }
    return { ok: true, pagesSynced, queriesSynced, window: windows.current };
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    if (historyId > 0) {
      await db
        .update(seoSyncHistory)
        .set({ status: "error", completedAt: new Date(), error: message.slice(0, 2000) })
        .where(eq(seoSyncHistory.id, historyId))
        .catch(() => {});
    }
    const unavailable = err instanceof SearchConsoleUnavailableError;
    return { ok: false, reason: unavailable ? "unavailable" : "error", error: message };
  }
}

async function inspectTopPages(
  accessToken: string,
  siteUrl: string,
  origin: string,
  pages: AnalyticsRow[],
  limit: number
): Promise<Map<string, { indexStatus: IndexStatus; lastCrawlTime: string | null }>> {
  const map = new Map<string, { indexStatus: IndexStatus; lastCrawlTime: string | null }>();
  if (limit <= 0) return map;
  const top = [...pages].sort((a, b) => b.impressions - a.impressions).slice(0, limit);
  for (const row of top) {
    const path = toPath(row.keys[0] ?? "", origin);
    const inspectionUrl = `${origin}${path}`;
    try {
      const r = await inspectUrl({ accessToken, siteUrl, inspectionUrl });
      map.set(path, { indexStatus: r.indexStatus, lastCrawlTime: r.lastCrawlTime });
    } catch {
      // Inspection is best-effort — a failure just leaves the page at its default.
    }
  }
  return map;
}

async function upsertPage(args: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  siteUrl: string;
  origin: string;
  path: string;
  row: AnalyticsRow;
  signals: SeoPageSignals;
  prior?: { clicks: number; impressions: number };
  inspected?: { indexStatus: IndexStatus; lastCrawlTime: string | null };
}): Promise<void> {
  const { db, siteUrl, origin, path, row, signals, prior, inspected } = args;
  const priority = computePriority(signals);
  const category = deriveCategory(path);
  const problems = deriveProblems(signals);
  const issue = summarizeIssue(signals);
  const lastIndexedAt = inspected?.lastCrawlTime ? new Date(inspected.lastCrawlTime) : null;
  const searchConsoleIssue = inspected?.indexStatus
    ? indexStatusMessage(inspected.indexStatus)
    : indexStatusMessage(signals.indexStatus);

  const shared = {
    url: `${origin}${path}`,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr.toFixed(6),
    position: row.position.toFixed(2),
    previousClicks: prior?.clicks ?? 0,
    previousImpressions: prior?.impressions ?? 0,
    indexStatus: signals.indexStatus,
    lastIndexedAt,
    searchConsoleIssue,
    priority,
    category,
    issue,
    lastSyncedAt: new Date(),
  } as const;

  await db
    .insert(seoPages)
    .values({
      siteUrl,
      page: path.slice(0, 1024),
      pageHash: pageHash(siteUrl, path),
      // First-seen pages get their derived problems + default workflow status.
      problems,
      status: "needs_review",
      ...shared,
    })
    // On re-sync, refresh facts but LEAVE `status` and `problems` (operational state) alone.
    .onDuplicateKeyUpdate({ set: shared });
}

function indexStatusMessage(status: IndexStatus): string {
  switch (status) {
    case "indexed":
      return "Submitted and indexed";
    case "crawled_not_indexed":
      return "Crawled – currently not indexed";
    case "discovered_not_indexed":
      return "Discovered – currently not indexed";
    case "excluded":
      return "Excluded from index";
  }
}

/* ── Sync status (for the dashboard warning banner) ─────────────────────── */

export type SeoSyncStatus = {
  connected: boolean;
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  pagesSynced: number;
  /** True when there has never been a successful sync, or the last one failed. */
  stale: boolean;
};

export async function readSyncStatus(): Promise<SeoSyncStatus> {
  const empty: SeoSyncStatus = {
    connected: false,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessAt: null,
    lastError: null,
    pagesSynced: 0,
    stale: true,
  };
  const db = await getDb();
  if (!db) return empty;
  const siteUrl = getSeoSiteUrl();

  const [latest] = await db
    .select()
    .from(seoSyncHistory)
    .where(eq(seoSyncHistory.siteUrl, siteUrl))
    .orderBy(desc(seoSyncHistory.startedAt))
    .limit(1);

  const [lastSuccess] = await db
    .select()
    .from(seoSyncHistory)
    .where(and(eq(seoSyncHistory.siteUrl, siteUrl), eq(seoSyncHistory.status, "success")))
    .orderBy(desc(seoSyncHistory.startedAt))
    .limit(1);

  if (!latest) return empty;
  return {
    connected: !!lastSuccess,
    lastRunAt: latest.startedAt ? new Date(latest.startedAt).toISOString() : null,
    lastRunStatus: latest.status,
    lastSuccessAt: lastSuccess?.completedAt ? new Date(lastSuccess.completedAt).toISOString() : null,
    lastError: latest.status === "error" ? latest.error ?? null : null,
    pagesSynced: lastSuccess?.pagesSynced ?? 0,
    stale: !lastSuccess || latest.status === "error",
  };
}
