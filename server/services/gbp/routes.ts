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
    // Fail CLOSED: without a configured secret the cron endpoint is disabled
    // entirely (the admin-only tRPC `gbp.sync` remains the in-app path). This is
    // deliberately stricter than the SEO route, which warns-and-runs.
    if (!secret) {
      console.warn("[GBP] POST /api/gbp/sync is disabled — set GBP_SYNC_CRON_SECRET to enable it");
      res.status(503).json({ ok: false, error: "GBP_SYNC_CRON_SECRET not configured" });
      return;
    }
    if (req.header("x-gbp-sync-secret") !== secret) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
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
  // Opt-IN flag: the in-process scheduler is OFF by default and only runs when
  // GBP_SYNC_SCHEDULER_ENABLED === "true". This keeps an unmerged / undeployed
  // feature dormant unless an operator explicitly turns it on. Even when enabled
  // the sync is safe on every instance: runGbpSync holds a MySQL advisory lock,
  // so only one replica actually runs while the others no-op ("already_running").
  if (process.env.GBP_SYNC_SCHEDULER_ENABLED !== "true") {
    console.log("[GBP] In-process sync scheduler disabled (set GBP_SYNC_SCHEDULER_ENABLED=true to enable)");
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
