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
import { runGa4Sync } from "./sync";

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
