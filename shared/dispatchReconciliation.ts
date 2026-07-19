/**
 * Dispatch reconciliation (M0) — PURE, read-only, report-only.
 *
 * Answers one question: "would the Dispatch board show anything inaccurate?" It
 * compares jobs, appointments, technician assignments, technicianWorkStatus and
 * completion snapshots and returns a deterministic list of inconsistencies. It
 * NEVER mutates or repairs anything — remediation text is advisory only.
 *
 * Reuse, not duplication: the job status-axis conflicts (office ↔ field ↔ visit)
 * are delegated to `classifyJobConflicts` from the canonical lifecycle module
 * (PR #57). This module adds only the DISPATCH-specific, cross-entity checks that
 * the lifecycle reconciliation does not cover — assignment integrity, dangling
 * references, completion-snapshot presence, scheduling gaps, and map readiness.
 * `persisted_drift` is intentionally left to `jobs.lifecycleReconciliation`.
 *
 * No DB, no I/O, no Date.now() dependence in the analysis — same dataset in →
 * same report out (acceptance criterion: deterministic & repeatable).
 */
import {
  classifyJobConflicts,
  type ConflictTag,
  type OfficeStatus,
  type TechnicianWorkStatus,
  type AppointmentStatus,
} from "./jobLifecycle";

// ── Finding model ──────────────────────────────────────────────────────────────
export type Severity = "high" | "medium" | "low" | "info";
export type EntityKind = "job" | "appointment" | "assignment" | "completion" | "property";

export interface DispatchFinding {
  /** Stable check identifier (groups findings; deterministic ordering key). */
  checkId: string;
  severity: Severity;
  entity: EntityKind;
  /** Primary offending record id (job id or appointment id). */
  recordId: number;
  /** Secondary id when the finding is a relationship (e.g. the other side). */
  relatedId: number | null;
  problem: string;
  /** Advisory only — M0 performs NO remediation. */
  remediation: string;
}

// ── Read-only dataset projections (what the server SELECTs, nothing more) ────────
export interface DsJob {
  id: number;
  jobNumber: string | null;
  officeStatus: OfficeStatus;
  technicianWorkStatus: TechnicianWorkStatus;
  assignedToId: number | null;
  customerId: number | null;
  propertyId: number | null;
  /** jobs.completedAt (the office completion stamp). */
  completedAt: Date | string | null;
}
export interface DsAppointment {
  id: number;
  jobId: number | null;
  assignedToId: number | null;
  customerId: number | null;
  propertyId: number | null;
  status: AppointmentStatus;
  scheduledAt: Date | string | null;
  /** True when the appointment carries its own usable address text (propertyAddress). */
  hasAddressText: boolean;
}
export interface DsTeamMember { id: number; status: "invited" | "active" | "suspended" }
export interface DsCompletion { jobId: number; completedAt: Date | string | null }
export interface DsProperty { id: number; hasAddress: boolean }

export interface DispatchDataset {
  jobs: DsJob[];
  appointments: DsAppointment[];
  teamMembers: DsTeamMember[];
  completions: DsCompletion[];
  properties: DsProperty[];
}

// ── Check catalog — every check the report can surface (count 0 when none) ───────
export interface CheckDef { id: string; title: string; entity: EntityKind; severity: Severity; remediation: string }

/** Severity + wording for the reused job status-axis conflict tags. */
const TAG_META: Record<Exclude<ConflictTag, "persisted_drift">, { severity: Severity; title: string; remediation: string }> = {
  billed_before_field_complete: { severity: "high", title: "Billed before field work completed", remediation: "Confirm the field work actually finished before invoicing; correct the job status." },
  office_done_field_behind:     { severity: "medium", title: "Office completed, field not completed", remediation: "Reconcile the technician work status with the office completion." },
  field_done_office_behind:     { severity: "low", title: "Field completed, office pipeline behind", remediation: "Advance the office status to reflect completed field work." },
  cancelled_with_active_visit:  { severity: "medium", title: "Cancelled job with an active visit", remediation: "Cancel or reschedule the lingering appointment so it leaves the board." },
  scheduled_without_visit:      { severity: "low", title: "Scheduled/in-progress with no visit", remediation: "Create the visit, or correct the office status." },
  quote_state_on_job:           { severity: "info", title: "Quote/estimate state on a job", remediation: "Belongs to the Opportunity pipeline; informational only." },
};

