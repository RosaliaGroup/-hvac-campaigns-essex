import { describe, it, expect } from "vitest";
import {
  deriveJobLifecycle,
  classifyJobConflicts,
  isAllowedTransition,
  LIFECYCLE_STATES,
  LIFECYCLE_LABELS_INTERNAL,
  LIFECYCLE_LABELS_CUSTOMER,
  LEGACY_MAPPING,
  type OfficeStatus,
  type TechnicianWorkStatus,
  type AppointmentStatus,
} from "./jobLifecycle";

const OFFICE: OfficeStatus[] = ["new", "scheduled", "in_progress", "waiting_parts", "estimate_sent", "approved", "completed", "invoice_sent", "paid", "closed", "cancelled"];
const FIELD: TechnicianWorkStatus[] = ["assigned", "accepted", "en_route", "arrived", "working", "waiting_parts", "completed"];
const APPT: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled", "rescheduled", "arrived"];

describe("deriveJobLifecycle — precedence & mapping", () => {
  it("NEW by default (no visit, office new, tech assigned)", () => {
    expect(deriveJobLifecycle({ officeStatus: "new", technicianWorkStatus: "assigned" }).state).toBe("new");
  });
  it("SCHEDULED when a visit exists", () => {
    expect(deriveJobLifecycle({ officeStatus: "new", technicianWorkStatus: "assigned", appointmentStatuses: ["confirmed"] }).state).toBe("scheduled");
    expect(deriveJobLifecycle({ officeStatus: "scheduled", technicianWorkStatus: "assigned" }).state).toBe("scheduled");
  });
  it("DISPATCHED for accepted/en_route/arrived", () => {
    for (const f of ["accepted", "en_route", "arrived"] as TechnicianWorkStatus[]) {
      expect(deriveJobLifecycle({ officeStatus: "in_progress", technicianWorkStatus: f, appointmentStatuses: ["arrived"] }).state).toBe("dispatched");
    }
  });
  it("IN_PROGRESS when tech is working", () => {
    expect(deriveJobLifecycle({ officeStatus: "in_progress", technicianWorkStatus: "working" }).state).toBe("in_progress");
  });
  it("ON_HOLD on waiting_parts (either axis)", () => {
    expect(deriveJobLifecycle({ officeStatus: "in_progress", technicianWorkStatus: "waiting_parts" }).state).toBe("on_hold");
    expect(deriveJobLifecycle({ officeStatus: "waiting_parts", technicianWorkStatus: "arrived" }).state).toBe("on_hold");
  });
  it("WORK_COMPLETE when either axis is completed", () => {
    expect(deriveJobLifecycle({ officeStatus: "in_progress", technicianWorkStatus: "completed" }).state).toBe("work_complete");
    expect(deriveJobLifecycle({ officeStatus: "completed", technicianWorkStatus: "arrived" }).state).toBe("work_complete");
  });
  it("billing precedence: invoiced/paid/closed/cancelled win over field status", () => {
    expect(deriveJobLifecycle({ officeStatus: "invoice_sent", technicianWorkStatus: "completed" }).state).toBe("invoiced");
    expect(deriveJobLifecycle({ officeStatus: "paid", technicianWorkStatus: "working" }).state).toBe("paid");
    expect(deriveJobLifecycle({ officeStatus: "closed", technicianWorkStatus: "assigned" }).state).toBe("closed");
    expect(deriveJobLifecycle({ officeStatus: "cancelled", technicianWorkStatus: "working" }).state).toBe("cancelled");
  });
  it("quote states (estimate_sent/approved) project to scheduled-with-visit else new", () => {
    expect(deriveJobLifecycle({ officeStatus: "estimate_sent", technicianWorkStatus: "assigned" }).state).toBe("new");
    expect(deriveJobLifecycle({ officeStatus: "approved", technicianWorkStatus: "assigned", appointmentStatuses: ["confirmed"] }).state).toBe("scheduled");
  });

  it("is TOTAL — every legacy combination yields a valid canonical state (backfill coverage)", () => {
    let count = 0;
    for (const o of OFFICE) for (const f of FIELD) for (const a of [[], ...APPT.map(x => [x])] as AppointmentStatus[][]) {
      const r = deriveJobLifecycle({ officeStatus: o, technicianWorkStatus: f, appointmentStatuses: a });
      expect(LIFECYCLE_STATES).toContain(r.state);
      expect(typeof r.reason).toBe("string");
      count++;
    }
    expect(count).toBe(OFFICE.length * FIELD.length * (APPT.length + 1)); // exhaustive, no gaps
  });
});

describe("classifyJobConflicts — report-only", () => {
  it("consistent job → no conflicts", () => {
    expect(classifyJobConflicts({ officeStatus: "completed", technicianWorkStatus: "completed" })).toEqual([]);
  });
  it("flags billed-before-field-complete", () => {
    expect(classifyJobConflicts({ officeStatus: "paid", technicianWorkStatus: "working" })).toContain("billed_before_field_complete");
  });
  it("flags field-done-office-behind", () => {
    expect(classifyJobConflicts({ officeStatus: "in_progress", technicianWorkStatus: "completed" })).toContain("field_done_office_behind");
  });
  it("flags office-done-field-behind", () => {
    expect(classifyJobConflicts({ officeStatus: "completed", technicianWorkStatus: "arrived" })).toContain("office_done_field_behind");
  });
  it("flags quote-state-on-job", () => {
    expect(classifyJobConflicts({ officeStatus: "estimate_sent", technicianWorkStatus: "assigned" })).toContain("quote_state_on_job");
  });
  it("flags scheduled-without-visit", () => {
    expect(classifyJobConflicts({ officeStatus: "scheduled", technicianWorkStatus: "assigned", appointmentStatuses: [] })).toContain("scheduled_without_visit");
  });
  it("flags cancelled-with-active-visit", () => {
    expect(classifyJobConflicts({ officeStatus: "cancelled", technicianWorkStatus: "assigned", appointmentStatuses: ["confirmed"] })).toContain("cancelled_with_active_visit");
  });
  it("flags persisted drift", () => {
    expect(classifyJobConflicts({ officeStatus: "new", technicianWorkStatus: "assigned", persistedState: "paid" })).toContain("persisted_drift");
    expect(classifyJobConflicts({ officeStatus: "new", technicianWorkStatus: "assigned", persistedState: "new" })).not.toContain("persisted_drift");
  });
});

describe("transitions & labels", () => {
  it("allows valid transitions, rejects skips", () => {
    expect(isAllowedTransition("new", "scheduled")).toBe(true);
    expect(isAllowedTransition("in_progress", "work_complete")).toBe(true);
    expect(isAllowedTransition("new", "paid")).toBe(false);
    expect(isAllowedTransition("cancelled", "new")).toBe(false);
    expect(isAllowedTransition("scheduled", "scheduled")).toBe(true); // idempotent re-assert
  });
  it("has an internal + customer label for every state", () => {
    for (const s of LIFECYCLE_STATES) {
      expect(LIFECYCLE_LABELS_INTERNAL[s]).toBeTruthy();
      expect(LIFECYCLE_LABELS_CUSTOMER[s]).toBeTruthy();
    }
  });
  it("mapping table covers all canonical states", () => {
    expect(new Set(LEGACY_MAPPING.map(m => m.canonical)).size).toBe(LIFECYCLE_STATES.length);
  });
});
