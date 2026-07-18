/**
 * Canonical Job Lifecycle — the single source of truth for "where is this job".
 *
 * This module is PURE (no DB, no side effects) so it can be unit-tested exhaustively
 * and reused by server, dispatch, portal, reporting, and AI. It reconciles the three
 * legacy status axes WITHOUT changing them:
 *   - office   : jobs.status                (11-state office/financial pipeline)
 *   - field    : jobs.technicianWorkStatus  (7-state technician execution)
 *   - dispatch : appointments.status        (6-state per-visit)
 *
 * The canonical state is DERIVED from those inputs by `deriveJobLifecycle`. Nothing
 * here writes anything; the server service persists the result in shadow mode.
 */

// ── Canonical states ─────────────────────────────────────────────────────────
export const LIFECYCLE_STATES = [
  "new",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "work_complete",
  "invoiced",
  "paid",
  "closed",
  "cancelled",
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

// ── Legacy input enums (mirrors of the schema; kept here for the pure reducer) ──
export type OfficeStatus =
  | "new" | "scheduled" | "in_progress" | "waiting_parts" | "estimate_sent"
  | "approved" | "completed" | "invoice_sent" | "paid" | "closed" | "cancelled";
export type TechnicianWorkStatus =
  | "assigned" | "accepted" | "en_route" | "arrived" | "working" | "waiting_parts" | "completed";
export type AppointmentStatus =
  | "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "arrived";

export interface LifecycleInput {
  officeStatus: OfficeStatus;
  technicianWorkStatus: TechnicianWorkStatus;
  /** Statuses of the job's appointments (visits). May be empty. */
  appointmentStatuses?: AppointmentStatus[];
}

export interface LifecycleResult {
  state: LifecycleState;
  /** Short machine reason for how the state was reached (for audit/debug). */
  reason: string;
}

const ACTIVE_APPT: AppointmentStatus[] = ["pending", "confirmed", "rescheduled", "arrived"];
const DISPATCH_FIELD: TechnicianWorkStatus[] = ["accepted", "en_route", "arrived"];

/**
 * Derive the canonical lifecycle from the three legacy inputs. Precedence, highest
 * first: billing (cancelled/closed/paid/invoiced) → completion → hold → in-progress
 * → dispatched → scheduled → new. Deterministic and total (always returns a state).
 */
export function deriveJobLifecycle(input: LifecycleInput): LifecycleResult {
  const office = input.officeStatus;
  const field = input.technicianWorkStatus;
  const appts = input.appointmentStatuses ?? [];
  const hasActiveVisit = appts.some(a => ACTIVE_APPT.includes(a));

  // 1–4: terminal / billing signals (office status carries the accounting projection).
  if (office === "cancelled") return { state: "cancelled", reason: "office:cancelled" };
  if (office === "closed") return { state: "closed", reason: "office:closed" };
  if (office === "paid") return { state: "paid", reason: "office:paid" };
  if (office === "invoice_sent") return { state: "invoiced", reason: "office:invoice_sent" };

  // 5: work complete (either axis signals completion).
  if (office === "completed" || field === "completed") {
    return { state: "work_complete", reason: office === "completed" ? "office:completed" : "field:completed" };
  }

  // 6: on hold / waiting parts (either axis).
  if (field === "waiting_parts" || office === "waiting_parts") {
    return { state: "on_hold", reason: field === "waiting_parts" ? "field:waiting_parts" : "office:waiting_parts" };
  }

  // 7: actively working — the FIELD axis is authoritative for the on-site sub-phase.
  if (field === "working") {
    return { state: "in_progress", reason: "field:working" };
  }

  // 8: dispatched (technician accepted / en route / arrived, but not yet working).
  if (DISPATCH_FIELD.includes(field)) {
    return { state: "dispatched", reason: `field:${field}` };
  }

  // 9: office says in-progress while the field axis is still 'assigned' (fallback).
  if (office === "in_progress") {
    return { state: "in_progress", reason: "office:in_progress" };
  }

  // Quote states (estimate_sent/approved) belong to the Opportunity domain, not the
  // job-execution spine (approved decision #1). Project onto scheduled/new by visit.
  if (office === "estimate_sent" || office === "approved") {
    return hasActiveVisit
      ? { state: "scheduled", reason: `office:${office}+visit` }
      : { state: "new", reason: `office:${office}` };
  }

  // 9: scheduled (a visit exists, or the office says scheduled, or tech is assigned to one).
  if (office === "scheduled" || hasActiveVisit || (field === "assigned" && hasActiveVisit)) {
    return { state: "scheduled", reason: office === "scheduled" ? "office:scheduled" : "appointment:active" };
  }

  // 10: default.
  return { state: "new", reason: "default" };
}

// ── Allowed canonical transitions (for the guarded transition endpoint later) ──
export const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  new: ["scheduled", "cancelled"],
  scheduled: ["dispatched", "on_hold", "new", "cancelled"],
  dispatched: ["in_progress", "scheduled", "on_hold", "cancelled"],
  in_progress: ["on_hold", "work_complete", "cancelled"],
  on_hold: ["in_progress", "scheduled", "work_complete", "cancelled"],
  work_complete: ["invoiced", "closed", "in_progress" /* admin reopen */],
  invoiced: ["paid", "work_complete" /* admin void */],
  paid: ["closed", "invoiced" /* admin correction */],
  closed: ["in_progress" /* admin reopen */],
  cancelled: [],
};

