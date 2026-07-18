import { describe, expect, it } from "vitest";
import {
  buildDirectionsUrl,
  hasServiceAddress,
  isScheduledToday,
  filterTodaysAssignedAppointments,
  statusForFieldAction,
  resolveTeamMemberId,
  dayRangeInTimeZone,
  categorizeFieldJobs,
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

// ── categorizeFieldJobs (My Jobs dashboard sectioning) ───────────────────────
// NOW = 2026-07-07 14:30 America/New_York (EDT, UTC-4). Today's local day is the
// UTC window [2026-07-07T04:00:00Z, 2026-07-08T04:00:00Z).
type JobFixture = FieldAppointmentLike & { id: number };
function job(id: number, scheduledAt: string | null, status: string): JobFixture {
  return { id, scheduledAt, status, assignedToId: 1 };
}

describe("fieldApp — categorizeFieldJobs", () => {
  it("buckets active visits by scheduled day (overdue / today / upcoming)", () => {
    const appts = [
      job(1, "2026-07-06T15:00:00Z", "confirmed"), // yesterday → overdue
      job(2, "2026-07-07T15:00:00Z", "confirmed"), // today 11am → today
      job(3, "2026-07-08T15:00:00Z", "pending"), // tomorrow → upcoming
    ];
    const { overdue, today, upcoming, completedToday } = categorizeFieldJobs(appts, NOW);
    expect(overdue.map(a => a.id)).toEqual([1]);
    expect(today.map(a => a.id)).toEqual([2]);
    expect(upcoming.map(a => a.id)).toEqual([3]);
    expect(completedToday).toHaveLength(0);
  });

  it("puts a completed-today visit in completedToday, not today", () => {
    const appts = [job(1, "2026-07-07T16:00:00Z", "completed")];
    const { today, completedToday } = categorizeFieldJobs(appts, NOW);
    expect(today).toHaveLength(0);
    expect(completedToday.map(a => a.id)).toEqual([1]);
  });

  it("omits visits completed on a previous day (history, not overdue)", () => {
    const appts = [job(1, "2026-07-06T16:00:00Z", "completed")];
    const sections = categorizeFieldJobs(appts, NOW);
    expect(sections.overdue).toHaveLength(0);
    expect(sections.completedToday).toHaveLength(0);
    expect(sections.today).toHaveLength(0);
    expect(sections.upcoming).toHaveLength(0);
  });

  it("excludes cancelled visits from every section", () => {
    const appts = [
      job(1, "2026-07-07T15:00:00Z", "cancelled"), // today but cancelled
      job(2, "2026-07-06T15:00:00Z", "cancelled"), // overdue but cancelled
    ];
    const s = categorizeFieldJobs(appts, NOW);
    expect(s.overdue.length + s.today.length + s.upcoming.length + s.completedToday.length).toBe(0);
  });

  it("excludes unscheduled (null scheduledAt) rows", () => {
    const appts = [job(1, null, "pending"), job(2, null, "completed")];
    const s = categorizeFieldJobs(appts, NOW);
    expect(s.overdue.length + s.today.length + s.upcoming.length + s.completedToday.length).toBe(0);
  });

  it("treats arrived and rescheduled as active", () => {
    const appts = [
      job(1, "2026-07-07T15:00:00Z", "arrived"), // today
      job(2, "2026-07-05T15:00:00Z", "rescheduled"), // overdue
    ];
    const s = categorizeFieldJobs(appts, NOW);
    expect(s.today.map(a => a.id)).toEqual([1]);
    expect(s.overdue.map(a => a.id)).toEqual([2]);
  });

  it("is inclusive at local midnight start and exclusive at local midnight end", () => {
    const appts = [
      job(1, "2026-07-07T04:00:00Z", "confirmed"), // exactly today 00:00 EDT → today
      job(2, "2026-07-08T04:00:00Z", "confirmed"), // exactly next 00:00 EDT → upcoming
      job(3, "2026-07-07T03:59:59Z", "confirmed"), // one sec before today → overdue
    ];
    const s = categorizeFieldJobs(appts, NOW);
    expect(s.today.map(a => a.id)).toEqual([1]);
    expect(s.upcoming.map(a => a.id)).toEqual([2]);
    expect(s.overdue.map(a => a.id)).toEqual([3]);
  });

  it("sorts overdue most-recent-first and the other sections chronologically", () => {
    const appts = [
      job(1, "2026-07-01T15:00:00Z", "confirmed"), // older overdue
      job(2, "2026-07-06T15:00:00Z", "confirmed"), // newer overdue
      job(3, "2026-07-07T18:00:00Z", "confirmed"), // today later
      job(4, "2026-07-07T13:00:00Z", "confirmed"), // today earlier
      job(5, "2026-07-10T15:00:00Z", "pending"), // upcoming later
      job(6, "2026-07-08T15:00:00Z", "pending"), // upcoming earlier
    ];
    const s = categorizeFieldJobs(appts, NOW);
    expect(s.overdue.map(a => a.id)).toEqual([2, 1]); // most recent overdue first
    expect(s.today.map(a => a.id)).toEqual([4, 3]); // chronological
    expect(s.upcoming.map(a => a.id)).toEqual([6, 5]); // chronological
  });

  it("returns four empty arrays for empty input", () => {
    const s = categorizeFieldJobs([], NOW);
    expect(s).toEqual({ overdue: [], today: [], upcoming: [], completedToday: [] });
  });
});
