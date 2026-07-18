/**
 * Database-driven calendar resolution + DST-safe timezone tests.
 *
 * These exercise the REAL resolver and the REAL Google event mapper (no mocks)
 * to prove that:
 *   • the target calendar is chosen from the database (`appointments.googleCalendarId`
 *     first, else the connection's `googleCalendarId`), so different records can
 *     resolve to different calendars;
 *   • a missing calendar resolves to null (safe — no unrelated fallback);
 *   • calendar times use the IANA `America/New_York` zone, not a hardcoded UTC
 *     offset, so daylight-saving is handled by the zone.
 */
import { describe, it, expect } from "vitest";
import { resolveCalendarId } from "./appointmentInvites";
import { mapToGoogleEvent, DEFAULT_TIMEZONE } from "../integrations/google/calendar";

describe("resolveCalendarId — database-driven", () => {
  const conn = { googleCalendarId: "conn-default@group.calendar.google.com" };

  it("prefers the appointment's own googleCalendarId (records can differ)", () => {
    expect(resolveCalendarId({ googleCalendarId: "record-A@cal" }, conn)).toBe("record-A@cal");
    expect(resolveCalendarId({ googleCalendarId: "record-B@cal" }, conn)).toBe("record-B@cal");
  });

  it("falls back to the connection's googleCalendarId when the record has none", () => {
    expect(resolveCalendarId({}, conn)).toBe("conn-default@group.calendar.google.com");
    expect(resolveCalendarId({ googleCalendarId: null }, conn)).toBe("conn-default@group.calendar.google.com");
  });

  it("returns null when no calendar exists anywhere (fails safe, no unrelated fallback)", () => {
    expect(resolveCalendarId({}, null)).toBeNull();
    expect(resolveCalendarId({ googleCalendarId: null }, { googleCalendarId: null })).toBeNull();
    expect(resolveCalendarId({}, undefined)).toBeNull();
  });
});

describe("timezone handling — daylight-saving-safe", () => {
  const base = {
    summary: "Technician Dispatch",
    description: "x",
    location: "12 Bloomfield Ave",
    durationMinutes: 60,
    attendees: [],
  };

  it("uses the IANA America/New_York zone (not a fixed offset)", () => {
    expect(DEFAULT_TIMEZONE).toBe("America/New_York");
    expect(DEFAULT_TIMEZONE).not.toMatch(/[+-]\d{2}:?\d{2}/); // not "-04:00"/"-0400"
  });

  it("tags summer (EDT) and winter (EST) events with the same IANA zone, no hardcoded offset", () => {
    const summer = mapToGoogleEvent({ ...base, scheduledAt: new Date("2026-07-15T18:00:00Z"), timeZone: DEFAULT_TIMEZONE });
    const winter = mapToGoogleEvent({ ...base, scheduledAt: new Date("2026-01-15T18:00:00Z"), timeZone: DEFAULT_TIMEZONE });

    for (const ev of [summer, winter]) {
      const start = ev.start as { timeZone: string };
      const end = ev.end as { timeZone: string };
      expect(start.timeZone).toBe("America/New_York");
      expect(end.timeZone).toBe("America/New_York");
      // The event carries a named zone + UTC instants — never a baked-in offset.
      expect(JSON.stringify(ev)).not.toMatch(/-0[45]:00/);
    }
  });
});
