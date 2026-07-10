/**
 * Background poller for QuickBooks sales documents.
 *
 * Every QUICKBOOKS_POLL_INTERVAL_MS (default 3 minutes) it runs an incremental
 * Estimate sync and then dispatches any due follow-ups. This is the "instant
 * sync going forward" path until webhooks are wired up; the manual
 * "Sync QuickBooks Now" button hits the same core. Each tick self-noops quietly
 * when QuickBooks isn't connected, so it's safe to start unconditionally.
 *
 * Modeled on services/scheduledSms.ts:startScheduledSmsProcessor.
 */
import { syncSalesDocuments } from "../integrations/accounting/salesDocSync";
import { processDueFollowups } from "../integrations/accounting/followups";

const DEFAULT_INTERVAL_MS = 3 * 60 * 1000;

/** Resolve the poll interval, clamped to a sane floor (avoid hammering QBO). */
export function getPollIntervalMs(): number {
  const raw = Number(process.env.QUICKBOOKS_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(30_000, raw); // never poll faster than every 30s
}

async function tick(): Promise<void> {
  try {
    const sync = await syncSalesDocuments({ mode: "incremental" });
    // Only chase follow-ups when connected (sync.ok) — skip the extra query otherwise.
    if (sync.ok) {
      await processDueFollowups();
    }
  } catch (err) {
    console.error("[QboSalesDocPoller] Tick error:", err);
  }
}

export function startSalesDocPoller(): void {
  if (process.env.QUICKBOOKS_POLL_ENABLED === "false") {
    console.log("[QboSalesDocPoller] Disabled via QUICKBOOKS_POLL_ENABLED=false");
    return;
  }
  const interval = getPollIntervalMs();
  console.log(`[QboSalesDocPoller] Started — polling every ${Math.round(interval / 1000)}s`);
  // Kick one run shortly after boot (don't block startup).
  setTimeout(() => void tick(), 15_000);
  setInterval(() => void tick(), interval);
}
