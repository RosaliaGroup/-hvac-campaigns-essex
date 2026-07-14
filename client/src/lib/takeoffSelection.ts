/**
 * Page-selection + cost guards for the AI Take-Off.
 *
 * Pure, UI-agnostic helpers so the "never analyze zero pages / never silently
 * fall back to all pages" rules and the large-run cost confirmation are testable
 * and applied consistently at the single dispatch point (runAnalysis).
 */

/** Runs above this many selected pages require an explicit cost confirmation. */
export const COST_CONFIRM_THRESHOLD = 20;

/** True only when at least one page is selected. */
export function canStartAnalysis(selectedCount: number): boolean {
  return selectedCount >= 1;
}

/** Message to show when a start is blocked for having no selection, else null. */
export function selectionBlockMessage(selectedCount: number): string | null {
  return selectedCount < 1 ? "Select at least one page." : null;
}

/** True when the selection is large enough to warrant a spend confirmation. */
export function needsCostConfirm(selectedCount: number): boolean {
  return selectedCount > COST_CONFIRM_THRESHOLD;
}

/** The confirmation prompt shown before analyzing a large selection. */
export function costConfirmMessage(selectedCount: number): string {
  return `You selected ${selectedCount} pages. This may use significant AI credits. Continue?`;
}
