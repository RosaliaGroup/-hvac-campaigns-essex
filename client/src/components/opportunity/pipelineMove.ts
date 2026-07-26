/**
 * Pure drag-and-drop move rules for the pipeline board, extracted so the
 * regression cases (no-op same-column drops, re-fires while a move is already
 * in flight, junk drag payloads) are unit-testable without a DOM.
 */
import type { OpportunityStage } from "@shared/opportunityDashboard";

/** Parse the opportunity id from a drag payload; null when absent/invalid. */
export function parseDropId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * A move should be applied only when it actually changes the stage and no other
 * stage mutation is in flight (guards against duplicate/racey setStage calls).
 */
export function shouldApplyMove(args: { from?: string | null; to: OpportunityStage; pending: boolean }): boolean {
  if (args.pending) return false;
  if (args.from === args.to) return false;
  return true;
}
