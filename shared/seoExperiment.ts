/**
 * The July-2026 "Page with redirect" re-indexing test (docs/pr1/july-collapse.md) and the rewrite HOLD
 * that protects it. Plain data + pure helpers, shared by the lock gate, market-intel and the report.
 *
 * Design: 8 clean pages split 4 treatment / 4 control. Excluded on purpose:
 *  - /blog/hvac-contractor-newark-nj — a genuine 301 since 2026-09-08, so Google is right about it.
 *  - heat-pump-vs-gas-furnace-nj-2026, heat-pump-installation-nj-guide, nj-clean-heat-program-2026 —
 *    their titles/metas were changed by the 2026-09-30 batches (#143/#149/#150), which would confound the read.
 * Treatment/control are stratified by template (city pages vs blog) and volume.
 *
 * `startedAt` is null until "Request indexing" has actually been done for the treatment pages (the URL
 * Inspection API is read-only; Google offers no API for it). Set it to that date (YYYY-MM-DD) in a code
 * change; the readout then runs at +16 days (14 days plus GSC's ~2-day lag).
 */
export const REINDEX_EXPERIMENT = {
  id: "redirect-reindex-2026-10",
  startedAt: null as string | null,
  /** Rewrites of every path in HOLD_PATHS are blocked until this date (inclusive), whatever startedAt is. */
  holdUntil: "2026-10-22",
  treatment: ["/hvac-linden-nj", "/hvac-millburn-nj", "/blog/nj-heat-pump-rebates-2026", "/blog/warehouse-hvac-nj"],
  control: ["/hvac-north-bergen-nj", "/hvac-jersey-city-nj", "/hvac-ridgefield-nj", "/blog"],
  /** The 15 pages flagged "possibly de-indexed" on 2026-09-30. No title/meta/content rewrite while the test reads. */
  holdPaths: [
    "/blog/nj-heat-pump-rebates-2026", "/blog/heat-pump-vs-gas-furnace-nj-2026", "/hvac-linden-nj", "/blog/heat-pump-installation-nj-guide",
    "/blog/hvac-contractor-newark-nj", "/blog/nj-clean-heat-program-2026", "/blog", "/hvac-north-bergen-nj", "/hvac-woodbridge-nj",
    "/hvac-millburn-nj", "/hvac-rahway-nj", "/hvac-jersey-city-nj", "/hvac-ridgefield-nj", "/hvac-teaneck-nj", "/blog/warehouse-hvac-nj",
  ],
} as const;

const DAY = 86_400_000;
/** GSC lags ~2 days, so the 14-day post window is only complete at +16. */
export const EXPERIMENT_READ_AFTER_DAYS = 16;

function normalize(p: string): string {
  const clean = p.split("?")[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/** True while `path` is inside the rewrite hold. `now` is compared to holdUntil at end-of-day UTC. */
export function isHeldForExperiment(path: string, now: Date = new Date(), exp: Pick<typeof REINDEX_EXPERIMENT, "holdUntil" | "holdPaths"> = REINDEX_EXPERIMENT): boolean {
  if (now.getTime() > Date.parse(`${exp.holdUntil}T23:59:59Z`)) return false;
  return (exp.holdPaths as readonly string[]).includes(normalize(path));
}

export type ExperimentPhase =
  | { phase: "not_started" }
  | { phase: "running"; daysUntilRead: number }
  | { phase: "read"; startedAt: string };

export function experimentPhase(now: Date = new Date(), startedAt: string | null = REINDEX_EXPERIMENT.startedAt): ExperimentPhase {
  if (!startedAt) return { phase: "not_started" };
  const daysSince = Math.floor((now.getTime() - Date.parse(`${startedAt}T00:00:00Z`)) / DAY);
  return daysSince >= EXPERIMENT_READ_AFTER_DAYS ? { phase: "read", startedAt } : { phase: "running", daysUntilRead: EXPERIMENT_READ_AFTER_DAYS - daysSince };
}
