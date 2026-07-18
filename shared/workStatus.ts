/**
 * Technician work status — the field lifecycle a technician moves a work order
 * (job) through while running a service call. This is DELIBERATELY SEPARATE from
 * both `appointments.status` (the dispatch/booking lifecycle) and `jobs.status`
 * (the office pipeline); it lives on its own `jobs.technicianWorkStatus` column
 * and an audit log (`jobWorkStatusEvents`). Nothing here touches those.
 *
 * Pure and framework-free so it can be unit-tested and shared by the client page
 * and the server procedure (single source of truth for labels, colors, and the
 * allowed transitions the server enforces).
 */

export const TECHNICIAN_WORK_STATUSES = [
  "assigned",
  "accepted",
  "en_route",
  "arrived",
  "working",
  "waiting_parts",
  "completed",
] as const;

export type TechnicianWorkStatus = (typeof TECHNICIAN_WORK_STATUSES)[number];

/** Default status for a work order that has never been actioned by a technician. */
export const DEFAULT_WORK_STATUS: TechnicianWorkStatus = "assigned";

export function isTechnicianWorkStatus(v: unknown): v is TechnicianWorkStatus {
  return typeof v === "string" && (TECHNICIAN_WORK_STATUSES as readonly string[]).includes(v);
}

/** Human labels. */
export const WORK_STATUS_LABEL: Record<TechnicianWorkStatus, string> = {
  assigned: "Assigned",
  accepted: "Accepted",
  en_route: "En Route",
  arrived: "Arrived",
  working: "Working",
  waiting_parts: "Waiting for Parts",
  completed: "Completed",
};

/** Badge color classes (Tailwind), matching the field app's badge idiom. */
export const WORK_STATUS_BADGE: Record<TechnicianWorkStatus, string> = {
  assigned: "bg-slate-100 text-slate-700 border-slate-200",
  accepted: "bg-sky-100 text-sky-700 border-sky-200",
  en_route: "bg-violet-100 text-violet-700 border-violet-200",
  arrived: "bg-indigo-100 text-indigo-700 border-indigo-200",
  working: "bg-amber-100 text-amber-700 border-amber-200",
  waiting_parts: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-green-100 text-green-700 border-green-200",
};

/**
 * The primary linear order used for the status timeline. `waiting_parts` is a
 * side-state off `working` (a pause), so the timeline shows the 6 main steps and
 * surfaces `waiting_parts` as an off-track state rather than a 7th step.
 */
export const WORK_STATUS_TIMELINE: TechnicianWorkStatus[] = [
  "assigned",
  "accepted",
  "en_route",
  "arrived",
  "working",
  "completed",
];

/** Position along the main timeline (waiting_parts maps to the "working" step). */
export function workStatusStep(status: TechnicianWorkStatus): number {
  if (status === "waiting_parts") return WORK_STATUS_TIMELINE.indexOf("working");
  return WORK_STATUS_TIMELINE.indexOf(status);
}

/**
 * Allowed forward transitions for the GENERIC status control. Guided and mostly
 * linear; `working` and `waiting_parts` can toggle. `completed` is a legitimate
 * terminal status but is DELIBERATELY NOT a target here: completing a work order
 * must go through the dedicated Complete Job action (`jobs.completeJob`), which
 * finalizes atomically — it stamps `completedAt`/actuals, writes the
 * `jobCompletions` snapshot, and enforces note/signature rules. Allowing the
 * generic status control to set `completed` produced a partial-completion glitch
 * (status flipped with no completion record); see fix/technician-field-defects.
 * The server enforces this map, so an illegal jump is rejected even if a client
 * sends it. `completeJob` sets `completed` directly (it does not consult this map).
 */
const TRANSITIONS: Record<TechnicianWorkStatus, TechnicianWorkStatus[]> = {
  assigned: ["accepted"],
  accepted: ["en_route"],
  en_route: ["arrived"],
  arrived: ["working"],
  working: ["waiting_parts"],
  waiting_parts: ["working"],
  completed: [],
};

/** The statuses a work order can move to next from `current`. */
export function nextWorkStatuses(current: TechnicianWorkStatus): TechnicianWorkStatus[] {
  return TRANSITIONS[current] ?? [];
}

/** True when moving `from → to` is a permitted single-step transition. */
export function canTransitionWorkStatus(
  from: TechnicianWorkStatus,
  to: TechnicianWorkStatus,
): boolean {
  return nextWorkStatuses(from).includes(to);
}

/** True once the work order has been completed (terminal). */
export function isWorkComplete(status: TechnicianWorkStatus): boolean {
  return status === "completed";
}
