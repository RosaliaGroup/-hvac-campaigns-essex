/**
 * Reporting lifecycle cutover — server-side helpers.
 *
 * Centralizes (a) the runtime feature flag, (b) the Drizzle predicate that the
 * Operations dashboard uses for the "terminal / completed-or-beyond" job set, and
 * (c) the admin comparison builder. Nothing here changes source data — every query
 * is read-only. Lifecycle membership itself lives in `@shared/reportingMetrics`
 * (one source of truth, unit-tested); this module only maps it onto Drizzle + the DB.
 */
import { and, eq, gte, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, appointments } from "../../drizzle/schema";
import { classifyJobConflicts, type AppointmentStatus } from "@shared/jobLifecycle";
import {
  REPORTING_METRICS,
  TERMINAL_JOB_STATUSES,
  TERMINAL_LIFECYCLE_STATES,
  computeMetricComparison,
  type JobStateRow,
  type MetricComparison,
} from "@shared/reportingMetrics";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type ReportingMode = "legacy" | "canonical";

/**
 * Runtime feature flag. Reporting uses the canonical lifecycle ONLY when
 * REPORTING_LIFECYCLE_ENABLED is exactly "true" (case-insensitive, trimmed).
 * Absent, "false", or any invalid value fails safely to legacy.
 */
export function isReportingLifecycleEnabled(): boolean {
  return String(process.env.REPORTING_LIFECYCLE_ENABLED ?? "").trim().toLowerCase() === "true";
}

export function reportingMode(): ReportingMode {
  return isReportingLifecycleEnabled() ? "canonical" : "legacy";
}

/**
 * Drizzle condition for the terminal ("completed-or-beyond", revenue-phase) job set.
 * Legacy: jobs.status ∈ TERMINAL_JOB_STATUSES.
 * Canonical: jobs.lifecycleState ∈ TERMINAL_LIFECYCLE_STATES, with a NULL-lifecycle
 * fallback to the legacy status set so no job is ever silently dropped.
 */
export function terminalJobCondition(mode: ReportingMode): SQL {
  if (mode === "legacy") {
    return inArray(jobs.status, [...TERMINAL_JOB_STATUSES]) as SQL;
  }
  return or(
    inArray(jobs.lifecycleState, [...TERMINAL_LIFECYCLE_STATES]),
    and(isNull(jobs.lifecycleState), inArray(jobs.status, [...TERMINAL_JOB_STATUSES])),
  ) as SQL;
}

export interface ComparisonFilters {
  customerId?: number;
  technicianId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Pure builder for the comparison's job WHERE conditions. Mirrors the dashboard's
 * filter behavior exactly: customer + technician (assignee) + a date window on
 * jobs.completedAt. Exported so filtering is unit-testable without a DB.
 */
export function comparisonJobConditions(filters: ComparisonFilters): SQL[] {
  const conds: SQL[] = [];
  if (filters.customerId != null) conds.push(eq(jobs.customerId, filters.customerId));
  if (filters.technicianId != null) conds.push(eq(jobs.assignedToId, filters.technicianId));
  if (filters.dateFrom) conds.push(gte(jobs.completedAt, filters.dateFrom));
  if (filters.dateTo) conds.push(lte(jobs.completedAt, filters.dateTo));
  return conds;
}

export interface MetricComparisonWithClassifiers extends MetricComparison {
  label: string;
  /** Reconciliation conflict-tag counts across the jobs that diverge (legacy-only ∪ canonical-only). */
  reconciliationClassifiers: Record<string, number>;
}

export interface ReportingComparison {
  mode: ReportingMode;
  flagEnabled: boolean;
  filters: { customerId?: number; technicianId?: number; dateFrom?: string; dateTo?: string };
  totalJobsConsidered: number;
  metrics: MetricComparisonWithClassifiers[];
}

/**
 * Read-only admin comparison of legacy vs canonical membership for every reporting
 * metric. Applies the SAME customer/technician/date filters the dashboard uses
 * (date range on jobs.completedAt). Returns per-metric counts, deltas, the affected
 * job-ID sets, null-lifecycle jobs, and reconciliation classifiers for the divergent
 * jobs. Executes only SELECTs — never writes, never mutates a job.
 */
export async function buildReportingComparison(db: Db, filters: ComparisonFilters): Promise<ReportingComparison> {
  const conds = comparisonJobConditions(filters);

  const rows = await db
    .select({
      id: jobs.id,
      status: jobs.status,
      technicianWorkStatus: jobs.technicianWorkStatus,
      lifecycleState: jobs.lifecycleState,
    })
    .from(jobs)
    .where(conds.length ? and(...conds) : undefined);

  // Appointment statuses (for reconciliation classifiers) — one lean query.
  const jobIds = rows.map(r => r.id);
  const apptByJob = new Map<number, AppointmentStatus[]>();
  if (jobIds.length) {
    const apptRows = await db
      .select({ jobId: appointments.jobId, status: appointments.status })
      .from(appointments)
      .where(inArray(appointments.jobId, jobIds));
    for (const a of apptRows) {
      if (a.jobId == null) continue;
      const list = apptByJob.get(a.jobId) ?? [];
      list.push(a.status as AppointmentStatus);
      apptByJob.set(a.jobId, list);
    }
  }

  const jobById = new Map(rows.map(r => [r.id, r]));
  const stateRows: JobStateRow[] = rows.map(r => ({ id: r.id, status: r.status, lifecycleState: r.lifecycleState }));

  const metrics: MetricComparisonWithClassifiers[] = REPORTING_METRICS.map(m => {
    const cmp = computeMetricComparison(stateRows, m);
    const divergent = Array.from(new Set<number>([...cmp.legacyOnlyJobIds, ...cmp.canonicalOnlyJobIds]));
    const reconciliationClassifiers: Record<string, number> = {};
    for (const id of divergent) {
      const r = jobById.get(id);
      if (!r) continue;
      const tags = classifyJobConflicts({
        officeStatus: r.status,
        technicianWorkStatus: r.technicianWorkStatus,
        appointmentStatuses: apptByJob.get(id) ?? [],
        persistedState: r.lifecycleState,
      });
      for (const t of tags) reconciliationClassifiers[t] = (reconciliationClassifiers[t] ?? 0) + 1;
    }
    return { ...cmp, label: m.label, reconciliationClassifiers };
  });

  return {
    mode: reportingMode(),
    flagEnabled: isReportingLifecycleEnabled(),
    filters: {
      customerId: filters.customerId,
      technicianId: filters.technicianId,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    },
    totalJobsConsidered: rows.length,
    metrics,
  };
}
