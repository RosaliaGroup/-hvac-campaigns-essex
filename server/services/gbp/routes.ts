/**
 * Google Business Profile sync REST surface + daily scheduler.
 *
 *   POST /api/gbp/sync — pull the latest reviews / performance insights / photos
 *                        / posts into the cache. Intended for cron / external
 *                        triggers, so it is guarded by a shared secret
 *                        (GBP_SYNC_CRON_SECRET) rather than a user session. The
 *                        in-app button uses the admin-only tRPC `gbp.sync`.
 *
 * A once-daily interval also runs the sync in-process (mirrors the SEO/SMS/QBO
 * schedulers), with one run shortly after boot.
 */
import type { Express, Request, Response } from "express";
import { runGbpSync } from "./sync";

export function registerGbpSyncRoutes(app: Express) {
  app.post("/api/gbp/sync", async (req: Request, res: Response) => {
    const secret = process.env.GBP_SYNC_CRON_SECRET;
    if (secret) {
      const provided = req.header("x-gbp-sync-secret");
      if (provided !== secret) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
      }
    } else {
      console.warn("[GBP] POST /api/gbp/sync is unauthenticated — set GBP_SYNC_CRON_SECRET to lock it down");
    }

    try {
      const result = await runGbpSync({ trigger: "api" });
      res.status(result.ok ? 200 : 202).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });
}

export function startGbpSyncScheduler(): void {
  // Opt-out flag (mirrors SEO_SYNC_SCHEDULER_ENABLED). Even when enabled the sync
  // is safe on every instance: runGbpSync holds a MySQL advisory lock, so only
  // one replica actually runs while the others no-op ("already_running").
  if (process.env.GBP_SYNC_SCHEDULER_ENABLED === "false") {
    console.log("[GBP] In-process sync scheduler disabled via GBP_SYNC_SCHEDULER_ENABLED=false");
    return;
  }

  const INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
  const STARTUP_DELAY_MS = 90 * 1000; // let the server settle (after the SEO sync)

  console.log("[GBP] Business Profile sync scheduler started — daily (advisory-locked across instances)");

  const run = () =>
    runGbpSync({ trigger: "scheduled" })
      .then((r) => {
        if (r.ok)
          console.log(
            `[GBP] scheduled sync: ${r.reviewsSynced} reviews, ${r.metricsSynced} metric days, ${r.photosSynced} photos, ${r.postsSynced} posts`,
          );
        else console.warn(`[GBP] scheduled sync skipped/failed: ${r.reason}${r.error ? ` — ${r.error}` : ""}`);
      })
      .catch((err) => console.error("[GBP] scheduled sync error:", err));

  setTimeout(run, STARTUP_DELAY_MS);
  setInterval(run, INTERVAL_MS);
}
