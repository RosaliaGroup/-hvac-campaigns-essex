import { describe, it, expect } from "vitest";
import {
  JOB_STATUSES, JOB_STATUS_LABELS, jobStatusLabel, resolveJobSort,
  computeLaborMinutes, partLineTotal, partMargin, summarizeParts,
  propertyBelongsToCustomer, normalizeArchivedFilter, statusTransitionStamps,
  canAccessWorkOrder,
} from "./jobsLogic";

describe("jobsLogic — status labels preserve stored values", () => {
  it("keeps the exact 11 stored status values unchanged", () => {
    expect([...JOB_STATUSES]).toEqual([
      "new", "scheduled", "in_progress", "waiting_parts", "estimate_sent",
      "approved", "completed", "invoice_sent", "paid", "closed", "cancelled",
    ]);
  });
  it("maps stored values to the requested human labels (UI only)", () => {
    expect(jobStatusLabel("new")).toBe("Unscheduled");
    expect(jobStatusLabel("scheduled")).toBe("Scheduled");
    expect(jobStatusLabel("in_progress")).toBe("On Site / In Progress");
    expect(jobStatusLabel("waiting_parts")).toBe("Waiting for Parts");
    expect(jobStatusLabel("estimate_sent")).toBe("Waiting for Approval");
    expect(jobStatusLabel("approved")).toBe("Approved");
  });
  it("has a label for every stored status", () => {
    for (const s of JOB_STATUSES) expect(JOB_STATUS_LABELS[s]).toBeTruthy();
  });
  it("falls back to the raw value for an unknown status", () => {
    expect(jobStatusLabel("frobnicated")).toBe("frobnicated");
  });
});

describe("jobsLogic — resolveJobSort (allow-list + defaults)", () => {
  it("defaults to createdAt desc", () => {
    expect(resolveJobSort(undefined, undefined)).toEqual({ field: "createdAt", desc: true });
  });
  it("honors a valid field + direction", () => {
    expect(resolveJobSort("scheduledStartAt", "asc")).toEqual({ field: "scheduledStartAt", desc: false });
  });
  it("rejects an unknown field (falls back to createdAt) — no SQL injection surface", () => {
    expect(resolveJobSort("id; DROP TABLE jobs", "asc")).toEqual({ field: "createdAt", desc: false });
  });
});

describe("jobsLogic — computeLaborMinutes", () => {
  it("prefers explicit durationMinutes", () => {
    expect(computeLaborMinutes({ durationMinutes: 90, startTime: "2026-07-11T09:00:00Z", endTime: "2026-07-11T11:00:00Z" })).toBe(90);
  });
  it("derives from start/end when no explicit duration", () => {
    expect(computeLaborMinutes({ startTime: "2026-07-11T09:00:00Z", endTime: "2026-07-11T10:30:00Z" })).toBe(90);
  });
  it("never returns negative (end before start)", () => {
    expect(computeLaborMinutes({ startTime: "2026-07-11T11:00:00Z", endTime: "2026-07-11T09:00:00Z" })).toBe(0);
  });
  it("returns null when neither duration nor a full interval is available", () => {
    expect(computeLaborMinutes({ startTime: "2026-07-11T09:00:00Z" })).toBeNull();
    expect(computeLaborMinutes({})).toBeNull();
  });
});

describe("jobsLogic — parts math", () => {
  it("computes a customer line total", () => {
    expect(partLineTotal(3, 19.99)).toBe(59.97);
  });
  it("computes margin (can be negative)", () => {
    expect(partMargin(2, 50, 40)).toBe(-20);
    expect(partMargin(2, 30, 50)).toBe(40);
  });
  it("summarizes parts, excluding non-billable from the billable total", () => {
    const s = summarizeParts([
      { quantity: 2, unitCost: 30, unitPrice: 50, billable: true },   // total 100, cost 60
      { quantity: 1, unitCost: 10, unitPrice: 25, billable: false },  // total 25 (not billable), cost 10
    ]);
    expect(s.total).toBe(125);
    expect(s.billableTotal).toBe(100);
    expect(s.cost).toBe(70);
    expect(s.margin).toBe(30); // billableTotal 100 − cost 70
  });
  it("handles decimal-string inputs from MySQL", () => {
    const s = summarizeParts([{ quantity: "1.00", unitCost: "0.00", unitPrice: "199.99", billable: true }]);
    expect(s.total).toBe(199.99);
  });
});

