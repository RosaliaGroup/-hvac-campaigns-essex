import { describe, it, expect } from "vitest";
import {
  runDispatchReconciliation, DISPATCH_CHECKS,
  type DispatchDataset, type DsJob, type DsAppointment,
} from "./dispatchReconciliation";

// ── builders ────────────────────────────────────────────────────────────────
const job = (o: Partial<DsJob> & { id: number }): DsJob => ({
  jobNumber: "ME-2026-" + String(o.id).padStart(4, "0"), officeStatus: "scheduled",
  technicianWorkStatus: "assigned", assignedToId: null, customerId: 100, propertyId: 200,
  completedAt: null, ...o,
});
const appt = (o: Partial<DsAppointment> & { id: number }): DsAppointment => ({
  jobId: null, assignedToId: null, customerId: 100, propertyId: 200, status: "confirmed",
  scheduledAt: "2026-07-20T14:00:00Z", hasAddressText: true, ...o,
});
const ds = (p: Partial<DispatchDataset>): DispatchDataset => ({
  jobs: [], appointments: [], teamMembers: [{ id: 1, status: "active" }], completions: [], properties: [{ id: 200, hasAddress: true }], ...p,
});
const ids = (r: ReturnType<typeof runDispatchReconciliation>, checkId: string) =>
  r.findings.filter(f => f.checkId === checkId).map(f => f.recordId);

describe("dispatchReconciliation — clean dataset", () => {
  it("a fully consistent dataset produces zero findings and a clean verdict", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, technicianWorkStatus: "completed", officeStatus: "completed", assignedToId: 1, completedAt: "2026-07-18T22:41:11Z" })],
      appointments: [appt({ id: 15, jobId: 4, assignedToId: 1, status: "completed" })],
      teamMembers: [{ id: 1, status: "active" }],
      completions: [{ jobId: 4, completedAt: "2026-07-18T22:41:11Z" }],
    }));
    expect(r.summary.totalFindings).toBe(0);
    expect(r.summary.boardAccuracyVerdict).toBe("clean");
    expect(r.findings).toEqual([]);
    // every defined check still appears with count 0
    expect(r.checks).toHaveLength(DISPATCH_CHECKS.length);
    expect(r.checks.every(c => c.count === 0)).toBe(true);
    expect(r.summary.readOnly).toBe(true);
  });
});

describe("dispatchReconciliation — missing completion snapshots", () => {
  it("flags a completed work status with no snapshot (high) and an orphan snapshot (medium)", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [
        job({ id: 4, technicianWorkStatus: "completed", officeStatus: "completed" }),           // no completion row → missing
        job({ id: 5, technicianWorkStatus: "working", officeStatus: "in_progress" }),            // has a completion row → orphan
      ],
      completions: [{ jobId: 5, completedAt: "2026-07-18T10:00:00Z" }],
    }));
    expect(ids(r, "COMPLETION_MISSING_SNAPSHOT")).toEqual([4]);
    expect(ids(r, "COMPLETION_ORPHAN_SNAPSHOT")).toEqual([5]);
    expect(r.summary.boardAccuracyVerdict).toBe("inaccurate"); // the missing snapshot is high
  });

  it("flags a completedAt drift between job and snapshot (low)", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, technicianWorkStatus: "completed", officeStatus: "completed", completedAt: "2026-07-18T22:48:20Z" })],
      completions: [{ jobId: 4, completedAt: "2026-07-18T22:41:11Z" }],
    }));
    expect(ids(r, "COMPLETION_TIMESTAMP_DRIFT")).toEqual([4]);
    // aligned timestamps → no drift
    const clean = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, technicianWorkStatus: "completed", officeStatus: "completed", completedAt: "2026-07-18T22:41:11Z" })],
      completions: [{ jobId: 4, completedAt: "2026-07-18T22:41:11Z" }],
    }));
    expect(ids(clean, "COMPLETION_TIMESTAMP_DRIFT")).toEqual([]);
  });
});

describe("dispatchReconciliation — orphaned references", () => {
  it("flags an appointment pointing at a missing job (high)", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4 })],
      appointments: [appt({ id: 15, jobId: 999 })], // job 999 does not exist
    }));
    expect(ids(r, "LINK_APPT_DANGLING_JOB")).toEqual([15]);
    expect(r.findings.find(f => f.checkId === "LINK_APPT_DANGLING_JOB")?.relatedId).toBe(999);
  });

  it("flags customer/property mismatches between an appointment and its job", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, customerId: 100, propertyId: 200 })],
      appointments: [appt({ id: 15, jobId: 4, customerId: 101, propertyId: 201 })],
      properties: [{ id: 200, hasAddress: true }, { id: 201, hasAddress: true }],
    }));
    expect(ids(r, "LINK_APPT_CUSTOMER_MISMATCH")).toEqual([15]);
    expect(ids(r, "LINK_APPT_PROPERTY_MISMATCH")).toEqual([15]);
  });
});

