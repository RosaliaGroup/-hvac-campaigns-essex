/**
 * Field App (mobile) — pure, framework-free helpers shared by the client page
 * (client/src/pages/FieldToday.tsx) and the server endpoint
 * (server/routers.ts → appointments.fieldToday).
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested directly (shared/fieldApp.test.ts) and reused on both ends without
 * touching QuickBooks, Google Calendar, or the core CRM schema.
 */

/** Company operating timezone. Appointments are scheduled in New Jersey. */
export const FIELD_TIME_ZONE = "America/New_York";

/**
 * Minimal shape the field view needs from an appointment row. Kept structural
 * (not tied to the Drizzle type) so tests can build fixtures cheaply and the
 * helpers stay decoupled from the DB layer.
 */
export interface FieldAppointmentLike {
  assignedToId?: number | null;
  /** Real datetime for the visit. Rows without one are the unscheduled backlog. */
  scheduledAt?: Date | string | null;
  /**
   * Appointment lifecycle status (pending/confirmed/arrived/rescheduled/
   * completed/cancelled). Optional so existing callers that only need the
   * "today" filter keep working; the My Jobs categorizer relies on it.
   */
  status?: string | null;
}

// ── Google Maps directions ───────────────────────────────────────────────────

/**
 * True when the appointment has a usable service address (non-empty after trim).
 * Drives the "No service address" fallback so we never render a broken map.
 */
export function hasServiceAddress(address?: string | null): boolean {
  return typeof address === "string" && address.trim().length > 0;
}

/**
 * Google Maps directions URL for one-tap navigation. Returns null when there is
 * no address so callers can show the "No service address" fallback instead of a
 * link that goes nowhere.
 *
 *   https://www.google.com/maps/dir/?api=1&destination=<encoded address>
 */
