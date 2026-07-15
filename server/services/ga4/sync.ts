/**
 * GA4 sync — pulls a rolling window from the Google Analytics Data API and
 * upserts the on-disk cache (ga4DailyMetrics / ga4SyncHistory). The Marketing →
 * Analytics dashboard reads ONLY from that cache, never from GA4 directly, so a
 * slow or failing sync never blocks the UI.
 *
 * Historical daily rows are immutable facts, so the sync is a pure upsert keyed
 * on rowHash — re-running is idempotent and never needs a delete pass. Concurrency
 * is guarded at two levels (in-process flag + MySQL advisory lock) exactly like
 * the SEO Search Console sync, so a rolling deploy can never run two at once.
 */
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { withDbLock, type LockConnection } from "../../integrations/accounting/dbSyncLock";
import { ga4DailyMetrics, ga4SyncHistory } from "../../../drizzle/schema";
import {
  getGa4AccessToken,
  getGa4PropertyId,
  runReport,
  Ga4UnavailableError,
  type Ga4ReportRow,
} from "../../integrations/ga4";
import { deriveTrafficType } from "@shared/ga4";

const WINDOW_DAYS = Number(process.env.GA4_WINDOW_DAYS ?? 90);
/** GA4's max rows per runReport page. */
const PAGE_LIMIT = 100_000;
const MAX_PAGES = 20;

export type SyncWindow = { start: string; end: string };

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** The rolling [start, end] window ending today (UTC). Pure + unit-testable. */
export function computeSyncWindow(now: Date, windowDays = WINDOW_DAYS): SyncWindow {
  const end = now;
  const start = addDays(end, -(windowDays - 1));
  return { start: fmtDate(start), end: fmtDate(end) };
}

export function ga4RowHash(propertyId: string, r: Ga4ReportRow): string {
  return crypto
    .createHash("sha256")
    .update([propertyId, r.date, r.source, r.medium, r.campaign, r.landingPage, r.channelGroup].join("\n"))
    .digest("hex");
}

export type SyncResult =
  | { ok: true; rowsSynced: number; window: SyncWindow }
  | { ok: false; reason: "no_db" | "unconfigured" | "unavailable" | "already_running" | "error"; error?: string };

let syncing = false;

/** Cross-instance advisory lock name (distinct from the QBO + SEO sync locks). */
const GA4_SYNC_LOCK = "ga4_analytics_sync";
const defaultLockFactory = () =>
  import("../../db").then((m) => m.createDedicatedConnection()) as Promise<LockConnection>;

/**
 * Run one full sync. Never throws — returns a typed result the caller (cron /
 * tRPC / REST) can surface. Guards concurrency with an in-process flag AND a
 * MySQL advisory lock so only one replica actually runs.
 */
export async function runGa4Sync(
  opts: { trigger?: string; lockConnectionFactory?: () => Promise<LockConnection> } = {},
): Promise<SyncResult> {
  const trigger = opts.trigger ?? "manual";
  const db = await getDb();
  if (!db) return { ok: false, reason: "no_db", error: "Database not configured" };
  const propertyId = getGa4PropertyId();
  if (!propertyId) return { ok: false, reason: "unconfigured", error: "GA4_PROPERTY_ID is not set" };
  if (syncing) return { ok: false, reason: "already_running" };
  syncing = true;
  try {
    const connect = opts.lockConnectionFactory ?? defaultLockFactory;
    return await withDbLock(
      connect,
      GA4_SYNC_LOCK,
      () => performSync(db, propertyId, trigger),
      (reason, error) =>
        reason === "busy"
          ? ({ ok: false, reason: "already_running" } as const)
          : ({ ok: false, reason: "error", error: `advisory lock unavailable: ${error?.message ?? "unknown"}` } as const),
      { requestId: `ga4-${trigger}` },
    );
  } catch (err) {
    return { ok: false, reason: "error", error: (err as Error).message };
  } finally {
    syncing = false;
  }
}

