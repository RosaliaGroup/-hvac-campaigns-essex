import { describe, expect, it } from "vitest";
import { cadenceDueAt, cadenceExcluded, THIRTY_DAY_STEPS } from "./crm30DayRules";

describe("Mechanical Enterprise 30-day ten-touch cadence", () => {
  it("schedules exactly nine reminders after the day-0 introduction", () => {
    expect(THIRTY_DAY_STEPS).toHaveLength(9);
    expect(THIRTY_DAY_STEPS.map(s => s.touch)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(THIRTY_DAY_STEPS.filter(s => s.kind === "human")).toHaveLength(5);
    expect(THIRTY_DAY_STEPS.filter(s => s.kind === "email_review")).toHaveLength(4);
    expect(THIRTY_DAY_STEPS.map(s => s.day)).toEqual([2, 4, 7, 10, 14, 18, 22, 26, 30]);
  });
  it("rolls weekend tasks to weekdays in Eastern time", () => {
    const friday = new Date("2026-10-09T15:00:00Z");
    expect(cadenceDueAt(friday, 2).toISOString()).toBe("2026-10-12T13:00:00.000Z");
    expect(cadenceDueAt(friday, 3).toISOString()).toBe("2026-10-13T14:00:00.000Z");
    expect(cadenceDueAt(friday, 10).toISOString()).toBe("2026-11-09T14:00:00.000Z");
  });
  it("handles daylight saving time across November", () => {
    const friday = new Date("2026-10-30T16:00:00Z");
    expect(cadenceDueAt(friday, 2).toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(cadenceDueAt(friday, 3).toISOString()).toBe("2026-11-03T15:00:00.000Z");
  });
  it("keeps excluded companies and opt-outs suppressed", () => {
    expect(cadenceExcluded({ email: "thomas@vizapropertymanagement.com" })).toBe(true);
    expect(cadenceExcluded({ email: "jfuller@onyxequities.com" })).toBe(true);
    expect(cadenceExcluded({ email: "other@onyxequities.com" })).toBe(true);
    expect(cadenceExcluded({ email: "gabriel@example.com", name: "Gabriel Lopes" })).toBe(true);
    expect(cadenceExcluded({ email: "agent@example.com", company: "Giga Holdings" })).toBe(true);
    expect(cadenceExcluded({ email: "agent@example.com", notes: "Do not contact" })).toBe(true);
    expect(cadenceExcluded({ email: "manager@example.com" })).toBe(false);
  });
});
