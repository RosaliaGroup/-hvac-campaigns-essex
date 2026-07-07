import { describe, expect, it } from "vitest";
import {
  buildDirectionsUrl,
  hasServiceAddress,
  isScheduledToday,
  filterTodaysAssignedAppointments,
  statusForFieldAction,
  resolveTeamMemberId,
  dayRangeInTimeZone,
  fieldTimestamp,
  formatNoteEntry,
  appendNote,
  buildFieldNotesUpdate,
  FIELD_TIME_ZONE,
  type FieldAppointmentLike,
} from "./fieldApp";

// A weekday afternoon in New Jersey (EDT, UTC-4). 2026-07-07 14:30 America/New_York.
const NOW = new Date("2026-07-07T18:30:00.000Z");

describe("fieldApp — buildDirectionsUrl (map URL generation)", () => {
  it("builds the api=1 directions URL with an encoded destination", () => {
    expect(buildDirectionsUrl("123 Main St, Newark, NJ 07102")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St%2C%20Newark%2C%20NJ%2007102",
    );
  });

  it("trims surrounding whitespace before encoding", () => {
    expect(buildDirectionsUrl("  456 Oak Ave  ")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=456%20Oak%20Ave",
    );
  });

  it("encodes ampersands and slashes so the URL stays valid", () => {
    const url = buildDirectionsUrl("Unit 4/B & Annex, Clark NJ");
    expect(url).toContain("destination=Unit%204%2FB%20%26%20Annex%2C%20Clark%20NJ");
    expect(url!.startsWith("https://www.google.com/maps/dir/?api=1&destination=")).toBe(true);
  });
});

describe("fieldApp — no-address fallback", () => {
  it("hasServiceAddress is false for null/undefined/blank", () => {
    expect(hasServiceAddress(null)).toBe(false);
    expect(hasServiceAddress(undefined)).toBe(false);
    expect(hasServiceAddress("")).toBe(false);
    expect(hasServiceAddress("   ")).toBe(false);
  });

  it("hasServiceAddress is true for a real address", () => {
    expect(hasServiceAddress("1 Center St")).toBe(true);
  });

  it("buildDirectionsUrl returns null when there is no address", () => {
    expect(buildDirectionsUrl(null)).toBeNull();
    expect(buildDirectionsUrl(undefined)).toBeNull();
    expect(buildDirectionsUrl("")).toBeNull();
    expect(buildDirectionsUrl("   ")).toBeNull();
  });
});

describe("fieldApp — today filtering (timezone-aware)", () => {
  it("computes a local-midnight-to-next-midnight range in the field timezone", () => {
    const { start, endExclusive } = dayRangeInTimeZone(NOW, FIELD_TIME_ZONE);
    // 2026-07-07 00:00 EDT === 04:00 UTC; next midnight === 2026-07-08 04:00 UTC.
    expect(start.toISOString()).toBe("2026-07-07T04:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-07-08T04:00:00.000Z");
  });

  it("counts an appointment later the same NJ day as today", () => {
    expect(isScheduledToday("2026-07-07T23:00:00.000Z", NOW)).toBe(true); // 7pm EDT
  });

  it("counts early-morning NJ time (after local midnight) as today", () => {
    expect(isScheduledToday("2026-07-07T05:00:00.000Z", NOW)).toBe(true); // 1am EDT
  });

  it("excludes late-evening UTC that is still yesterday in NJ", () => {
    // 2026-07-07T02:00Z === 2026-07-06 22:00 EDT → yesterday locally.
    expect(isScheduledToday("2026-07-07T02:00:00.000Z", NOW)).toBe(false);
  });

  it("excludes tomorrow and rows with no scheduledAt", () => {
    expect(isScheduledToday("2026-07-08T18:30:00.000Z", NOW)).toBe(false);
    expect(isScheduledToday(null, NOW)).toBe(false);
    expect(isScheduledToday(undefined, NOW)).toBe(false);
  });
});

describe("fieldApp — assigned-user filtering", () => {
  const appts: (FieldAppointmentLike & { id: number })[] = [
    { id: 1, assignedToId: 7, scheduledAt: "2026-07-07T15:00:00.000Z" }, // mine, today
    { id: 2, assignedToId: 9, scheduledAt: "2026-07-07T15:00:00.000Z" }, // today, not mine
    { id: 3, assignedToId: 7, scheduledAt: "2026-07-08T15:00:00.000Z" }, // mine, tomorrow
    { id: 4, assignedToId: 7, scheduledAt: null }, // mine, unscheduled backlog
    { id: 5, assignedToId: null, scheduledAt: "2026-07-07T15:00:00.000Z" }, // unassigned
  ];

  it("returns only rows assigned to the member AND scheduled today", () => {
    const result = filterTodaysAssignedAppointments(appts, 7, NOW);
    expect(result.map(a => a.id)).toEqual([1]);
  });

  it("returns empty when the member has nothing today", () => {
    expect(filterTodaysAssignedAppointments(appts, 42, NOW)).toEqual([]);
  });
});

