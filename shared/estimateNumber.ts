/**
 * QuickBooks is the sole estimate-numbering authority. A CRM-authored estimate has
 * NO number until its QuickBooks push assigns one, so `estimateNumber` is null while
 * the estimate is pending. These helpers render that state consistently everywhere a
 * number appears — never a locally-generated "EST-…" value.
 */
export const ESTIMATE_NUMBER_PENDING_LABEL = "№ pending — assigned by QuickBooks on push";

/** Compact pending marker for badges / inline labels. */
export const ESTIMATE_NUMBER_PENDING_SHORT = "№ pending";

/** The QuickBooks number verbatim, or a pending marker when it hasn't been assigned. */
export function formatEstimateNumber(
  estimateNumber: string | null | undefined,
  opts?: { short?: boolean },
): string {
  const n = estimateNumber?.trim();
  if (n) return n;
  return opts?.short ? ESTIMATE_NUMBER_PENDING_SHORT : ESTIMATE_NUMBER_PENDING_LABEL;
}