describe("jobsLogic — statusTransitionStamps", () => {
  const now = new Date("2026-07-11T15:00:00Z");
  it("stamps arrival when moving to in_progress", () => {
    expect(statusTransitionStamps("in_progress", { actualArrivalAt: null }, now)).toEqual({ actualArrivalAt: now });
  });
  it("stamps completedAt + actualCompletionAt when completing", () => {
    expect(statusTransitionStamps("completed", {}, now)).toEqual({ completedAt: now, actualCompletionAt: now });
  });
  it("never overwrites an existing arrival/completion timestamp", () => {
    const prior = new Date("2026-07-01T09:00:00Z");
    expect(statusTransitionStamps("in_progress", { actualArrivalAt: prior }, now)).toEqual({});
    expect(statusTransitionStamps("completed", { completedAt: prior, actualCompletionAt: prior }, now)).toEqual({});
  });
  it("stamps nothing for non-milestone statuses", () => {
    expect(statusTransitionStamps("waiting_parts", {}, now)).toEqual({});
    expect(statusTransitionStamps("scheduled", {}, now)).toEqual({});
  });
});

describe("jobsLogic — relationship validation & filters", () => {
  it("accepts a property that belongs to the job's customer", () => {
    expect(propertyBelongsToCustomer(23, 23)).toBe(true);
  });
  it("rejects a property from a different customer or a missing property", () => {
    expect(propertyBelongsToCustomer(9, 23)).toBe(false);
    expect(propertyBelongsToCustomer(null, 23)).toBe(false);
    expect(propertyBelongsToCustomer(undefined, 23)).toBe(false);
  });
  it("normalizes the archived filter (default active)", () => {
    expect(normalizeArchivedFilter(undefined)).toBe("active");
    expect(normalizeArchivedFilter("nonsense")).toBe("active");
    expect(normalizeArchivedFilter("archived")).toBe("archived");
    expect(normalizeArchivedFilter("all")).toBe("all");
  });
});

describe("jobsLogic — canAccessWorkOrder (field work-order permissions)", () => {
  const base = { isAdmin: false, memberId: 5, assignedToId: 5, viaAppointment: false, viaTechnician: false };

  it("ADMIN may access any work order (even unassigned / no member profile)", () => {
    expect(canAccessWorkOrder({ ...base, isAdmin: true, memberId: null, assignedToId: 999 })).toBe(true);
    expect(canAccessWorkOrder({ ...base, isAdmin: true, assignedToId: 123 })).toBe(true);
  });

  it("TECHNICIAN may access a work order assigned directly to them", () => {
    expect(canAccessWorkOrder({ ...base, assignedToId: 5 })).toBe(true);
  });

  it("TECHNICIAN may access via a linked appointment they own", () => {
    expect(canAccessWorkOrder({ ...base, assignedToId: 99, viaAppointment: true })).toBe(true);
  });

  it("TECHNICIAN may access as an additional technician on the job", () => {
    expect(canAccessWorkOrder({ ...base, assignedToId: 99, viaTechnician: true })).toBe(true);
  });

  it("TECHNICIAN is DENIED a work order not theirs by any path (unauthorized URL access)", () => {
    expect(canAccessWorkOrder({ ...base, assignedToId: 99 })).toBe(false);
  });

  it("a login with no team profile (OAuth, memberId null) and not admin is DENIED", () => {
    expect(canAccessWorkOrder({ ...base, memberId: null, assignedToId: null })).toBe(false);
  });

  it("does not treat a null assignee as matching a null memberId", () => {
    // memberId null already denied; but guard the assignedToId===memberId comparison too.
    expect(canAccessWorkOrder({ ...base, memberId: null, assignedToId: null, viaAppointment: true })).toBe(false);
  });
});
