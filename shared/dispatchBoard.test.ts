import { describe, it, expect } from "vitest";
import {
  buildDispatchLanes, resolveDayRange, todayInTimeZone, shiftDay, isValidDay,
  type BoardVisit, type Technician,
} from "./dispatchBoard";

const tech = (id: number, name: string): Technician => ({ id, name, phone: null });
const visit = (o: Partial<BoardVisit> & { appointmentId: number }): BoardVisit => ({
  scheduledAt: "2026-07-20T14:00:00.000Z", durationMinutes: 60, customerName: "Acme",
  propertyAddress: "1 Main St", appointmentType: "service_call", priority: "normal",
  liveStatus: "assigned", jobId: null, jobNumber: null, assignedToId: null,
  assigneeName: null, phone: null, ...o,
});

describe("dispatchBoard — buildDispatchLanes", () => {
  const techs = [tech(3, "Bravo"), tech(1, "Alpha")];

  it("gives every active technician a lane (even empty), sorted by name", () => {
    const lanes = buildDispatchLanes([], techs);
    expect(lanes.map(l => l.technicianName)).toEqual(["Alpha", "Bravo"]);
    expect(lanes.every(l => l.count === 0 && l.visits.length === 0)).toBe(true);
  });

  it("groups visits under their assignee and counts them", () => {
    const lanes = buildDispatchLanes([
      visit({ appointmentId: 10, assignedToId: 1 }),
      visit({ appointmentId: 11, assignedToId: 1 }),
      visit({ appointmentId: 12, assignedToId: 3 }),
    ], techs);
    const alpha = lanes.find(l => l.technicianId === 1)!;
    expect(alpha.count).toBe(2);
    expect(alpha.visits.map(v => v.appointmentId)).toEqual([10, 11]);
    expect(lanes.find(l => l.technicianId === 3)!.count).toBe(1);
  });

  it("puts unassigned and inactive-tech visits in an Unassigned lane (appended, only when populated)", () => {
    const none = buildDispatchLanes([visit({ appointmentId: 10, assignedToId: 1 })], techs);
    expect(none.some(l => l.technicianId === null)).toBe(false); // no unassigned → no lane

    const lanes = buildDispatchLanes([
      visit({ appointmentId: 20, assignedToId: null }),   // unassigned
      visit({ appointmentId: 21, assignedToId: 999 }),    // assigned to a non-active tech
    ], techs);
    const last = lanes[lanes.length - 1];
    expect(last.technicianId).toBeNull();
    expect(last.technicianName).toBe("Unassigned");
    expect(last.visits.map(v => v.appointmentId)).toEqual([20, 21]);
  });

  it("sorts visits within a lane by scheduledAt then id — deterministic & repeatable", () => {
    const lanes = buildDispatchLanes([
      visit({ appointmentId: 2, assignedToId: 1, scheduledAt: "2026-07-20T16:00:00.000Z" }),
      visit({ appointmentId: 1, assignedToId: 1, scheduledAt: "2026-07-20T09:00:00.000Z" }),
    ], techs);
    expect(lanes.find(l => l.technicianId === 1)!.visits.map(v => v.appointmentId)).toEqual([1, 2]);
    // byte-identical on repeat
    const a = JSON.stringify(buildDispatchLanes([visit({ appointmentId: 5, assignedToId: 3 })], techs));
    const b = JSON.stringify(buildDispatchLanes([visit({ appointmentId: 5, assignedToId: 3 })], techs));
    expect(a).toBe(b);
  });
});

describe("dispatchBoard — timezone day range", () => {
  it("resolves a NY calendar day to the correct UTC window (EDT = UTC-4 in July)", () => {
    const { start, endExclusive } = resolveDayRange("2026-07-20", "America/New_York");
    expect(start.toISOString()).toBe("2026-07-20T04:00:00.000Z");        // midnight EDT
    expect(endExclusive.toISOString()).toBe("2026-07-21T04:00:00.000Z"); // next midnight
  });

  it("resolves a NY winter day (EST = UTC-5)", () => {
    const { start } = resolveDayRange("2026-01-15", "America/New_York");
    expect(start.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("resolves a UTC day exactly", () => {
    const { start, endExclusive } = resolveDayRange("2026-07-20", "UTC");
    expect(start.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-07-21T00:00:00.000Z");
  });

  it("todayInTimeZone reads the local calendar date across the UTC boundary", () => {
    // 03:00 UTC on Jul 20 is still Jul 19 in New York (23:00 EDT)
    expect(todayInTimeZone(new Date("2026-07-20T03:00:00.000Z"), "America/New_York")).toBe("2026-07-19");
    expect(todayInTimeZone(new Date("2026-07-20T12:00:00.000Z"), "America/New_York")).toBe("2026-07-20");
  });
});

describe("dispatchBoard — day navigation", () => {
  it("shiftDay moves across month/year boundaries", () => {
    expect(shiftDay("2026-07-20", 1)).toBe("2026-07-21");
    expect(shiftDay("2026-07-20", -1)).toBe("2026-07-19");
    expect(shiftDay("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("isValidDay validates the format and range", () => {
    expect(isValidDay("2026-07-20")).toBe(true);
    expect(isValidDay("2026-7-2")).toBe(false);
    expect(isValidDay("not-a-date")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
  });
});