async function performSync(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  propertyId: string,
  trigger: string,
): Promise<SyncResult> {
  const window = computeSyncWindow(new Date());

  const inserted = await db.insert(ga4SyncHistory).values({
    propertyId,
    status: "running",
    trigger,
    rangeStart: window.start,
    rangeEnd: window.end,
  });
  // drizzle/mysql2 returns [ResultSetHeader, FieldPacket[]] — the id is on [0].
  const historyId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  try {
    const accessToken = await getGa4AccessToken();

    // Page through the report (one page is plenty at this cardinality, but
    // loop defensively so a large window never silently truncates).
    const rows: Ga4ReportRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await runReport({
        accessToken,
        propertyId,
        startDate: window.start,
        endDate: window.end,
        limit: PAGE_LIMIT,
        offset: page * PAGE_LIMIT,
      });
      rows.push(...batch);
      if (batch.length < PAGE_LIMIT) break;
    }

    let rowsSynced = 0;
    for (const r of rows) {
      await upsertRow(db, propertyId, r);
      rowsSynced++;
    }

    if (historyId > 0) {
      await db
        .update(ga4SyncHistory)
        .set({ status: "success", completedAt: new Date(), rowsSynced })
        .where(eq(ga4SyncHistory.id, historyId));
    }
    return { ok: true, rowsSynced, window };
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    if (historyId > 0) {
      await db
        .update(ga4SyncHistory)
        .set({ status: "error", completedAt: new Date(), error: message.slice(0, 2000) })
        .where(eq(ga4SyncHistory.id, historyId))
        .catch(() => {});
    }
    const unavailable = err instanceof Ga4UnavailableError;
    return { ok: false, reason: unavailable ? "unavailable" : "error", error: message };
  }
}

async function upsertRow(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  propertyId: string,
  r: Ga4ReportRow,
): Promise<void> {
  const trafficType = deriveTrafficType(r.source, r.medium, r.channelGroup);
  const shared = {
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    landingPage: r.landingPage,
    channelGroup: r.channelGroup,
    trafficType,
    pageViews: r.pageViews,
    sessions: r.sessions,
    users: r.users,
    conversions: r.conversions.toFixed(4),
    events: r.events,
    syncedAt: new Date(),
  } as const;

  await db
    .insert(ga4DailyMetrics)
    .values({
      propertyId,
      date: r.date,
      rowHash: ga4RowHash(propertyId, r),
      ...shared,
    })
    .onDuplicateKeyUpdate({ set: shared });
}

/* ── Sync status (for the dashboard freshness banner) ───────────────────── */

export type Ga4SyncStatusRow = {
  connected: boolean;
  propertyId: string | null;
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  rowsSynced: number;
  stale: boolean;
};

export async function readGa4SyncStatus(): Promise<Ga4SyncStatusRow> {
  const propertyId = getGa4PropertyId() || null;
  const empty: Ga4SyncStatusRow = {
    connected: false,
    propertyId,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessAt: null,
    lastError: null,
    rowsSynced: 0,
    stale: true,
  };
  const db = await getDb();
  if (!db || !propertyId) return empty;

  const [latest] = await db
    .select()
    .from(ga4SyncHistory)
    .where(eq(ga4SyncHistory.propertyId, propertyId))
    .orderBy(desc(ga4SyncHistory.startedAt))
    .limit(1);

  const [lastSuccess] = await db
    .select()
    .from(ga4SyncHistory)
    .where(and(eq(ga4SyncHistory.propertyId, propertyId), eq(ga4SyncHistory.status, "success")))
    .orderBy(desc(ga4SyncHistory.startedAt))
    .limit(1);

  if (!latest) return empty;
  return {
    connected: !!lastSuccess,
    propertyId,
    lastRunAt: latest.startedAt ? new Date(latest.startedAt).toISOString() : null,
    lastRunStatus: latest.status,
    lastSuccessAt: lastSuccess?.completedAt ? new Date(lastSuccess.completedAt).toISOString() : null,
    lastError: latest.status === "error" ? latest.error ?? null : null,
    rowsSynced: lastSuccess?.rowsSynced ?? 0,
    stale: !lastSuccess || latest.status === "error",
  };
}
