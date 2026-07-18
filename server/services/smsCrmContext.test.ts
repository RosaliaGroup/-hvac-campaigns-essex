import { describe, it, expect } from "vitest";
import { pickSlot, orderAppointments, orderJobs } from "./smsCrmContext";

describe("pickSlot — never silently selects an ambiguous record", () => {
  it("no match → not linked, not ambiguous", () => {
    expect(pickSlot([])).toEqual({ matches: [], ambiguous: false, selectedId: null });
  });
  it("single match (lead/customer) → auto-selected, not ambiguous", () => {
    const r = pickSlot([{ id: 7 }]);
    expect(r.selectedId).toBe(7);
    expect(r.ambiguous).toBe(false);
  });
  it("multiple matches → ambiguous, no auto-selection (user must choose)", () => {
    const r = pickSlot([{ id: 1 }, { id: 2 }]);
    expect(r.selectedId).toBe(null);
    expect(r.ambiguous).toBe(true);
    expect(r.matches).toHaveLength(2);
  });
  it("multiple matches + explicit valid selection → honors it, still flags ambiguous", () => {
    const r = pickSlot([{ id: 1 }, { id: 2 }], 2);
    expect(r.selectedId).toBe(2);
    expect(r.ambiguous).toBe(true);
  });
  it("explicit selection not in the set → ignored, falls back to auto rules", () => {
    expect(pickSlot([{ id: 1 }, { id: 2 }], 999).selectedId).toBe(null); // still ambiguous
    expect(pickSlot([{ id: 5 }], 999).selectedId).toBe(5);
  });
});

describe("orderAppointments — prefer upcoming/active", () => {
  const now = new Date("2026-07-18T12:00:00Z").getTime();
  const A = (id: number, iso: string, status = "confirmed") => ({ id, scheduledAt: new Date(iso), status, appointmentType: null, assignedToId: null });
  it("upcoming confirmed comes before past", () => {
    const out = orderAppointments([A(1, "2026-07-01T12:00:00Z"), A(2, "2026-07-20T12:00:00Z")], now);
    expect(out[0].id).toBe(2);
  });
  it("soonest upcoming first", () => {
    const out = orderAppointments([A(1, "2026-07-25T12:00:00Z"), A(2, "2026-07-19T12:00:00Z")], now);
    expect(out[0].id).toBe(2);
  });
  it("cancelled future is not treated as upcoming", () => {
    const out = orderAppointments([A(1, "2026-07-20T12:00:00Z", "cancelled"), A(2, "2026-07-19T12:00:00Z", "confirmed")], now);
    expect(out[0].id).toBe(2);
  });
});

describe("orderJobs — active before closed", () => {
  const J = (id: number, status: string) => ({ id, jobNumber: `J${id}`, title: "t", status, priority: "normal", assignedToId: null });
  it("active jobs rank before completed/closed", () => {
    const out = orderJobs([J(1, "completed"), J(2, "in_progress"), J(3, "paid")]);
    expect(out[0].id).toBe(2);
  });
  it("among active, newest id first", () => {
    const out = orderJobs([J(4, "scheduled"), J(9, "new")]);
    expect(out[0].id).toBe(9);
  });
});
