import { describe, expect, it } from "vitest";
import {
  addBusinessDays, cycleHour, easternHourStartEpochSec, hourlyCap, nextFollowUpDue,
  normalizeCompany, remainingAllowance, replySubject, reportSubject, sendingHour,
} from "./prospectCadence";

// 2026-10-28 is a Wednesday; EDT (UTC-4) until Nov 1.
const et = (iso: string) => new Date(iso);

describe("Eastern weekday schedule", () => {
  it("sends 9:00–16:59 ET on weekdays only", () => {
    expect(sendingHour(et("2026-10-28T13:00:00Z"))).toBe("2026-10-28T09"); // 9 AM ET
    expect(sendingHour(et("2026-10-28T20:59:00Z"))).toBe("2026-10-28T16"); // 4:59 PM ET
    expect(sendingHour(et("2026-10-28T12:59:00Z"))).toBeNull(); // 8:59 AM
  });
  it("5 PM is a report-only cycle hour, never a sending hour", () => {
    const fivePm = et("2026-10-28T21:05:00Z");
    expect(sendingHour(fivePm)).toBeNull();
    expect(cycleHour(fivePm)).toBe("2026-10-28T17");
    expect(cycleHour(et("2026-10-28T22:05:00Z"))).toBeNull(); // 6 PM
  });
  it("no weekend cycles at all", () => {
    expect(cycleHour(et("2026-10-31T15:00:00Z"))).toBeNull(); // Saturday 11 AM
    expect(cycleHour(et("2026-11-01T15:00:00Z"))).toBeNull(); // Sunday 10 AM EST
    expect(sendingHour(et("2026-11-02T15:00:00Z"))).toBe("2026-11-02T10"); // Monday 10 AM EST
  });
  it("hour start is correct across DST", () => {
    expect(easternHourStartEpochSec(et("2026-10-28T14:37:12.500Z"))).toBe(Date.parse("2026-10-28T14:00:00Z") / 1000);
    expect(easternHourStartEpochSec(et("2026-11-02T15:59:59Z"))).toBe(Date.parse("2026-11-02T15:00:00Z") / 1000);
  });
  it("report subject uses the exact required format", () => {
    expect(reportSubject(et("2026-10-28T15:01:00Z"))).toBe("Mechanical Enterprise Hourly Outreach Report — 2026-10-28 11:00 ET");
  });
});

describe("weekday day-4/10/18/26 cadence", () => {
  const intro = et("2026-10-28T14:00:00Z"); // Wed
  it("counts business days and skips weekends", () => {
    expect(addBusinessDays(intro, 4).toISOString()).toBe("2026-11-03T14:00:00.000Z"); // Tue
  });
  it("schedules each step from the introduction, oldest step only", () => {
    expect(nextFollowUpDue(intro, 1, intro)!.toISOString()).toBe(addBusinessDays(intro, 4).toISOString());
    expect(nextFollowUpDue(intro, 2, intro)!.toISOString()).toBe(addBusinessDays(intro, 10).toISOString());
    expect(nextFollowUpDue(intro, 4, intro)!.toISOString()).toBe(addBusinessDays(intro, 26).toISOString());
    expect(nextFollowUpDue(intro, 5, intro)).toBeNull();
    expect(nextFollowUpDue(intro, 0, intro)).toBeNull();
  });
  it("never bursts overdue steps: next step at least one business day after last send", () => {
    const lateSend = et("2026-12-15T15:00:00Z");
    expect(nextFollowUpDue(intro, 2, lateSend)!.getTime()).toBe(addBusinessDays(lateSend, 1).getTime());
  });
});

describe("shared hourly cap", () => {
  it("20/hour during catch-up, 10/hour once reconciled", () => {
    expect(hourlyCap(3)).toBe(20);
    expect(hourlyCap(0)).toBe(10);
  });
  it("fails closed on unknown counts and never goes negative", () => {
    expect(remainingAllowance(20, null)).toBe(0);
    expect(remainingAllowance(20, 25)).toBe(0);
    expect(remainingAllowance(20, 7)).toBe(13);
  });
});

it("company normalization groups legal-entity variants", () => {
  expect(normalizeCompany("Acme Property Group, LLC")).toBe(normalizeCompany("ACME Property"));
});
it("reply subject threads under the original", () => {
  expect(replySubject("HVAC service partnership — Mechanical Enterprise")).toBe("Re: HVAC service partnership — Mechanical Enterprise");
  expect(replySubject("RE: x")).toBe("RE: x");
});
