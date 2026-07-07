import { describe, it, expect } from "vitest";
import {
  dayKey,
  appointmentMatchesFilters,
  bucketAppointmentsByDay,
  type CalendarAppointment,
  type CalendarFilterState,
} from "./appointmentCalendar";

const NO_FILTERS: CalendarFilterState = { assignee: "all", statuses: [], type: "all" };

/** The reported bug's appointment: confirmed, scheduled, from the customer 360. */
function confirmedAppt(over: Partial<CalendarAppointment> = {}): CalendarAppointment {
  return {
    scheduledAt: "2026-07-08T19:53:00.000Z", // 3:53 PM America/New_York
    status: "confirmed",
    assignedToId: null,
    appointmentType: "technician_dispatch",
    ...over,
  };
}

describe("bucketAppointmentsByDay", () => {
  it("surfaces a confirmed, scheduled appointment on its local day under default filters", () => {
    // Regression: the appointment existed + was returned by the API, but the
    // calendar must actually place it on a day cell. Under default (no) filters
    // it must NOT be dropped and must land on the correct local day.
    const byDay = bucketAppointmentsByDay([confirmedAppt()], NO_FILTERS);
    const key = dayKey(new Date("2026-07-08T19:53:00.000Z"));
    const bucket = byDay.get(key);
    expect(bucket).toBeDefined();
    expect(bucket!.total).toBe(1);
    expect(bucket!.statuses.confirmed).toBe(1);
  });

  it("does not drop 'confirmed' when other statuses are explicitly filtered in", () => {
    // Guards the "status filter excluding confirmed" concern: an empty filter
    // means ALL statuses, and confirmed is a first-class status.
    const included = bucketAppointmentsByDay([confirmedAppt()], { ...NO_FILTERS, statuses: ["confirmed"] });
    expect([...included.values()][0]?.total).toBe(1);

    const excluded = bucketAppointmentsByDay([confirmedAppt()], { ...NO_FILTERS, statuses: ["pending"] });
    expect(excluded.size).toBe(0);
  });

  it("skips rows without a scheduledAt (those belong to the backlog, not the grid)", () => {
    const byDay = bucketAppointmentsByDay(
      [confirmedAppt(), confirmedAppt({ scheduledAt: null })],
      NO_FILTERS,
    );
    expect([...byDay.values()].reduce((n, b) => n + b.total, 0)).toBe(1);
  });

  it("groups multiple appointments on the same day and sorts them earliest-first", () => {
    const late = confirmedAppt({ scheduledAt: "2026-07-08T21:00:00.000Z" });
    const early = confirmedAppt({ scheduledAt: "2026-07-08T14:00:00.000Z" });
    const byDay = bucketAppointmentsByDay([late, early], NO_FILTERS);
    const bucket = [...byDay.values()][0];
    expect(bucket.total).toBe(2);
    expect(bucket.appts[0]).toBe(early);
    expect(bucket.appts[1]).toBe(late);
  });
});

describe("appointmentMatchesFilters", () => {
  it("passes everything under default filters", () => {
    expect(appointmentMatchesFilters(confirmedAppt(), NO_FILTERS)).toBe(true);
  });

  it("honors the assignee filter (unassigned vs a specific member)", () => {
    const unassigned = confirmedAppt({ assignedToId: null });
    const assigned = confirmedAppt({ assignedToId: 5 });
    expect(appointmentMatchesFilters(unassigned, { ...NO_FILTERS, assignee: "unassigned" })).toBe(true);
    expect(appointmentMatchesFilters(assigned, { ...NO_FILTERS, assignee: "unassigned" })).toBe(false);
    expect(appointmentMatchesFilters(assigned, { ...NO_FILTERS, assignee: "5" })).toBe(true);
    expect(appointmentMatchesFilters(assigned, { ...NO_FILTERS, assignee: "9" })).toBe(false);
  });

  it("honors the type filter", () => {
    expect(appointmentMatchesFilters(confirmedAppt(), { ...NO_FILTERS, type: "technician_dispatch" })).toBe(true);
    expect(appointmentMatchesFilters(confirmedAppt(), { ...NO_FILTERS, type: "maintenance_plan" })).toBe(false);
  });
});
