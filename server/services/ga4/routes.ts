/**
 * GA4 sync REST surface + daily scheduler.
 *
 *   POST /api/analytics/ga4/sync — pull the rolling window from the GA4 Data API
 *                                  into the cache. Intended for cron / external
 *                                  triggers, so it is guarded by a shared secret
 *                                  (GA4_SYNC_CRON_SECRET) rather than a user
 *                                  session. The in-app button uses the admin-only
 *                                  tRPC `analytics.sync` instead.
 *
 * A once-daily interval also runs the sync in-process (mirrors the SEO / SMS /
 * QBO schedulers), with one run shortly after boot.
 */
import type { Express, Request, Response } from "express";
import { runGa4Sync } from "./sync";

export function registerGa4SyncRoutes(app: Express) {
  app.post("/api/analytics/ga4/sync", async (req: Request, res: Response) => {
    const secret = process.env.GA4_SYNC_CRON_SECRET;
    if (secret) {
      const provided = req.header("x-ga4-sync-secret");
      if (provided !== secret) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
      }
    } else {
      console.warn("[GA4] POST /api/analytics/ga4/sync is unauthenticated — set GA4_SYNC_CRON_SECRET to lock it down");
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
  // Opt-out flag (mirrors SEO_SYNC_SCHEDULER_ENABLED). Even when enabled the sync
  // is safe on every instance: runGa4Sync holds a MySQL advisory lock, so only one
  // replica actually runs while the others no-op ("already_running").
  if (process.env.GA4_SYNC_SCHEDULER_ENABLED === "false") {
    console.log("[GA4] In-process sync scheduler disabled via GA4_SYNC_SCHEDULER_ENABLED=false");
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