describe("fieldApp — completed status action", () => {
  it("maps the complete action to the 'completed' status", () => {
    expect(statusForFieldAction("complete")).toBe("completed");
    expect(statusForFieldAction("completed")).toBe("completed");
  });

  it("maps the arrive action to the 'arrived' status", () => {
    expect(statusForFieldAction("arrive")).toBe("arrived");
    expect(statusForFieldAction("arrived")).toBe("arrived");
  });

  it("returns null for unknown actions", () => {
    expect(statusForFieldAction("cancel")).toBeNull();
    expect(statusForFieldAction("")).toBeNull();
  });
});

describe("fieldApp — resolveTeamMemberId", () => {
  it("parses the id from a team-session openId", () => {
    expect(resolveTeamMemberId({ openId: "team:12", id: -12 })).toBe(12);
  });

  it("falls back to the negated user id when openId is absent", () => {
    expect(resolveTeamMemberId({ id: -8 })).toBe(8);
  });

  it("returns null for OAuth (non-team) users and null input", () => {
    expect(resolveTeamMemberId({ openId: "oauth-abc", id: 5 })).toBeNull();
    expect(resolveTeamMemberId(null)).toBeNull();
    expect(resolveTeamMemberId(undefined)).toBeNull();
  });
});

describe("fieldApp — append-only notes", () => {
  // 2026-07-07 11:32 AM America/New_York === 15:32 UTC (EDT, UTC-4)
  const AT = new Date("2026-07-07T15:32:00.000Z");

  it("formats a deterministic timestamp in the field timezone", () => {
    expect(fieldTimestamp(AT)).toBe("2026-07-07 11:32 AM");
  });

  it("formats a note entry with timestamp and author", () => {
    expect(formatNoteEntry("Gate code 4417", AT, "Ana Haynes")).toBe(
      "[2026-07-07 11:32 AM — Ana Haynes] Gate code 4417",
    );
  });

  it("falls back to a generic author label when none is given", () => {
    expect(formatNoteEntry("done", AT, null)).toBe("[2026-07-07 11:32 AM — Field] done");
    expect(formatNoteEntry("done", AT, "   ")).toBe("[2026-07-07 11:32 AM — Field] done");
  });

  it("APPENDS to existing notes and preserves prior content verbatim", () => {
    const existing = "Prior note from office.";
    const result = appendNote(existing, "Arrived on site.", AT, "Ana Haynes");
    // old content untouched at the top
    expect(result.startsWith("Prior note from office.")).toBe(true);
    // new entry appended after a blank line
    expect(result).toBe(
      "Prior note from office.\n\n[2026-07-07 11:32 AM — Ana Haynes] Arrived on site.",
    );
    // it never replaced the original
    expect(result).not.toBe("Arrived on site.");
    expect(result.includes(existing)).toBe(true);
  });

  it("stacks multiple appends without losing any", () => {
    let notes = "";
    notes = appendNote(notes, "first", AT, "A");
    notes = appendNote(notes, "second", AT, "B");
    expect(notes).toBe(
      "[2026-07-07 11:32 AM — A] first\n\n[2026-07-07 11:32 AM — B] second",
    );
    expect(notes.match(/first/g)?.length).toBe(1);
    expect(notes.match(/second/g)?.length).toBe(1);
  });

  it("writes only the new entry when there were no existing notes", () => {
    expect(appendNote(null, "hello", AT, "A")).toBe("[2026-07-07 11:32 AM — A] hello");
    expect(appendNote("", "hello", AT, "A")).toBe("[2026-07-07 11:32 AM — A] hello");
  });

  it("leaves existing notes unchanged when the new text is blank", () => {
    expect(appendNote("keep me", "   ", AT, "A")).toBe("keep me");
    expect(appendNote("keep me", "", AT, "A")).toBe("keep me");
  });
});

describe("fieldApp — notes update has no calendar/SMS side effects", () => {
  it("builds an update payload with invites AND confirmation disabled", () => {
    const payload = buildFieldNotesUpdate(6, "some notes");
    expect(payload).toEqual({
      id: 6,
      notes: "some notes",
      sendInvites: false,
      sendConfirmation: false,
    });
    // guardrails: these must be false so Add Note never triggers Google Calendar sync or SMS
    expect(payload.sendInvites).toBe(false);
    expect(payload.sendConfirmation).toBe(false);
  });
});
