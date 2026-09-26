import { describe, it, expect } from "vitest";
import { msUntilNextRun, isAllowedWeekday } from "./cronTiming";

const NY = "America/New_York";

describe("msUntilNextRun", () => {
  it("schedules later today when the target time hasn't passed yet (EST, no DST)", () => {
    // 2026-01-15 is a Thursday. 06:00 UTC = 01:00 America/New_York (EST, UTC-5).
    const now = new Date("2026-01-15T05:00:00Z"); // 00:00 ET
    const ms = msUntilNextRun({ hour: 1, minute: 0, timeZone: NY }, now);
    const result = new Date(now.getTime() + ms);
    expect(result.toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });

  it("rolls to tomorrow when today's target time already passed", () => {
    const now = new Date("2026-01-15T12:00:00Z"); // 07:00 ET, well past 01:00 ET
    const ms = msUntilNextRun({ hour: 1, minute: 0, timeZone: NY }, now);
    const result = new Date(now.getTime() + ms);
    expect(result.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("never returns zero or negative when `now` is exactly the target minute", () => {
    const now = new Date("2026-01-15T06:00:00Z"); // exactly 01:00 ET
    const ms = msUntilNextRun({ hour: 1, minute: 0, timeZone: NY }, now);
    expect(ms).toBeGreaterThan(0);
    const result = new Date(now.getTime() + ms);
    expect(result.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("respects a weekday allowlist — skips Sunday for a Mon-Sat job", () => {
    // 2026-01-17 is a Saturday; next allowed (Mon-Sat) run after Sat 02:00 ET is Monday.
    const now = new Date("2026-01-17T08:00:00Z"); // 03:00 ET Saturday, past 02:00
    const ms = msUntilNextRun({ hour: 2, minute: 0, timeZone: NY, weekdays: [1, 2, 3, 4, 5, 6] }, now);
    const result = new Date(now.getTime() + ms);
    // Next Monday 02:00 ET = 07:00 UTC.
    expect(result.toISOString()).toBe("2026-01-19T07:00:00.000Z");
    expect(isAllowedWeekday(result, NY, [1, 2, 3, 4, 5, 6])).toBe(true);
  });

  it("finds a single specific weekday (Wednesday 06:00 ET for the weekly content job)", () => {
    const now = new Date("2026-01-15T05:00:00Z"); // Thursday 00:00 ET
    const ms = msUntilNextRun({ hour: 6, minute: 0, timeZone: NY, weekdays: [3] }, now);
    const result = new Date(now.getTime() + ms);
    // Next Wednesday after Thu 2026-01-15 is 2026-01-21.
    expect(result.toISOString()).toBe("2026-01-21T11:00:00.000Z");
  });

  it("handles the spring-forward DST transition correctly", () => {
    // 2026-03-08 is the US DST start (2am -> 3am). A 1:30am ET job the night
    // before should still resolve to a real, later instant.
    const now = new Date("2026-03-08T05:00:00Z"); // midnight ET (still EST, UTC-5)
    const ms = msUntilNextRun({ hour: 1, minute: 30, timeZone: NY }, now);
    const result = new Date(now.getTime() + ms);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
    expect(result.toISOString()).toBe("2026-03-08T06:30:00.000Z"); // 1:30am EST, before the 2am jump
  });
});

describe("isAllowedWeekday", () => {
  it("reads the weekday in the target timezone, not UTC", () => {
    // 2026-01-15T02:00Z is still Jan 14, 21:00 ET (Wednesday).
    const date = new Date("2026-01-15T02:00:00Z");
    expect(isAllowedWeekday(date, NY, [3])).toBe(true); // Wednesday
    expect(isAllowedWeekday(date, NY, [4])).toBe(false); // not Thursday locally
  });
});
