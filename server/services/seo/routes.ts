/**
 * SEO sync REST surface + daily scheduler.
 *
 *   POST /api/seo/sync   — pull the last 90 days from Search Console into the
 *                          cache. Intended for cron / external triggers, so it is
 *                          guarded by a shared secret (SEO_SYNC_SECRET) rather
 *                          than a user session. The in-app button uses the
 *                          admin-only tRPC `seo.sync` instead.
 *
 * A once-daily interval also runs the sync in-process (mirrors the SMS/QBO
 * schedulers), with one run shortly after boot.
 */
import type { Express, Request, Response } from "express";
import { runSeoSync } from "./sync";

export function registerSeoSyncRoutes(app: Express) {
  app.post("/api/seo/sync", async (req: Request, res: Response) => {
    const secret = process.env.SEO_SYNC_SECRET;
    if (secret) {
      const provided = req.header("x-seo-sync-secret");
      if (provided !== secret) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
      }
    } else {
      console.warn("[SEO] POST /api/seo/sync is unauthenticated — set SEO_SYNC_SECRET to lock it down");
    }

    try {
      const result = await runSeoSync({ trigger: "api" });
      // Sync failures are reported in the body, not as 5xx — the caller (cron)
      // can log/alert, and the dashboard is unaffected either way.
      res.status(result.ok ? 200 : 202).json(result);
    } catch (err) {
      // runSeoSync is designed not to throw; this is a last-resort guard.
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });
}

export function startSeoSyncScheduler(): void {
  // Opt-out flag (mirrors QUICKBOOKS_POLL_ENABLED). Even when enabled the sync is
  // safe on every instance: runSeoSync holds a MySQL advisory lock, so only one
  // replica actually runs while the others no-op ("already_running"). Set this to
  // "false" on all-but-one instance, or everywhere if an external cron drives
  // POST /api/seo/sync instead.
  if (process.env.SEO_SYNC_SCHEDULER_ENABLED === "false") {
    console.log("[SEO] In-process sync scheduler disabled via SEO_SYNC_SCHEDULER_ENABLED=false");
    return;
  }

  const INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
  const STARTUP_DELAY_MS = 60 * 1000; // let the server settle before the first pull

  console.log("[SEO] Search Console sync scheduler started — daily (advisory-locked across instances)");

  const run = () =>
    runSeoSync({ trigger: "scheduled" })
      .then((r) => {
        if (r.ok) console.log(`[SEO] scheduled sync: ${r.pagesSynced} pages, ${r.queriesSynced} queries`);
        else console.warn(`[SEO] scheduled sync skipped/failed: ${r.reason}${r.error ? ` — ${r.error}` : ""}`);
      })
      .catch((err) => console.error("[SEO] scheduled sync error:", err));

  setTimeout(run, STARTUP_DELAY_MS);
  setInterval(run, INTERVAL_MS);
}
