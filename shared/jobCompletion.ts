/**
 * Job completion rules (PR #41) — pure, framework-free. Defines when a field
 * record (time / parts / signature / notes) is still editable, and validates the
 * preconditions for completing a job. Shared by client + server so the same
 * rules drive the UI and the server enforcement.
 */
import type { TechnicianWorkStatus } from "./workStatus";

/**
 * After completion, technicians are locked out of edits; admins retain override.
 * `true` = the record is locked for this caller.
 */
export function isFieldLocked(jobCompleted: boolean, isAdmin: boolean): boolean {
  return jobCompleted && !isAdmin;
}

/** Convenience inverse: may this caller add/edit field records right now? */
export function canMutateField(jobCompleted: boolean, isAdmin: boolean): boolean {
  return !isFieldLocked(jobCompleted, isAdmin);
}

/** Work statuses from which a job may be finalized (work has actually happened). */
export const COMPLETABLE_WORK_STATUSES: TechnicianWorkStatus[] = ["working", "waiting_parts"];

export type CompletionBlockReason = "not_ready" | "note_required" | "signature_required";

export interface CompletionInputs {
  /** Current technician work status (PR #39). */
  currentWorkStatus: TechnicianWorkStatus;
  /** Whether the job already has at least one customer-visible note. */
  hasCustomerNote: boolean;
  /** The technician explicitly chose "No completion note". */
  noCompletionNote: boolean;
  /** Company setting: is a customer signature required to complete? */
  requireSignature: boolean;
  /** Whether a signature has been captured. */
  hasSignature: boolean;
}

export const COMPLETION_BLOCK_MESSAGE: Record<CompletionBlockReason, string> = {
  not_ready: "Finish the work before completing (status must be Working or Waiting for Parts).",
  note_required: "Add a customer note, or confirm “No completion note”.",
  signature_required: "A customer signature is required to complete this job.",
};

/**
 * Validate that a job may be completed. Returns ok, or the first blocking reason.
 * Order: work must be done → a note decision must be made → signature (if the
 * company requires it). The server calls this before finalizing; the client uses
 * it to gate the Complete button and show the reason.
 */
export function validateJobCompletion(
  input: CompletionInputs,
): { ok: true } | { ok: false; reason: CompletionBlockReason } {
  if (!COMPLETABLE_WORK_STATUSES.includes(input.currentWorkStatus)) {
    return { ok: false, reason: "not_ready" };
  }
  if (!input.hasCustomerNote && !input.noCompletionNote) {
    return { ok: false, reason: "note_required" };
  }
  if (input.requireSignature && !input.hasSignature) {
    return { ok: false, reason: "signature_required" };
  }
  return { ok: true };
}

/**
 * The single decision Complete Job makes before it writes anything. It folds the
 * idempotency check IN FRONT OF validation, so the outcome is one of three:
 *
 *   - `already_completed` — a completion snapshot already exists. This is the
 *     AUTHORITATIVE "is this job finished?" signal (the `jobCompletions` row),
 *     NOT the `technicianWorkStatus` enum — because the status can be moved
 *     independently of the snapshot (e.g. an admin remediation set it back to
 *     `working` while the snapshot stayed). Treating the snapshot as the source
 *     of truth makes Complete Job idempotent: a repeat call (double-tap, retry,
 *     or status/snapshot mismatch) is a controlled no-op, never a duplicate
 *     insert and never a raw DB duplicate-key error.
 *   - `blocked` — no snapshot yet, but the completion preconditions aren't met.
 *   - `proceed` — no snapshot yet and preconditions met; write the completion.
 *
 * Pure and exhaustively testable; the server acts on the returned action and
 * additionally guards the race (two concurrent proceeds) at the DB layer.
 */
export type CompletionPlan =
  | { action: "already_completed" }
  | { action: "blocked"; reason: CompletionBlockReason }
  | { action: "proceed" };

export function planJobCompletion(
  input: CompletionInputs & { hasCompletionRecord: boolean },
): CompletionPlan {
  if (input.hasCompletionRecord) return { action: "already_completed" };
  const v = validateJobCompletion(input);
  if (!v.ok) return { action: "blocked", reason: v.reason };
  return { action: "proceed" };
}
