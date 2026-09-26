import { describe, it, expect } from "vitest";
import { isWithinCallingHours, nextCallingWindowStart } from "./callingHours";

// Fixed reference instants (UTC) with their known America/New_York wall-clock time
// as of the dates chosen (EST, UTC-5 — no DST in play for these fixtures).
describe("isWithinCallingHours", () => {
  it("true at 10:00 AM ET on a Wednesday", () => {
    // 2026-01-14 is a Wednesday. 10:00 ET (EST, UTC-5) = 15:00 UTC.
    expect(isWithinCallingHours(new Date("2026-01-14T15:00:00Z"))).toBe(true);
  });

  it("false at 8:00 AM ET (before the window)", () => {
    expect(isWithinCallingHours(new Date("2026-01-14T13:00:00Z"))).toBe(false);
  });

  it("false at 7:00 PM ET exactly (window end is exclusive)", () => {
    // 2026-01-14 19:00 ET (EST, UTC-5) = 2026-01-15 00:00 UTC.
    expect(isWithinCallingHours(new Date("2026-01-15T00:00:00Z"))).toBe(false);
  });

  it("false all day Sunday", () => {
    // 2026-01-18 is a Sunday. Noon ET = 17:00 UTC.
    expect(isWithinCallingHours(new Date("2026-01-18T17:00:00Z"))).toBe(false);
  });

  it("true at 10:00 AM ET on a Saturday", () => {
    // 2026-01-17 is a Saturday.
    expect(isWithinCallingHours(new Date("2026-01-17T15:00:00Z"))).toBe(true);
  });
});

describe("nextCallingWindowStart", () => {
  it("returns the same instant when already inside the window", () => {
    const now = new Date("2026-01-14T15:00:00Z");
    expect(nextCallingWindowStart(now).getTime()).toBe(now.getTime());
  });

  it("holds to 9:00 AM ET the same day when called before the window opens", () => {
    const now = new Date("2026-01-14T13:00:00Z"); // 8:00 AM ET
    const next = nextCallingWindowStart(now);
    expect(isWithinCallingHours(next)).toBe(true);
    // Same calendar day, at/after 9:00 AM ET.
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getTime() - now.getTime()).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it("holds to Monday 9:00 AM ET when called on Sunday", () => {
    const now = new Date("2026-01-18T17:00:00Z"); // Sunday noon ET
    const next = nextCallingWindowStart(now);
    expect(isWithinCallingHours(next)).toBe(true);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getTime() - now.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("holds to the next day when called after the window closes", () => {
    const now = new Date("2026-01-15T01:00:00Z"); // ~8 PM ET Wednesday
    const next = nextCallingWindowStart(now);
    expect(isWithinCallingHours(next)).toBe(true);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});
