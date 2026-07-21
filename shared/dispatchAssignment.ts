/**
 * Dispatch assignment (M2) — PURE validation + classification.
 *
 * The decision logic behind assign / reassign / unassign, with NO database and NO
 * side effects, so every branch is unit-testable in isolation. The server router
 * does the SELECT … FOR UPDATE, the atomic UPDATE+INSERT, and the transaction; it
 * delegates every "is this allowed?" and "what kind of change is this?" question
 * here. `appointments.assignedToId` stays authoritative — this module never reads
 * or mutates state, it only classifies a proposed change over projected values.
 */

/** Minimal projection of the appointment the mutation locked. */
export interface AssignmentAppointment {
  id: number;
  status: string;
  /** Current authoritative assignee (teamMembers.id) or null. */
  assignedToId: number | null;
}

/** Minimal projection of the target technician (null when unassigning). */
export interface AssignmentTechnician {
  id: number;
  status: "invited" | "active" | "suspended";
}

export type AssignmentAction = "assign" | "reassign" | "unassign";

/** A machine-readable rejection the router maps to a typed tRPC error. */
export type AssignmentRejectionCode =
  | "APPOINTMENT_CANCELLED"
  | "TECH_NOT_FOUND"
  | "TECH_NOT_ACTIVE"
  | "STALE_ASSIGNEE"; // client's expected assignee no longer matches → concurrency conflict

export type AssignmentDecision =
  | { ok: false; code: AssignmentRejectionCode; reason: string }
  /** A real change to persist + audit. */
  | { ok: true; changed: true; action: AssignmentAction; fromAssigneeId: number | null; toAssigneeId: number | null }
  /** Already in the requested state — succeed as a no-op, write NO audit row. */
  | { ok: true; changed: false; toAssigneeId: number | null };

/**
 * Decide the outcome of a proposed assignment.
 *
 * @param appt      the locked appointment row (authoritative current state)
 * @param targetId  the requested new assignee (teamMembers.id), or null to unassign
 * @param tech      the target technician row, or null when targetId is null / not found
 * @param expectedAssignedToId  what the client last saw as the assignee (stale-client guard).
 *                  `undefined` skips the check (not sent); `null`/number enforces it.
 */
export function decideAssignment(
  appt: AssignmentAppointment,
  targetId: number | null,
  tech: AssignmentTechnician | null,
  expectedAssignedToId: number | null | undefined,
): AssignmentDecision {
  // A cancelled visit is off the board — never assignable in either direction.
  if (appt.status === "cancelled")
    return { ok: false, code: "APPOINTMENT_CANCELLED", reason: "This appointment is cancelled and cannot be assigned." };

  // Stale-client guard: if the caller told us what it believed the current assignee
  // was and that no longer matches, someone else changed it first — do not clobber.
  if (expectedAssignedToId !== undefined && (appt.assignedToId ?? null) !== (expectedAssignedToId ?? null))
    return { ok: false, code: "STALE_ASSIGNEE", reason: "This visit was just reassigned by someone else. Refresh and try again." };

  // Assigning (not unassigning) requires a real, active technician.
  if (targetId !== null) {
    if (!tech) return { ok: false, code: "TECH_NOT_FOUND", reason: "That technician no longer exists." };
    if (tech.status !== "active") return { ok: false, code: "TECH_NOT_ACTIVE", reason: "That technician is not active." };
  }

  const from = appt.assignedToId ?? null;
  const to = targetId;

  // Same-assignee / already-unassigned → successful no-op, no audit event.
  if (from === to) return { ok: true, changed: false, toAssigneeId: to };

  const action: AssignmentAction = to === null ? "unassign" : from === null ? "assign" : "reassign";
  return { ok: true, changed: true, action, fromAssigneeId: from, toAssigneeId: to };
}