describe("dispatchReconciliation — assignment integrity", () => {
  it("flags appointments/jobs assigned to inactive or missing technicians", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, assignedToId: 2 })],                          // tech 2 suspended
      appointments: [appt({ id: 15, jobId: 4, assignedToId: 3 })],       // tech 3 missing
      teamMembers: [{ id: 1, status: "active" }, { id: 2, status: "suspended" }],
    }));
    expect(ids(r, "ASSIGN_JOB_INACTIVE_TECH")).toEqual([4]);
    expect(ids(r, "ASSIGN_APPT_INACTIVE_TECH")).toEqual([15]);
  });

  it("flags an appointment/job assignee mismatch and an assigned-but-unscheduled appointment", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, assignedToId: 1 })],
      appointments: [appt({ id: 15, jobId: 4, assignedToId: 1, scheduledAt: null })], // unscheduled
      teamMembers: [{ id: 1, status: "active" }],
    }));
    expect(ids(r, "ASSIGN_APPT_UNSCHEDULED")).toEqual([15]);

    const mismatch = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, assignedToId: 1 })],
      appointments: [appt({ id: 15, jobId: 4, assignedToId: 2 })],
      teamMembers: [{ id: 1, status: "active" }, { id: 2, status: "active" }],
    }));
    expect(ids(mismatch, "ASSIGN_APPT_JOB_MISMATCH")).toEqual([15]);
  });
});

describe("dispatchReconciliation — status mismatches (reused lifecycle classifier)", () => {
  it("flags office-completed-but-field-behind and field-completed-but-office-behind", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [
        job({ id: 4, officeStatus: "completed", technicianWorkStatus: "working" }),  // office done, field behind
        job({ id: 5, officeStatus: "scheduled", technicianWorkStatus: "completed", completedAt: "2026-07-18T10:00:00Z" }), // field done, office behind
      ],
      completions: [{ jobId: 5, completedAt: "2026-07-18T10:00:00Z" }],
    }));
    expect(ids(r, "LC_OFFICE_DONE_FIELD_BEHIND")).toEqual([4]);
    expect(ids(r, "LC_FIELD_DONE_OFFICE_BEHIND")).toEqual([5]);
  });

  it("flags a cancelled job that still has an active visit", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, officeStatus: "cancelled", technicianWorkStatus: "assigned" })],
      appointments: [appt({ id: 15, jobId: 4, status: "confirmed" })],
    }));
    expect(ids(r, "LC_CANCELLED_WITH_ACTIVE_VISIT")).toEqual([4]);
  });
});

describe("dispatchReconciliation — map readiness (info)", () => {
  it("flags a scheduled visit only when NEITHER the appointment text NOR the property has an address", () => {
    const r = runDispatchReconciliation(ds({
      appointments: [
        appt({ id: 1, propertyId: 300, hasAddressText: false }),  // no text, property has no address → flagged
        appt({ id: 2, propertyId: 200, hasAddressText: false }),  // no text, property HAS address → ok
        appt({ id: 3, propertyId: 300, hasAddressText: true }),   // has text → ok even though property has none
        appt({ id: 4, propertyId: 300, hasAddressText: false, status: "completed" }), // not active → ok
      ],
      properties: [{ id: 200, hasAddress: true }, { id: 300, hasAddress: false }],
    }));
    expect(ids(r, "READY_NO_ADDRESS")).toEqual([1]);
    // readiness is informational only — verdict stays clean
    expect(r.summary.boardAccuracyVerdict).toBe("clean");
    expect(r.findings.find(f => f.checkId === "READY_NO_ADDRESS")?.entity).toBe("appointment");
  });
});

describe("dispatchReconciliation — every finding carries the required fields", () => {
  it("severity, entity, recordId, problem, remediation are all populated", () => {
    const r = runDispatchReconciliation(ds({
      jobs: [job({ id: 4, technicianWorkStatus: "completed", officeStatus: "completed" })],
    }));
    expect(r.findings.length).toBeGreaterThan(0);
    for (const f of r.findings) {
      expect(["high", "medium", "low", "info"]).toContain(f.severity);
      expect(["job", "appointment", "assignment", "completion", "property"]).toContain(f.entity);
      expect(typeof f.recordId).toBe("number");
      expect(f.problem.length).toBeGreaterThan(0);
      expect(f.remediation.length).toBeGreaterThan(0);
    }
  });
});

describe("dispatchReconciliation — deterministic & repeatable", () => {
  const dataset = ds({
    jobs: [
      job({ id: 7, technicianWorkStatus: "completed", officeStatus: "completed" }),
      job({ id: 4, assignedToId: 9 }),
    ],
    appointments: [appt({ id: 15, jobId: 999 }), appt({ id: 8, jobId: 4, assignedToId: 9, scheduledAt: null })],
    teamMembers: [{ id: 1, status: "active" }],
  });
  it("identical input yields byte-identical output, ordered by severity then id", () => {
    const a = JSON.stringify(runDispatchReconciliation(dataset, { generatedAt: "fixed" }));
    const b = JSON.stringify(runDispatchReconciliation(dataset, { generatedAt: "fixed" }));
    expect(a).toBe(b);
    const r = runDispatchReconciliation(dataset);
    // findings are non-decreasing in severity rank
    const rank = { high: 0, medium: 1, low: 2, info: 3 } as const;
    for (let i = 1; i < r.findings.length; i++)
      expect(rank[r.findings[i].severity]).toBeGreaterThanOrEqual(rank[r.findings[i - 1].severity]);
  });
});
