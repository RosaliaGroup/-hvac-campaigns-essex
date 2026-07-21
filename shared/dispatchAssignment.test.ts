import { describe, it, expect } from "vitest";
import { decideAssignment, type AssignmentAppointment, type AssignmentTechnician } from "./dispatchAssignment";

const appt = (o: Partial<AssignmentAppointment> = {}): AssignmentAppointment =>
  ({ id: 1, status: "confirmed", assignedToId: null, ...o });
const active = (id: number): AssignmentTechnician => ({ id, status: "active" });

describe("decideAssignment — action classification", () => {
  it("none → tech = assign", () => {
    const d = decideAssignment(appt({ assignedToId: null }), 5, active(5), null);
    expect(d).toEqual({ ok: true, changed: true, action: "assign", fromAssigneeId: null, toAssigneeId: 5 });
  });
  it("tech → different tech = reassign", () => {
    const d = decideAssignment(appt({ assignedToId: 5 }), 7, active(7), 5);
    expect(d).toEqual({ ok: true, changed: true, action: "reassign", fromAssigneeId: 5, toAssigneeId: 7 });
  });
  it("tech → none = unassign", () => {
    const d = decideAssignment(appt({ assignedToId: 5 }), null, null, 5);
    expect(d).toEqual({ ok: true, changed: true, action: "unassign", fromAssigneeId: 5, toAssigneeId: null });
  });
});

describe("decideAssignment — no-op success (no audit)", () => {
  it("assigning to the current assignee is a no-op", () => {
    expect(decideAssignment(appt({ assignedToId: 5 }), 5, active(5), 5)).toEqual({ ok: true, changed: false, toAssigneeId: 5 });
  });
  it("unassigning an already-unassigned visit is a no-op", () => {
    expect(decideAssignment(appt({ assignedToId: null }), null, null, null)).toEqual({ ok: true, changed: false, toAssigneeId: null });
  });
});

describe("decideAssignment — validation rejections", () => {
  it("rejects a cancelled appointment (both directions)", () => {
    expect(decideAssignment(appt({ status: "cancelled", assignedToId: null }), 5, active(5), null))
      .toMatchObject({ ok: false, code: "APPOINTMENT_CANCELLED" });
    expect(decideAssignment(appt({ status: "cancelled", assignedToId: 5 }), null, null, 5))
      .toMatchObject({ ok: false, code: "APPOINTMENT_CANCELLED" });
  });
  it("rejects a missing technician", () => {
    expect(decideAssignment(appt(), 9, null, null)).toMatchObject({ ok: false, code: "TECH_NOT_FOUND" });
  });
  it("rejects a non-active technician (invited/suspended)", () => {
    expect(decideAssignment(appt(), 9, { id: 9, status: "suspended" }, null)).toMatchObject({ ok: false, code: "TECH_NOT_ACTIVE" });
    expect(decideAssignment(appt(), 9, { id: 9, status: "invited" }, null)).toMatchObject({ ok: false, code: "TECH_NOT_ACTIVE" });
  });
});

describe("decideAssignment — stale-client concurrency guard", () => {
  it("rejects when the expected assignee no longer matches current", () => {
    // client thought it was unassigned, but someone assigned tech 5 first
    expect(decideAssignment(appt({ assignedToId: 5 }), 7, active(7), null))
      .toMatchObject({ ok: false, code: "STALE_ASSIGNEE" });
    // client thought tech 5, but it's now tech 8
    expect(decideAssignment(appt({ assignedToId: 8 }), 7, active(7), 5))
      .toMatchObject({ ok: false, code: "STALE_ASSIGNEE" });
  });
  it("passes when expected matches current", () => {
    expect(decideAssignment(appt({ assignedToId: 5 }), 7, active(7), 5))
      .toMatchObject({ ok: true, changed: true, action: "reassign" });
  });
  it("skips the guard when expected is undefined (not sent)", () => {
    expect(decideAssignment(appt({ assignedToId: 8 }), 7, active(7), undefined))
      .toMatchObject({ ok: true, changed: true, action: "reassign", fromAssigneeId: 8, toAssigneeId: 7 });
  });
  it("checks the guard BEFORE technician validity (stale wins over tech errors)", () => {
    // stale token + bad tech → report the stale conflict first so the client refetches
    expect(decideAssignment(appt({ assignedToId: 8 }), 9, null, 5))
      .toMatchObject({ ok: false, code: "STALE_ASSIGNEE" });
  });
});
