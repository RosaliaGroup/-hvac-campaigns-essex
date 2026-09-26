/**
 * GA4 sync REST surface + daily scheduler.
 *
 *   POST /api/analytics/ga4/sync — pull the rolling window from the GA4 Data API
 *                                  into the cache. Intended for cron / external
 *                                  triggers, so it REQUIRES a shared secret
 *                                  (GA4_SYNC_CRON_SECRET) rather than a user
 *                                  session — the endpoint is DISABLED (503) until
 *                                  that secret is configured, so it can never run
 *                                  unauthenticated. The in-app button uses the
 *                                  admin-only tRPC `analytics.sync` instead.
 *
 * An optional once-daily interval can also run the sync in-process, but it is
 * OPT-IN (GA4_SYNC_SCHEDULER_ENABLED must be "true") — off by default so no
 * automatic GA4 traffic starts until it is deliberately enabled.
 */
import type { Express, Request, Response } from "express";
import { runGa4Sync, readGa4SyncStatus } from "./sync";
import { notifyOwner } from "../../_core/notification";

/**
 * How stale a GA4 sync can go before the watchdog alerts. Chosen well above the
 * (opt-in) daily cadence so a single missed run never pages anyone — this only
 * fires when syncing has been silently broken/off for a while (the actual
 * failure mode observed in production: GA4_SYNC_SCHEDULER_ENABLED was left
 * false for 2.5 months with no external cron either, and nothing noticed).
 */
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // 36h

/**
 * Alerts the owner once per process lifetime if GA4 hasn't synced successfully
 * within STALE_THRESHOLD_MS. Runs independently of whether the in-process
 * scheduler is enabled, so it also catches the "scheduler disabled + no
 * external cron" case that let this go unnoticed for 2.5 months previously.
 */
let staleAlertSent = false;
export async function checkGa4StalenessAndAlert(): Promise<void> {
  try {
    const status = await readGa4SyncStatus();
    if (!status.propertyId) return; // unconfigured — nothing to watch
    const lastSuccessMs = status.lastSuccessAt ? new Date(status.lastSuccessAt).getTime() : null;
    const isStale = !lastSuccessMs || Date.now() - lastSuccessMs > STALE_THRESHOLD_MS;
    if (isStale && !staleAlertSent) {
      staleAlertSent = true;
      await notifyOwner({
        title: "GA4 sync is stale",
        content:
          `The GA4 analytics sync hasn't succeeded in over ${STALE_THRESHOLD_MS / 3_600_000}h. ` +
          `Last success: ${status.lastSuccessAt ?? "never"}. Last run status: ${status.lastRunStatus ?? "none"}. ` +
          `Last error: ${status.lastError ?? "none logged"}. Check GA4_SYNC_SCHEDULER_ENABLED, ` +
          `GA4_PROPERTY_ID, and whether the shared Google connection needs re-consent.`,
      });
    } else if (!isStale) {
      staleAlertSent = false; // recovered — allow a fresh alert if it goes stale again
    }
  } catch (err) {
    console.warn("[GA4] staleness watchdog check failed:", err);
  }
}

/**
 * Runs independently of GA4_SYNC_SCHEDULER_ENABLED — its whole job is to catch
 * the case where syncing is silently off or broken. Cheap (one status read),
 * so it's always safe to run regardless of the sync scheduler's own state.
 */
export function startGa4StalenessWatchdog(): void {
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h
  const STARTUP_DELAY_MS = 5 * 60 * 1000; // after the sync scheduler's own startup run has had a chance to land
  setTimeout(checkGa4StalenessAndAlert, STARTUP_DELAY_MS);
  setInterval(checkGa4StalenessAndAlert, CHECK_INTERVAL_MS);
}

export function registerGa4SyncRoutes(app: Express) {
  app.post("/api/analytics/ga4/sync", async (req: Request, res: Response) => {
    const secret = process.env.GA4_SYNC_CRON_SECRET;
    // Fail closed: without a configured secret the endpoint is disabled entirely.
    if (!secret) {
      res.status(503).json({ ok: false, error: "sync endpoint disabled — set GA4_SYNC_CRON_SECRET" });
      return;
    }
    const provided = req.header("x-ga4-sync-secret");
    if (provided !== secret) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    try {
      const result = await runGa4Sync({ trigger: "api" });
      // Sync failures are reported in the body, not as 5xx — the caller (cron)
      // can log/alert, and the dashboard is unaffected either way.
      res.status(result.ok ? 200 : 202).json(result);
    } catch (err) {
      // runGa4Sync is designed not to throw; this is a last-resort guard.
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });
}

export function startGa4SyncScheduler(): void {
  // OPT-IN: the scheduler stays off unless GA4_SYNC_SCHEDULER_ENABLED === "true".
  // This keeps automated GA4 traffic disabled by default (nothing runs until it
  // is deliberately turned on). When enabled the sync is still safe on every
  // instance: runGa4Sync holds a MySQL advisory lock, so only one replica runs
  // while the others no-op ("already_running").
  if (process.env.GA4_SYNC_SCHEDULER_ENABLED !== "true") {
    console.log("[GA4] In-process sync scheduler disabled (default) — set GA4_SYNC_SCHEDULER_ENABLED=true to enable");
    return;
  }

  const INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
  const STARTUP_DELAY_MS = 90 * 1000; // let the server settle before the first pull

  console.log("[GA4] Analytics Data API sync scheduler started — daily (advisory-locked across instances)");

  const run = () =>
    runGa4Sync({ trigger: "scheduled" })
      .then((r) => {
        if (r.ok) console.log(`[GA4] scheduled sync: ${r.rowsSynced} rows (${r.window.start}…${r.window.end})`);
        else console.warn(`[GA4] scheduled sync skipped/failed: ${r.reason}${r.error ? ` — ${r.error}` : ""}`);
      })
      .catch((err) => console.error("[GA4] scheduled sync error:", err));

  setTimeout(run, STARTUP_DELAY_MS);
  setInterval(run, INTERVAL_MS);
}
