/**
 * Reporting metric mapping + legacy-vs-canonical comparison (pure logic).
 *
 * These are the CANONICAL membership contracts the Reporting cutover depends on.
 * They pin down, per metric, exactly which office statuses (legacy) and which
 * lifecycle states (canonical) count — plus the null-lifecycle fallback and the
 * per-phase / terminal comparisons. No DB, no flag, no env.
 */
import { describe, expect, it } from "vitest";
import {
  REPORTING_METRICS,
  TERMINAL_JOB_STATUSES,
  TERMINAL_LIFECYCLE_STATES,
  getReportingMetric,
  computeMetricComparison,
  type JobStateRow,
} from "./reportingMetrics";
import type { OfficeStatus, LifecycleState } from "./jobLifecycle";

const metric = (k: string) => {
  const m = getReportingMetric(k);
  if (!m) throw new Error(`missing metric ${k}`);
  return m;
};
const row = (id: number, status: OfficeStatus, lifecycleState: LifecycleState | null): JobStateRow => ({
  id,
  status,
  lifecycleState,
});

describe("reportingMetrics — canonical membership mapping", () => {
  it("defines the exact legacy↔canonical mapping for every approved metric", () => {
    expect(metric("jobs_scheduled").legacyStatuses).toEqual(["scheduled"]);
    expect(metric("jobs_scheduled").canonicalStates).toEqual(["scheduled"]);

    // Legacy office `in_progress` spans both on-site sub-phases in the canonical model.
    expect(metric("jobs_in_progress").legacyStatuses).toEqual(["in_progress"]);
    expect(metric("jobs_in_progress").canonicalStates).toEqual(["in_progress", "dispatched"]);

    expect(metric("jobs_completed").legacyStatuses).toEqual(["completed"]);
    expect(metric("jobs_completed").canonicalStates).toEqual(["work_complete"]);

    expect(metric("jobs_invoiced").canonicalStates).toEqual(["invoiced"]);
    expect(metric("jobs_paid").canonicalStates).toEqual(["paid"]);
    expect(metric("jobs_closed").canonicalStates).toEqual(["closed"]);
  });

  it("terminal (revenue-phase) metric mirrors the legacy TERMINAL set exactly", () => {
    expect(TERMINAL_JOB_STATUSES).toEqual(["completed", "invoice_sent", "paid", "closed"]);
    expect(TERMINAL_LIFECYCLE_STATES).toEqual(["work_complete", "invoiced", "paid", "closed"]);
    expect(metric("terminal_jobs").legacyStatuses).toEqual([...TERMINAL_JOB_STATUSES]);
    expect(metric("terminal_jobs").canonicalStates).toEqual([...TERMINAL_LIFECYCLE_STATES]);
  });

  it("exposes all six approved job-state metrics plus the terminal aggregate", () => {
    expect(REPORTING_METRICS.map(m => m.key)).toEqual([
      "jobs_scheduled",
      "jobs_in_progress",
      "jobs_completed",
      "jobs_invoiced",
      "jobs_paid",
      "jobs_closed",
      "terminal_jobs",
    ]);
  });
});