const TAG_PROBLEM: Record<Exclude<ConflictTag, "persisted_drift">, string> = {
  billed_before_field_complete: "Job is invoiced/paid but technicianWorkStatus never reached 'completed'.",
  office_done_field_behind: "jobs.status='completed' but technicianWorkStatus is not 'completed'.",
  field_done_office_behind: "technicianWorkStatus='completed' but jobs.status is still upstream.",
  cancelled_with_active_visit: "jobs.status='cancelled' but an appointment is still active.",
  scheduled_without_visit: "jobs.status says scheduled/in_progress but the job has no appointment.",
  quote_state_on_job: "jobs.status is a quote state (estimate_sent/approved).",
};

export const DISPATCH_CHECKS: CheckDef[] = [
  // Reused status-axis (job lifecycle) checks
  ...(
    (Object.keys(TAG_META) as Array<Exclude<ConflictTag, "persisted_drift">>).map((t): CheckDef => ({
      id: "LC_" + t.toUpperCase(), title: TAG_META[t].title, entity: "job", severity: TAG_META[t].severity, remediation: TAG_META[t].remediation,
    }))
  ),
  // Completion-snapshot checks (dispatch-specific — not covered by lifecycle reconciliation)
  { id: "COMPLETION_MISSING_SNAPSHOT", title: "Completed work status with no completion snapshot", entity: "completion", severity: "high", remediation: "Investigate the partial completion; snapshot must exist for a completed job. Remediate via the approved Complete Job path — not M0." },
  { id: "COMPLETION_ORPHAN_SNAPSHOT", title: "Completion snapshot but work status not completed", entity: "completion", severity: "medium", remediation: "Reconcile technicianWorkStatus to the snapshot (status/snapshot mismatch)." },
  { id: "COMPLETION_TIMESTAMP_DRIFT", title: "Job completedAt disagrees with snapshot", entity: "completion", severity: "low", remediation: "Align jobs.completedAt to the authoritative snapshot timestamp." },
  { id: "COMPLETION_DUPLICATE_SNAPSHOT", title: "More than one completion snapshot for a job", entity: "completion", severity: "high", remediation: "Integrity violation (jobCompletions.jobId is UNIQUE); investigate data source." },
  // Assignment integrity
  { id: "ASSIGN_APPT_INACTIVE_TECH", title: "Appointment assigned to an inactive/missing technician", entity: "assignment", severity: "high", remediation: "Reassign to an active technician; the board lane is otherwise wrong or empty." },
  { id: "ASSIGN_JOB_INACTIVE_TECH", title: "Job assigned to an inactive/missing technician", entity: "assignment", severity: "medium", remediation: "Reassign the job's primary technician to an active member." },
  { id: "ASSIGN_APPT_JOB_MISMATCH", title: "Appointment and its job disagree on the assignee", entity: "assignment", severity: "medium", remediation: "Decide the authoritative assignee; the board and work order otherwise disagree." },
  { id: "ASSIGN_APPT_UNSCHEDULED", title: "Assigned appointment with no scheduled time", entity: "appointment", severity: "medium", remediation: "Schedule the visit or clear the assignment; board placement is ambiguous." },
  // Reference integrity
  { id: "LINK_APPT_DANGLING_JOB", title: "Appointment points to a missing job", entity: "appointment", severity: "high", remediation: "Repoint or clear appointments.jobId; the visit cannot resolve its job." },
  { id: "LINK_APPT_CUSTOMER_MISMATCH", title: "Appointment and job disagree on the customer", entity: "appointment", severity: "medium", remediation: "Correct the appointment or job customer link." },
  { id: "LINK_APPT_PROPERTY_MISMATCH", title: "Appointment and job disagree on the property", entity: "appointment", severity: "low", remediation: "Correct the appointment or job property link (affects the map pin)." },
  // Scheduling data quality
  { id: "SCHED_CONFIRMED_NO_TIME", title: "Confirmed/arrived appointment with no scheduled time", entity: "appointment", severity: "medium", remediation: "Set scheduledAt; a confirmed visit must have a time to appear correctly." },
  // Map readiness (informational)
  { id: "READY_NO_ADDRESS", title: "Scheduled visit with no usable address", entity: "property", severity: "info", remediation: "Add a property address so the visit can be geocoded and pinned (map lands in M5)." },
];

// ── Report shape ────────────────────────────────────────────────────────────────
export interface CheckResult { id: string; title: string; entity: EntityKind; severity: Severity; count: number }
export type BoardAccuracyVerdict = "clean" | "minor" | "inaccurate";
export interface DispatchReconciliationReport {
  generatedAt: string | null;
  scope: { jobs: number; appointments: number; completions: number; teamMembers: number; properties: number };
  summary: {
    totalChecks: number;
    totalFindings: number;
    findingsBySeverity: Record<Severity, number>;
    boardAccuracyVerdict: BoardAccuracyVerdict;
    readOnly: true;
  };
  checks: CheckResult[];
  findings: DispatchFinding[];
}

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
const ACTIVE_APPT: AppointmentStatus[] = ["pending", "confirmed", "rescheduled", "arrived"];

