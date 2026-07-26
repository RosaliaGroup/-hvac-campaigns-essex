/**
 * Pure helpers for closing an opportunity (Won / Lost). Kept framework-free so
 * the "a loss reason is required" rule is unit-testable without a DOM — the
 * backend accepts an optional reason, but the UI requires one for Lost so the
 * pipeline never accumulates unexplained losses.
 */
export const LOST_REASONS = [
  "Price too high",
  "Went with a competitor",
  "No response / went cold",
  "Timing — postponed",
  "Scope changed",
  "Out of service area",
  "Duplicate / not a real opp",
] as const;

export const WON_REASONS = [
  "Best price",
  "Existing relationship",
  "Fast response",
  "Referral",
  "Scope / quality fit",
] as const;

/** Trim + collapse a free-text reason; empty string means "no reason given". */
export function normalizeReason(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** A Lost close is only valid once a non-empty reason has been supplied. */
export function canConfirmClose(outcome: "won" | "lost", reason: string): boolean {
  if (outcome === "lost") return normalizeReason(reason).length > 0;
  return true; // Won reason is optional
}