export function buildDirectionsUrl(address?: string | null): string | null {
  if (!hasServiceAddress(address)) return null;
  const destination = encodeURIComponent(address!.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

// ── "Today" filtering (timezone-aware) ───────────────────────────────────────

interface TzParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Break an instant into wall-clock parts for a given IANA timezone. */
function partsInTimeZone(date: Date, timeZone: string): TzParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Intl can emit "24" for midnight in some engines; normalize to 0.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** The UTC instant whose wall-clock time in `timeZone` equals the given parts. */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const p = partsInTimeZone(new Date(asIfUtc), timeZone);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = localAsUtc - asIfUtc;
  return new Date(asIfUtc - offset);
}

/**
 * The half-open range [start, endExclusive) covering the calendar day that
 * `now` falls on in `timeZone`. start is local midnight; endExclusive is the
 * next local midnight (handles month/DST boundaries via a calendar-day step).
 */
export function dayRangeInTimeZone(
  now: Date,
  timeZone: string = FIELD_TIME_ZONE,
): { start: Date; endExclusive: Date } {
  const p = partsInTimeZone(now, timeZone);
  const start = zonedWallTimeToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
  // Step one calendar day forward, then resolve that local midnight to UTC.
  const nextCal = new Date(Date.UTC(p.year, p.month - 1, p.day));
  nextCal.setUTCDate(nextCal.getUTCDate() + 1);
  const endExclusive = zonedWallTimeToUtc(
    nextCal.getUTCFullYear(),
    nextCal.getUTCMonth() + 1,
    nextCal.getUTCDate(),
    0,
    0,
    0,
    timeZone,
  );
  return { start, endExclusive };
}

/** Coerce a Date | ISO string | null into a Date, or null when unparseable. */
function toDate(value?: Date | string | null): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when `scheduledAt` falls on the same calendar day as `now` in `timeZone`. */
export function isScheduledToday(
  scheduledAt: Date | string | null | undefined,
  now: Date,
  timeZone: string = FIELD_TIME_ZONE,
): boolean {
  const when = toDate(scheduledAt);
  if (!when) return false;
  const { start, endExclusive } = dayRangeInTimeZone(now, timeZone);
  return when.getTime() >= start.getTime() && when.getTime() < endExclusive.getTime();
}

/**
 * The field view's core filter: appointments scheduled for today AND assigned to
 * the given team member. Both conditions must hold. Rows with no scheduledAt or
 * no matching assignee are excluded.
 */
export function filterTodaysAssignedAppointments<T extends FieldAppointmentLike>(
  appointments: T[],
  memberId: number,
  now: Date,
  timeZone: string = FIELD_TIME_ZONE,
): T[] {
  return appointments.filter(
    a => a.assignedToId === memberId && isScheduledToday(a.scheduledAt, now, timeZone),
  );
}

// ── Quick-action → status mapping ────────────────────────────────────────────

/** Appointment statuses reachable from the field app's quick actions. */
export type FieldActionStatus = "arrived" | "completed";

/**
 * Map a field quick action to the appointment status it sets.
 *   "arrive"    → "arrived"
 *   "complete"  → "completed"
 * Returns null for unknown actions so callers can no-op safely.
 */
export function statusForFieldAction(action: string): FieldActionStatus | null {
  switch (action) {
    case "arrive":
    case "arrived":
      return "arrived";
    case "complete":
    case "completed":
      return "completed";
    default:
      return null;
  }
}

// ── Logged-in team member resolution ─────────────────────────────────────────

/** Session prefix used for team-member sessions (see server/_core/sdk.ts). */
export const TEAM_SESSION_PREFIX = "team:";

/**
 * Derive the teamMembers.id for the logged-in user, or null when the session is
 * not a team-member session (e.g. a Manus OAuth user, who has no field
 * assignments). Team sessions encode the id two consistent ways:
 *   - openId === "team:<id>"
 *   - id === -<id>            (negated to avoid colliding with OAuth user ids)
 */
export function resolveTeamMemberId(
  user: { id?: number | null; openId?: string | null } | null | undefined,
): number | null {
  if (!user) return null;
  if (typeof user.openId === "string" && user.openId.startsWith(TEAM_SESSION_PREFIX)) {
    const parsed = parseInt(user.openId.slice(TEAM_SESSION_PREFIX.length), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (typeof user.id === "number" && user.id < 0) return -user.id;
  return null;
}

// ── "My Jobs" dashboard sectioning ───────────────────────────────────────────

/** Statuses that represent a live, still-actionable visit. */
export const FIELD_ACTIVE_STATUSES = ["pending", "confirmed", "arrived", "rescheduled"] as const;

/** The four buckets the technician "My Jobs" dashboard renders. */
export interface FieldJobSections<T> {
  /** Active visits scheduled before today's local day — past-due, not finished. */
  overdue: T[];
  /** Active visits scheduled within today's local day. */
  today: T[];
  /** Active visits scheduled after today's local day. */
  upcoming: T[];
  /** Visits completed and scheduled within today's local day. */
  completedToday: T[];
}

/**
 * Split a technician's appointments into the My Jobs dashboard sections, using
 * the same timezone-aware calendar-day window as the rest of the field app.
 *
 * Rules (see plan): `cancelled` is dropped from every section; rows with no
 * `scheduledAt` are the unscheduled backlog and are not surfaced here.
 *   - completed + scheduled today        → completedToday
 *   - completed + any other day          → omitted (history)
 *   - active   + scheduled today         → today
 *   - active   + scheduled before today  → overdue
 *   - active   + scheduled after today   → upcoming
 * "active" = any non-completed, non-cancelled status.
 *
 * Pure and deterministic (given `now`): the caller passes the wall-clock instant
 * so tests can pin it. Overdue is returned most-recent-first (the freshest
 * misses float to the top); the other sections are chronological.
 */
export function categorizeFieldJobs<T extends FieldAppointmentLike>(
  appointments: T[],
  now: Date,
  timeZone: string = FIELD_TIME_ZONE,
): FieldJobSections<T> {
  const { start, endExclusive } = dayRangeInTimeZone(now, timeZone);
  const startMs = start.getTime();
  const endMs = endExclusive.getTime();

  const overdue: T[] = [];
  const today: T[] = [];
  const upcoming: T[] = [];
  const completedToday: T[] = [];

  for (const appt of appointments) {
    const when = toDate(appt.scheduledAt);
    if (!when) continue; // unscheduled backlog — not part of the dated sections
    const status = (appt.status ?? "").toLowerCase();
    if (status === "cancelled") continue; // a cancelled visit is not a job

    const t = when.getTime();
    const isToday = t >= startMs && t < endMs;

    if (status === "completed") {
      if (isToday) completedToday.push(appt);
      continue; // completed on another day is history, not shown here
    }

    if (isToday) today.push(appt);
    else if (t < startMs) overdue.push(appt);
    else upcoming.push(appt);
  }

  const timeOf = (a: T) => toDate(a.scheduledAt)?.getTime() ?? 0;
  const asc = (a: T, b: T) => timeOf(a) - timeOf(b);

  overdue.sort((a, b) => timeOf(b) - timeOf(a)); // most-recent overdue first
  today.sort(asc);
  upcoming.sort(asc);
  completedToday.sort(asc);

  return { overdue, today, upcoming, completedToday };
}