function instant(v: Date | string | null): number | null {
  if (v == null) return null;
  const t = new Date(v as any).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Run every dispatch reconciliation check against a dataset. Pure & deterministic:
 * findings are sorted by (severity, checkId, recordId, relatedId). `generatedAt`
 * is metadata supplied by the caller (defaults null) and does not affect analysis.
 */
export function runDispatchReconciliation(
  ds: DispatchDataset,
  opts: { generatedAt?: string | null } = {},
): DispatchReconciliationReport {
  const jobById = new Map<number, DsJob>(ds.jobs.map(j => [j.id, j]));
  const teamById = new Map<number, DsTeamMember>(ds.teamMembers.map(m => [m.id, m]));
  const propById = new Map<number, DsProperty>(ds.properties.map(p => [p.id, p]));
  const completionsByJob = new Map<number, DsCompletion[]>();
  for (const c of ds.completions) { const a = completionsByJob.get(c.jobId) ?? []; a.push(c); completionsByJob.set(c.jobId, a); }
  const apptsByJob = new Map<number, DsAppointment[]>();
  for (const a of ds.appointments) { if (a.jobId == null) continue; const arr = apptsByJob.get(a.jobId) ?? []; arr.push(a); apptsByJob.set(a.jobId, arr); }

  const F: DispatchFinding[] = [];
  const add = (checkId: string, entity: EntityKind, severity: Severity, recordId: number, problem: string, remediation: string, relatedId: number | null = null) =>
    F.push({ checkId, severity, entity, recordId, relatedId, problem, remediation });

  const activeTech = (id: number | null): boolean => { if (id == null) return true; const m = teamById.get(id); return !!m && m.status === "active"; };

  // ── Per-job checks ──
  for (const j of ds.jobs) {
    // Reused status-axis conflicts (no persistedState → skip persisted_drift, owned by lifecycleReconciliation)
    const apptStatuses = (apptsByJob.get(j.id) ?? []).map(a => a.status);
    const tags = classifyJobConflicts({ officeStatus: j.officeStatus, technicianWorkStatus: j.technicianWorkStatus, appointmentStatuses: apptStatuses });
    for (const t of tags) {
      if (t === "persisted_drift") continue;
      const meta = TAG_META[t]; if (!meta) continue;
      add("LC_" + t.toUpperCase(), "job", meta.severity, j.id, TAG_PROBLEM[t], meta.remediation);
    }

    // Completion-snapshot integrity
    const comps = completionsByJob.get(j.id) ?? [];
    const isCompleted = j.technicianWorkStatus === "completed";
    if (isCompleted && comps.length === 0)
      add("COMPLETION_MISSING_SNAPSHOT", "completion", "high", j.id, "technicianWorkStatus='completed' but there is no jobCompletions snapshot (partial completion).", def("COMPLETION_MISSING_SNAPSHOT"));
    if (!isCompleted && comps.length > 0)
      add("COMPLETION_ORPHAN_SNAPSHOT", "completion", "medium", j.id, "A completion snapshot exists but technicianWorkStatus is '" + j.technicianWorkStatus + "'.", def("COMPLETION_ORPHAN_SNAPSHOT"));
    if (comps.length > 1)
      add("COMPLETION_DUPLICATE_SNAPSHOT", "completion", "high", j.id, comps.length + " completion snapshots for one job.", def("COMPLETION_DUPLICATE_SNAPSHOT"));
    if (comps.length === 1) {
      const a = instant(j.completedAt), b = instant(comps[0].completedAt);
      if (a != null && b != null && a !== b)
        add("COMPLETION_TIMESTAMP_DRIFT", "completion", "low", j.id, "jobs.completedAt differs from the completion snapshot timestamp.", def("COMPLETION_TIMESTAMP_DRIFT"));
    }

    // Job assignee active?
    if (j.assignedToId != null && !activeTech(j.assignedToId))
      add("ASSIGN_JOB_INACTIVE_TECH", "assignment", "medium", j.id, "Job assigned to technician #" + j.assignedToId + " who is not active.", def("ASSIGN_JOB_INACTIVE_TECH"), j.assignedToId);
  }

  // ── Per-appointment checks ──
  for (const a of ds.appointments) {
    const job = a.jobId != null ? jobById.get(a.jobId) : undefined;

    if (a.assignedToId != null && !activeTech(a.assignedToId))
      add("ASSIGN_APPT_INACTIVE_TECH", "assignment", "high", a.id, "Appointment assigned to technician #" + a.assignedToId + " who is not active.", def("ASSIGN_APPT_INACTIVE_TECH"), a.assignedToId);

    if (a.assignedToId != null && instant(a.scheduledAt) == null)
      add("ASSIGN_APPT_UNSCHEDULED", "appointment", "medium", a.id, "Appointment is assigned but has no scheduledAt.", def("ASSIGN_APPT_UNSCHEDULED"), a.assignedToId);

    if ((a.status === "confirmed" || a.status === "arrived") && instant(a.scheduledAt) == null)
      add("SCHED_CONFIRMED_NO_TIME", "appointment", "medium", a.id, "Appointment status is '" + a.status + "' but has no scheduledAt.", def("SCHED_CONFIRMED_NO_TIME"));

    if (a.jobId != null && !job)
      add("LINK_APPT_DANGLING_JOB", "appointment", "high", a.id, "appointments.jobId=" + a.jobId + " references a job that does not exist.", def("LINK_APPT_DANGLING_JOB"), a.jobId);

    if (job) {
      if (a.assignedToId != null && job.assignedToId != null && a.assignedToId !== job.assignedToId)
        add("ASSIGN_APPT_JOB_MISMATCH", "assignment", "medium", a.id, "Appointment assignee #" + a.assignedToId + " ≠ job assignee #" + job.assignedToId + ".", def("ASSIGN_APPT_JOB_MISMATCH"), job.id);
      if (a.customerId != null && job.customerId != null && a.customerId !== job.customerId)
        add("LINK_APPT_CUSTOMER_MISMATCH", "appointment", "medium", a.id, "Appointment customer #" + a.customerId + " ≠ job customer #" + job.customerId + ".", def("LINK_APPT_CUSTOMER_MISMATCH"), job.id);
      if (a.propertyId != null && job.propertyId != null && a.propertyId !== job.propertyId)
        add("LINK_APPT_PROPERTY_MISMATCH", "appointment", "low", a.id, "Appointment property #" + a.propertyId + " ≠ job property #" + job.propertyId + ".", def("LINK_APPT_PROPERTY_MISMATCH"), job.id);
    }

    // Map readiness: an active, scheduled visit has no pin only when NEITHER the
    // appointment's own address text NOR its linked property provides an address.
    const isActiveScheduled = ACTIVE_APPT.includes(a.status) && instant(a.scheduledAt) != null;
    if (isActiveScheduled && !a.hasAddressText) {
      const prop = a.propertyId != null ? propById.get(a.propertyId) : undefined;
      const propHasAddress = !!prop && prop.hasAddress;
      if (!propHasAddress)
        add("READY_NO_ADDRESS", "appointment", "info", a.id, "Scheduled visit has no usable address (neither the appointment nor its linked property); it cannot be mapped.", def("READY_NO_ADDRESS"), a.propertyId);
    }
  }

  // Deterministic ordering
  F.sort((x, y) =>
    SEV_RANK[x.severity] - SEV_RANK[y.severity] ||
    x.checkId.localeCompare(y.checkId) ||
    x.recordId - y.recordId ||
    (x.relatedId ?? 0) - (y.relatedId ?? 0));

  const countByCheck = new Map<string, number>();
  for (const f of F) countByCheck.set(f.checkId, (countByCheck.get(f.checkId) ?? 0) + 1);
  const checks: CheckResult[] = DISPATCH_CHECKS
    .map(c => ({ id: c.id, title: c.title, entity: c.entity, severity: c.severity, count: countByCheck.get(c.id) ?? 0 }))
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.id.localeCompare(b.id));

  const findingsBySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of F) findingsBySeverity[f.severity]++;
  const verdict: BoardAccuracyVerdict = findingsBySeverity.high > 0 ? "inaccurate" : findingsBySeverity.medium > 0 ? "minor" : "clean";

  return {
    generatedAt: opts.generatedAt ?? null,
    scope: { jobs: ds.jobs.length, appointments: ds.appointments.length, completions: ds.completions.length, teamMembers: ds.teamMembers.length, properties: ds.properties.length },
    summary: { totalChecks: DISPATCH_CHECKS.length, totalFindings: F.length, findingsBySeverity, boardAccuracyVerdict: verdict, readOnly: true },
    checks,
    findings: F,
  };
}

/** Lookup a check's advisory remediation text by id (single source of wording). */
function def(id: string): string {
  const c = DISPATCH_CHECKS.find(x => x.id === id);
  return c ? c.remediation : "";
}
