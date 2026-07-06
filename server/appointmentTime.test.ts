import { describe, expect, it } from "vitest";
import { parsePreferredDate, parsePreferredDateTime, parsePreferredTime } from "./services/appointmentTime";

// Fixed anchor: Wednesday, March 4, 2026, 10:00 local
const NOW = new Date(2026, 2, 4, 10, 0, 0);

describe("appointmentTime — parsePreferredDate", () => {
  it("parses ISO and US formats", () => {
    expect(parsePreferredDate("2026-03-15", NOW)?.getDate()).toBe(15);
    expect(parsePreferredDate("3/15/2026", NOW)?.getMonth()).toBe(2);
    expect(parsePreferredDate("March 15, 2026", NOW)?.getFullYear()).toBe(2026);
  });
  it("handles today/tomorrow relative to the anchor", () => {
    expect(parsePreferredDate("today", NOW)?.getDate()).toBe(4);
    expect(parsePreferredDate("tomorrow", NOW)?.getDate()).toBe(5);
  });
  it("resolves weekday names to the NEXT occurrence (never same day)", () => {
    // NOW is Wednesday → "friday" = Mar 6, "wednesday" = Mar 11 (next week)
    expect(parsePreferredDate("friday", NOW)?.getDate()).toBe(6);
    expect(parsePreferredDate("Wednesday", NOW)?.getDate()).toBe(11);
  });
  it("rolls year-less past dates into next year", () => {
    const d = parsePreferredDate("January 10", NOW); // already past in March
    expect(d?.getFullYear()).toBe(2027);
  });
  it("strips ordinal suffixes", () => {
    expect(parsePreferredDate("March 15th 2026", NOW)?.getDate()).toBe(15);
  });
  it("returns null on garbage", () => {
    expect(parsePreferredDate("whenever works", NOW)).toBeNull();
    expect(parsePreferredDate("", NOW)).toBeNull();
    expect(parsePreferredDate(null, NOW)).toBeNull();
  });
});

describe("appointmentTime — parsePreferredTime", () => {
  it("parses am/pm variants", () => {
    expect(parsePreferredTime("2pm")).toEqual({ hours: 14, minutes: 0 });
    expect(parsePreferredTime("2:30 PM")).toEqual({ hours: 14, minutes: 30 });
    expect(parsePreferredTime("12 pm")).toEqual({ hours: 12, minutes: 0 });
    expect(parsePreferredTime("12am")).toEqual({ hours: 0, minutes: 0 });
  });
  it("parses 24h and words", () => {
    expect(parsePreferredTime("14:00")).toEqual({ hours: 14, minutes: 0 });
    expect(parsePreferredTime("noon")).toEqual({ hours: 12, minutes: 0 });
    expect(parsePreferredTime("morning")).toEqual({ hours: 9, minutes: 0 });
    expect(parsePreferredTime("afternoon")).toEqual({ hours: 13, minutes: 0 });
  });
  it("takes the start of a range", () => {
    expect(parsePreferredTime("between 2 and 4 pm")).toEqual({ hours: 14, minutes: 0 });
    expect(parsePreferredTime("2-4pm")).toEqual({ hours: 14, minutes: 0 });
  });
  it("returns null on garbage", () => {
    expect(parsePreferredTime("whenever")).toBeNull();
    expect(parsePreferredTime("25:99")).toBeNull();
  });
});

describe("appointmentTime — parsePreferredDateTime", () => {
  it("combines date and time", () => {
    const dt = parsePreferredDateTime("3/15/2026", "2:30 pm", NOW);
    expect(dt?.getHours()).toBe(14);
    expect(dt?.getMinutes()).toBe(30);
    expect(dt?.getDate()).toBe(15);
  });
  it("defaults to 9:00 AM when only the time is unparseable", () => {
    const dt = parsePreferredDateTime("3/15/2026", "whenever", NOW);
    expect(dt?.getHours()).toBe(9);
  });
  it("returns null when the date is unparseable (goes to backlog)", () => {
    expect(parsePreferredDateTime("sometime soon", "2pm", NOW)).toBeNull();
  });
});