describe("reportingMetrics — legacy vs canonical comparison", () => {
  it("agrees perfectly when lifecycle matches office status (no drift)", () => {
    const rows = [
      row(1, "completed", "work_complete"),
      row(2, "in_progress", "in_progress"),
      row(3, "scheduled", "scheduled"),
    ];
    const c = computeMetricComparison(rows, metric("jobs_completed"));
    expect(c.legacyCount).toBe(1);
    expect(c.canonicalCount).toBe(1);
    expect(c.delta).toBe(0);
    expect(c.matchingJobIds).toEqual([1]);
    expect(c.legacyOnlyJobIds).toEqual([]);
    expect(c.canonicalOnlyJobIds).toEqual([]);
  });

  it("field-complete / office-behind: canonical counts the job, legacy misses it (positive delta)", () => {
    // Tech finished (lifecycle work_complete) but office still shows in_progress.
    const rows = [
      row(10, "in_progress", "work_complete"), // canonical-only for jobs_completed
      row(11, "completed", "work_complete"), // both
    ];
    const c = computeMetricComparison(rows, metric("jobs_completed"));
    expect(c.legacyCount).toBe(1); // only job 11 by office status
    expect(c.canonicalCount).toBe(2); // jobs 10 + 11 by lifecycle
    expect(c.delta).toBe(1);
    expect(c.canonicalOnlyJobIds).toEqual([10]);
    expect(c.legacyOnlyJobIds).toEqual([]);
    expect(c.matchingJobIds).toEqual([11]);
  });

  it("office-ahead / field-behind: legacy counts it, canonical does not (NEGATIVE delta is valid)", () => {
    // Office marked completed but lifecycle still in_progress (field not done).
    const rows = [row(20, "completed", "in_progress")];
    const c = computeMetricComparison(rows, metric("jobs_completed"));
    expect(c.legacyCount).toBe(1);
    expect(c.canonicalCount).toBe(0);
    expect(c.delta).toBe(-1); // either direction is a valid mismatch
    expect(c.legacyOnlyJobIds).toEqual([20]);
    expect(c.canonicalOnlyJobIds).toEqual([]);
  });

  it("invoiced phase: office invoice_sent ↔ lifecycle invoiced", () => {
    const rows = [
      row(30, "invoice_sent", "invoiced"),
      row(31, "completed", "work_complete"), // not invoiced
    ];
    const c = computeMetricComparison(rows, metric("jobs_invoiced"));
    expect(c.legacyCount).toBe(1);
    expect(c.canonicalCount).toBe(1);
    expect(c.matchingJobIds).toEqual([30]);
  });

  it("paid phase: office paid ↔ lifecycle paid", () => {
    const rows = [row(40, "paid", "paid"), row(41, "invoice_sent", "invoiced")];
    const c = computeMetricComparison(rows, metric("jobs_paid"));
    expect(c.legacyCount).toBe(1);
    expect(c.canonicalCount).toBe(1);
    expect(c.matchingJobIds).toEqual([40]);
  });

  it("closed state: office closed ↔ lifecycle closed", () => {
    const rows = [row(50, "closed", "closed"), row(51, "paid", "paid")];
    const c = computeMetricComparison(rows, metric("jobs_closed"));
    expect(c.legacyCount).toBe(1);
    expect(c.canonicalCount).toBe(1);
    expect(c.matchingJobIds).toEqual([50]);
  });

  it("in_progress maps to {in_progress, dispatched}: a dispatched job is canonical-in-progress", () => {
    const rows = [
      row(60, "in_progress", "in_progress"), // both
      row(61, "in_progress", "dispatched"), // canonical still in-progress (matches legacy office)
      row(62, "scheduled", "dispatched"), // canonical-only (legacy office=scheduled)
    ];
    const c = computeMetricComparison(rows, metric("jobs_in_progress"));
    expect(c.legacyCount).toBe(2); // 60, 61 by office status
    expect(c.canonicalCount).toBe(3); // 60, 61, 62 by lifecycle
    expect(c.delta).toBe(1);
    expect(c.canonicalOnlyJobIds).toEqual([62]);
  });

  it("terminal aggregate: canonical captures field-done-office-behind revenue-phase jobs", () => {
    const rows = [
      row(70, "completed", "work_complete"),
      row(71, "invoice_sent", "invoiced"),
      row(72, "in_progress", "paid"), // office behind, lifecycle already paid → canonical-only
    ];
    const c = computeMetricComparison(rows, metric("terminal_jobs"));
    expect(c.legacyCount).toBe(2); // 70, 71
    expect(c.canonicalCount).toBe(3); // 70, 71, 72
    expect(c.canonicalOnlyJobIds).toEqual([72]);
  });
});

describe("reportingMetrics — null lifecycle fallback", () => {
  it("null lifecycleState falls back to the legacy calculation (never silently excluded)", () => {
    const rows = [
      row(80, "completed", null), // null → fall back to legacy status=completed → counted
      row(81, "in_progress", null), // null, not completed → not counted
    ];
    const c = computeMetricComparison(rows, metric("jobs_completed"));
    expect(c.legacyCount).toBe(1);
    expect(c.canonicalCount).toBe(1); // fallback keeps job 80 in the canonical set
    expect(c.delta).toBe(0);
    expect(c.matchingJobIds).toEqual([80]);
    expect(c.nullLifecycleJobIds).toEqual([80]); // reported for visibility
  });

  it("reports every null-lifecycle job that participates in the metric", () => {
    const rows = [
      row(90, "completed", null),
      row(91, "completed", "work_complete"),
      row(92, "scheduled", null), // null but not in this metric → not reported here
    ];
    const c = computeMetricComparison(rows, metric("jobs_completed"));
    expect(c.nullLifecycleJobIds).toEqual([90]);
    expect(c.canonicalCount).toBe(2); // 90 (fallback) + 91
  });
});
