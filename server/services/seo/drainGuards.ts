/**
 * Pure guards for scripts/drain-seo-lanes.ts, kept here so they are unit-testable.
 *
 * The drain runs locally under `railway run`, so it arms holds (holdUntil) from the
 * OPERATOR'S clock but reads createdAt/updatedAt from the DB server's clock. Those can
 * differ by minutes; every comparison below carries a tolerance for that.
 */

/** Wider than any plausible operator/DB clock skew, far smaller than the 1h minimum hold. */
export const EARLY_MERGE_TOLERANCE_MS = 5 * 60 * 1000;

/** True when a batch merged materially before its hold expired. No hold → never "early". */
export function mergedBeforeHold(holdUntil: Date | null | undefined, mergedAt: Date, toleranceMs = EARLY_MERGE_TOLERANCE_MS): boolean {
  if (!holdUntil) return false;
  return mergedAt.getTime() < holdUntil.getTime() - toleranceMs;
}

/**
 * How the merge was made, from the batch's audit rows (newest last). The poller writes
 * mergeMode "auto", publishNow "manual_override"; a merge done on GitHub and only noticed by
 * refreshBatchStatus() carries no mergeMode at all → "external".
 */
export function mergeModeFromAudit(rows: Array<{ action: string; after: unknown }>): "auto" | "manual_override" | "external" {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.action !== "merged_detected") continue;
    const mode = (r.after as { mergeMode?: string } | null)?.mergeMode;
    return mode === "auto" || mode === "manual_override" ? mode : "external";
  }
  return "external";
}
