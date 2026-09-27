/**
 * Cron registration (docs/market-intel-spec.md §1: "Runs 06:00 America/New_York
 * daily (SEO_INTEL_SCHEDULE, default 0 6 * * *)"). Mirrors
 * server/services/seo/contentPipeline.ts's startWeeklyContentScheduler() exactly:
 * an in-process self-rearming setTimeout using shared/cronTiming.ts's
 * msUntilNextRun()/parseCronToSchedule() — the same scheduling primitive every
 * other SEO job in this codebase already uses (nightlyDraftJob.ts,
 * contentPipeline.ts). No new scheduling library, no Railway cron entry.
 */
import { msUntilNextRun, parseCronToSchedule, type ScheduleSpec } from "../../../../shared/cronTiming";
import { runMarketIntelReport } from "./report";

const DEFAULT_SCHEDULE: ScheduleSpec = { hour: 6, minute: 0, timeZone: "America/New_York" };
const MONDAY_WEEKLY_SCHEDULE: ScheduleSpec = { hour: 6, minute: 30, timeZone: "America/New_York", weekdays: [1] };

function dailySchedule(): ScheduleSpec {
  const raw = process.env.SEO_INTEL_SCHEDULE?.trim();
  if (!raw) return DEFAULT_SCHEDULE;
  try {
    return parseCronToSchedule(raw, DEFAULT_SCHEDULE.timeZone);
  } catch (err) {
    console.error(`[MarketIntel] SEO_INTEL_SCHEDULE is invalid, falling back to the default (06:00 ET): ${(err as Error).message}`);
    return DEFAULT_SCHEDULE;
  }
}

/**
 * In-process scheduler — 06:00 America/New_York daily by default, overridable
 * via SEO_INTEL_SCHEDULE. Gated behind SEO_INTEL_ENABLED (default off);
 * runMarketIntelReport() itself also checks the flag, so this is a
 * belt-and-suspenders guard, same pattern as every other SEO scheduler here.
 * §6's weekly roll-up runs the SAME job with windowKind:"weekly" Mondays 06:30 ET.
 */
export function startMarketIntelScheduler(): void {
  if (process.env.SEO_INTEL_ENABLED !== "true") {
    console.log("[MarketIntel] disabled (set SEO_INTEL_ENABLED=true to enable)");
    return;
  }
  const armDaily = () => {
    const delay = msUntilNextRun(dailySchedule());
    setTimeout(() => {
      runMarketIntelReport({ windowKind: "daily" })
        .then((r) => console.log("[MarketIntel] daily report:", "skipped" in r ? r.reason : `${r.items} items, ${r.executed} executed`))
        .catch((err) => console.error("[MarketIntel] daily report error:", err))
        .finally(armDaily);
    }, delay);
  };
  const armWeekly = () => {
    const delay = msUntilNextRun(MONDAY_WEEKLY_SCHEDULE);
    setTimeout(() => {
      runMarketIntelReport({ windowKind: "weekly" })
        .then((r) => console.log("[MarketIntel] weekly roll-up:", "skipped" in r ? r.reason : `${r.items} items, ${r.executed} executed`))
        .catch((err) => console.error("[MarketIntel] weekly roll-up error:", err))
        .finally(armWeekly);
    }, delay);
  };
  console.log(`[MarketIntel] scheduled — ${process.env.SEO_INTEL_SCHEDULE?.trim() || "06:00 America/New_York daily (default)"}; weekly roll-up Mondays 06:30 ET`);
  armDaily();
  armWeekly();
}