export function isAllowedTransition(from: LifecycleState, to: LifecycleState): boolean {
  if (from === to) return true; // idempotent re-assert
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Labels ────────────────────────────────────────────────────────────────────
/** Internal (staff) labels. */
export const LIFECYCLE_LABELS_INTERNAL: Record<LifecycleState, string> = {
  new: "New",
  scheduled: "Scheduled",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  on_hold: "On Hold",
  work_complete: "Work Complete",
  invoiced: "Invoiced",
  paid: "Paid",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** Customer-facing (portal) labels — friendlier wording. */
export const LIFECYCLE_LABELS_CUSTOMER: Record<LifecycleState, string> = {
  new: "Requested",
  scheduled: "Scheduled",
  dispatched: "Technician en route",
  in_progress: "In progress",
  on_hold: "On hold",
  work_complete: "Completed",
  invoiced: "Invoice due",
  paid: "Paid",
  closed: "Closed",
  cancelled: "Cancelled",
};

// ── Mapping table (legacy → canonical), for docs, reconciliation & tests ────────
export const LEGACY_MAPPING: {
  canonical: LifecycleState;
  office: OfficeStatus[];
  field: TechnicianWorkStatus[];
  appointment: AppointmentStatus[];
}[] = [
  { canonical: "new", office: ["new"], field: [], appointment: [] },
  { canonical: "scheduled", office: ["scheduled", "estimate_sent", "approved"], field: ["assigned"], appointment: ["pending", "confirmed", "rescheduled"] },
  { canonical: "dispatched", office: ["in_progress"], field: ["accepted", "en_route", "arrived"], appointment: ["arrived"] },
  { canonical: "in_progress", office: ["in_progress"], field: ["working"], appointment: ["arrived"] },
  { canonical: "on_hold", office: ["waiting_parts"], field: ["waiting_parts"], appointment: [] },
  { canonical: "work_complete", office: ["completed"], field: ["completed"], appointment: ["completed"] },
  { canonical: "invoiced", office: ["invoice_sent"], field: [], appointment: [] },
  { canonical: "paid", office: ["paid"], field: [], appointment: [] },
  { canonical: "closed", office: ["closed"], field: [], appointment: [] },
  { canonical: "cancelled", office: ["cancelled"], field: [], appointment: ["cancelled"] },
];

// ── Reconciliation (report-only; NEVER repairs) ────────────────────────────────
export type ConflictTag =
  | "billed_before_field_complete"
  | "field_done_office_behind"
  | "office_done_field_behind"
  | "quote_state_on_job"
  | "scheduled_without_visit"
  | "cancelled_with_active_visit"
  | "persisted_drift";

export interface ReconciliationInput extends LifecycleInput {
  /** The persisted jobs.lifecycleState (may be null before backfill). */
  persistedState?: LifecycleState | null;
}

/**
 * Classify a job's legacy statuses into conflict tags. Pure; returns the tags that
 * apply (empty = consistent). Does NOT mutate or "fix" anything.
 */
export function classifyJobConflicts(input: ReconciliationInput): ConflictTag[] {
  const office = input.officeStatus;
  const field = input.technicianWorkStatus;
  const appts = input.appointmentStatuses ?? [];
  const hasAnyVisit = appts.length > 0;
  const hasActiveVisit = appts.some(a => ACTIVE_APPT.includes(a));
  const tags: ConflictTag[] = [];

  // Billed (or being billed) but the field work was never completed.
  if ((office === "paid" || office === "invoice_sent") && field !== "completed") {
    tags.push("billed_before_field_complete");
  }
  // Technician finished but the office pipeline is still upstream of completion.
  if (field === "completed" && ["new", "scheduled", "in_progress", "waiting_parts"].includes(office)) {
    tags.push("field_done_office_behind");
  }
  // Office marked completed but the technician axis never reached completed.
  if (office === "completed" && field !== "completed") {
    tags.push("office_done_field_behind");
  }
  // Quote/estimate state living on a job (belongs to the Opportunity pipeline).
  if (office === "estimate_sent" || office === "approved") {
    tags.push("quote_state_on_job");
  }
  // Office says scheduled/in-progress but there is no visit to back it.
  if ((office === "scheduled" || office === "in_progress") && !hasAnyVisit) {
    tags.push("scheduled_without_visit");
  }
  // Cancelled office but an appointment is still active (calendar event may linger).
  if (office === "cancelled" && hasActiveVisit) {
    tags.push("cancelled_with_active_visit");
  }
  // Persisted lifecycle disagrees with a fresh derivation (should never happen once
  // the reducer is the sole writer; flags stale/hand-edited rows).
  if (input.persistedState != null) {
    const derived = deriveJobLifecycle(input).state;
    if (input.persistedState !== derived) tags.push("persisted_drift");
  }
  return tags;
}
