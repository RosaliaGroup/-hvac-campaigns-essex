/**
 * Centralized reporting metric definitions + pure comparison logic for the
 * job-state / revenue-phase Reporting cutover. One source of truth for legacy
 * (jobs.status) vs canonical (jobs.lifecycleState) membership so routers and tests
 * never duplicate lifecycle predicates. Pure — no DB, no env, no side effects.
 */
import type { OfficeStatus, LifecycleState } from "./jobLifecycle";

export const TERMINAL_JOB_STATUSES: OfficeStatus[] = ["completed", "invoice_sent", "paid", "closed"];
export const TERMINAL_LIFECYCLE_STATES: LifecycleState[] = ["work_complete", "invoiced", "paid", "closed"];

export interface ReportingMetric {
  key: string;
  label: string;
  /** Legacy membership: jobs.status ∈ these. */
  legacyStatuses: OfficeStatus[];
  /** Canonical membership: jobs.lifecycleState ∈ these. */
  canonicalStates: LifecycleState[];
}

/**
 * Exact lifecycle membership for each approved metric. `terminal_jobs` is the
 * revenue-phase aggregate the Operations dashboard actually renders as
 * "Jobs Completed"/"Technician Revenue"; the per-phase entries power the comparison
 * endpoint. `in_progress` maps to {in_progress, dispatched} because the legacy
 * office status `in_progress` spans both on-site sub-phases.
 */
export const REPORTING_METRICS: ReportingMetric[] = [
  { key: "jobs_scheduled",   label: "Jobs Scheduled",   legacyStatuses: ["scheduled"],    canonicalStates: ["scheduled"] },
  { key: "jobs_in_progress", label: "Jobs In Progress", legacyStatuses: ["in_progress"],  canonicalStates: ["in_progress", "dispatched"] },
  { key: "jobs_completed",   label: "Jobs Completed",   legacyStatuses: ["completed"],    canonicalStates: ["work_complete"] },
  { key: "jobs_invoiced",    label: "Jobs Invoiced",    legacyStatuses: ["invoice_sent"], canonicalStates: ["invoiced"] },
  { key: "jobs_paid",        label: "Jobs Paid",        legacyStatuses: ["paid"],         canonicalStates: ["paid"] },
  { key: "jobs_closed",      label: "Jobs Closed",      legacyStatuses: ["closed"],       canonicalStates: ["closed"] },
  { key: "terminal_jobs",    label: "Completed (revenue phase)", legacyStatuses: [...TERMINAL_JOB_STATUSES], canonicalStates: [...TERMINAL_LIFECYCLE_STATES] },
];

export function getReportingMetric(key: string): ReportingMetric | undefined {
  return REPORTING_METRICS.find(m => m.key === key);
}

export interface JobStateRow { id: number; status: OfficeStatus; lifecycleState: LifecycleState | null; }

export interface MetricComparison {
  metric: string;
  legacyCount: number;
  canonicalCount: number;
  /** canonical − legacy (can be negative; either direction is a valid mismatch). */
  delta: number;
  matchingJobIds: number[];
  legacyOnlyJobIds: number[];
  canonicalOnlyJobIds: number[];
  nullLifecycleJobIds: number[];
}

function inLegacy(m: ReportingMetric, r: JobStateRow): boolean {
  return m.legacyStatuses.includes(r.status);
}
/**
 * Canonical membership. Null lifecycleState FALLS BACK to the legacy calculation so a
 * job is never silently excluded; null jobs are reported separately.
 */
function inCanonical(m: ReportingMetric, r: JobStateRow): boolean {
  if (r.lifecycleState == null) return inLegacy(m, r);
  return m.canonicalStates.includes(r.lifecycleState);
}

/** Pure comparison of legacy vs canonical membership for one metric over a row set. */
export function computeMetricComparison(rows: JobStateRow[], m: ReportingMetric): MetricComparison {
  const legacy = new Set<number>();
  const canonical = new Set<number>();
  const nullLc = new Set<number>();
  for (const r of rows) {
    const l = inLegacy(m, r);
    const c = inCanonical(m, r);
    if (l) legacy.add(r.id);
    if (c) canonical.add(r.id);
    if (r.lifecycleState == null && (l || c)) nullLc.add(r.id);
  }
  const legacyArr = Array.from(legacy);
  const canonicalArr = Array.from(canonical);
  const asc = (a: number, b: number) => a - b;
  return {
    metric: m.key,
    legacyCount: legacy.size,
    canonicalCount: canonical.size,
    delta: canonical.size - legacy.size,
    matchingJobIds: legacyArr.filter(id => canonical.has(id)).sort(asc),
    legacyOnlyJobIds: legacyArr.filter(id => !canonical.has(id)).sort(asc),
    canonicalOnlyJobIds: canonicalArr.filter(id => !legacy.has(id)).sort(asc),
    nullLifecycleJobIds: Array.from(nullLc).sort(asc),
  };
}
