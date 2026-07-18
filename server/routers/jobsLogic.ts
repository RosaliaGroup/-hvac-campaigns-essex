/**
 * Pure logic for the Jobs module — kept DB-free so the filter/sort/totals/
 * validation rules are unit-tested directly (the vitest env has no DB/DOM).
 * The router (jobs.ts) composes these; nothing here performs I/O.
 */

/** Stored job status values (NEVER renamed — UI labels live separately). */
export const JOB_STATUSES = [
  "new", "scheduled", "in_progress", "waiting_parts", "estimate_sent",
  "approved", "completed", "invoice_sent", "paid", "closed", "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Human-readable labels for the stored status values. Presentation only — the
 * stored enum values are unchanged (see feedback: preserve internal values,
 * relabel in the UI).
 */
export const JOB_STATUS_LABELS: Record<string, string> = {
  new: "Unscheduled",
  scheduled: "Scheduled",
  in_progress: "On Site / In Progress",
  waiting_parts: "Waiting for Parts",
  estimate_sent: "Waiting for Approval",
  approved: "Approved",
  completed: "Completed",
  invoice_sent: "Invoice Sent",
  paid: "Paid",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

/** Statuses that are no longer active work — used for the "open jobs" rollups. */
export const TERMINAL_JOB_STATUSES = new Set(["completed", "invoice_sent", "paid", "closed", "cancelled"]);

// ── Sorting ──────────────────────────────────────────────────────────────

/** Columns the jobs list may be sorted by (allow-list; anything else falls back). */
export const JOB_SORT_FIELDS = [
  "createdAt", "updatedAt", "scheduledStartAt", "jobNumber", "status", "priority",
] as const;
export type JobSortField = (typeof JOB_SORT_FIELDS)[number];

/** Resolve a caller-supplied sort into a safe {field, desc}. Defaults to newest-first. */
export function resolveJobSort(
  sortBy: string | undefined,
  dir: "asc" | "desc" | undefined,
): { field: JobSortField; desc: boolean } {
  const field = (JOB_SORT_FIELDS as readonly string[]).includes(sortBy ?? "")
    ? (sortBy as JobSortField)
    : "createdAt";
  const desc = dir ? dir === "desc" : true;
  return { field, desc };
}

// ── Labor / parts math ───────────────────────────────────────────────────

/**
 * Minutes of labor for an entry. Explicit durationMinutes wins; otherwise it is
 * derived from start/end. Returns null when neither is available, and never a
 * negative number (guards against end-before-start).
 */
export function computeLaborMinutes(input: {
  durationMinutes?: number | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
}): number | null {
  if (input.durationMinutes != null && Number.isFinite(input.durationMinutes)) {
    return Math.max(0, Math.round(input.durationMinutes));
  }
  if (input.startTime && input.endTime) {
    const a = new Date(input.startTime).getTime();
    const b = new Date(input.endTime).getTime();
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(0, Math.round((b - a) / 60000));
  }
  return null;
}

/** quantity × unitPrice, rounded to cents, as a MySQL-safe decimal string. */
export function money(quantity: number, unit: number): string {
  return (Math.round(quantity * unit * 100) / 100).toFixed(2);
}

/** Customer-facing total for a part row. */
export function partLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/** Internal margin for a part row (price − cost) × qty. Can be negative. */
export function partMargin(quantity: number, unitCost: number, unitPrice: number): number {
  return Math.round(quantity * (unitPrice - unitCost) * 100) / 100;
}

export interface PartLike { quantity: string | number; unitCost: string | number; unitPrice: string | number; billable: boolean; }

/** Roll up parts into billable/total/cost/margin. Non-billable rows excluded from the customer total. */
export function summarizeParts(parts: PartLike[]): {
  total: number; billableTotal: number; cost: number; margin: number;
} {
  let total = 0, billableTotal = 0, cost = 0;
  for (const p of parts) {
    const q = Number(p.quantity) || 0;
    const price = Number(p.unitPrice) || 0;
    const c = Number(p.unitCost) || 0;
    const line = Math.round(q * price * 100) / 100;
    total += line;
    if (p.billable) billableTotal += line;
    cost += Math.round(q * c * 100) / 100;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { total: round(total), billableTotal: round(billableTotal), cost: round(cost), margin: round(billableTotal - cost) };
}

// ── Status transition side-effects ────────────────────────────────────────

/**
 * Which actual-timestamp fields a status change should stamp. Pure so the
 * "moving to in_progress records arrival; completing records completion; and
 * neither overwrites an existing value" rules are unit-tested directly.
 * Returns only the fields to set (empty object = stamp nothing).
 */
export function statusTransitionStamps(
  toStatus: string,
  existing: { actualArrivalAt?: Date | string | null; completedAt?: Date | string | null; actualCompletionAt?: Date | string | null },
  now: Date,
): { actualArrivalAt?: Date; completedAt?: Date; actualCompletionAt?: Date } {
  const patch: { actualArrivalAt?: Date; completedAt?: Date; actualCompletionAt?: Date } = {};
  if (toStatus === "in_progress" && !existing.actualArrivalAt) patch.actualArrivalAt = now;
  if (toStatus === "completed") {
    if (!existing.completedAt) patch.completedAt = now;
    if (!existing.actualCompletionAt) patch.actualCompletionAt = now;
  }
  return patch;
}

// ── Relationship validation (invalid-relationship prevention) ──────────────

/**
 * A property may only be attached to a job when it belongs to the job's
 * customer. Returns true when valid. `propertyCustomerId` is the customerId of
 * the property row (or null if the property does not exist).
 */
export function propertyBelongsToCustomer(
  propertyCustomerId: number | null | undefined,
  jobCustomerId: number,
): boolean {
  return propertyCustomerId != null && propertyCustomerId === jobCustomerId;
}

/**
 * The archived filter → which rows to include.
 *  - "active"  (default): archivedAt IS NULL
 *  - "archived": archivedAt IS NOT NULL
 *  - "all": no archived constraint
 */
export type ArchivedFilter = "active" | "archived" | "all";
export function normalizeArchivedFilter(v: string | undefined): ArchivedFilter {
  return v === "archived" || v === "all" ? v : "active";
}

/**
 * Field work-order access rule (pure, exhaustively testable). A technician may
 * open a work order only if it is assigned to them — directly (job assignee),
 * via a linked appointment they own, or as an additional technician on the job.
 * Admins may open any. Enforced server-side; the client cannot widen it.
 */
export function canAccessWorkOrder(input: {
  isAdmin: boolean;
  /** Resolved teamMembers.id for the caller, or null for non-team (OAuth) users. */
  memberId: number | null;
  assignedToId: number | null;
  /** True if a linked appointment is assigned to the caller. */
  viaAppointment: boolean;
  /** True if the caller is an additional technician on the job. */
  viaTechnician: boolean;
}): boolean {
  if (input.isAdmin) return true;
  if (input.memberId == null) return false;
  return (
    input.assignedToId === input.memberId ||
    input.viaAppointment ||
    input.viaTechnician
  );
}
