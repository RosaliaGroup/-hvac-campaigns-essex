/**
 * Growth-system calling-hours gate (docs/growth-system-spec.md §0/§11).
 *
 * Enforced INSIDE the outbound send path itself (server/services/growth/compliance.ts),
 * not left to individual callers — see that module for the wiring. This file is the
 * pure, DB-free time math so it can be unit tested without a database or a live clock.
 *
 * Window: 9:00–19:00 America/New_York, Monday–Saturday. Sunday is always outside the
 * window. Outside the window, callers must HOLD the send until nextCallingWindowStart()
 * rather than dropping it (spec §1.1: "hold/queue until the next valid window").
 */

const TIME_ZONE = "America/New_York";
const WINDOW_START_HOUR = 9;
const WINDOW_END_HOUR = 19; // exclusive — 19:00 is already outside the window

/** Weekday/hour/minute of `date` as observed in America/New_York, DST-safe. */
function easternParts(date: Date): { weekday: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hourRaw = get("hour");
  // Intl can render midnight as "24" with hour12:false in some environments.
  const hour = hourRaw === "24" ? 0 : Number(hourRaw);
  return { weekday: weekdayMap[get("weekday")] ?? 0, hour, minute: Number(get("minute")) };
}

/** True Mon–Sat 9:00–19:00 America/New_York. Sunday and outside-hours are both false. */
export function isWithinCallingHours(date: Date = new Date()): boolean {
  const { weekday, hour } = easternParts(date);
  if (weekday === 0) return false; // Sunday
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR;
}

/**
 * The next moment `date` (or later) falls inside the calling-hours window.
 * If already inside the window, returns `date` unchanged. Walks forward day-by-day
 * (bounded to 8 days) rather than doing timezone arithmetic by hand, so DST
 * transitions are handled by Intl, not by us.
 */
export function nextCallingWindowStart(date: Date = new Date()): Date {
  if (isWithinCallingHours(date)) return date;

  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const candidateDay = new Date(date.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const { weekday, hour } = easternParts(candidateDay);
    if (weekday === 0) continue; // Sunday never opens

    if (dayOffset === 0 && hour < WINDOW_START_HOUR) {
      // Same day, before the window opens — find today's 9:00 AM ET.
      return findEasternHourOnSameCalendarDay(candidateDay, WINDOW_START_HOUR);
    }
    if (dayOffset > 0) {
      // A future day — its 9:00 AM ET.
      return findEasternHourOnSameCalendarDay(candidateDay, WINDOW_START_HOUR);
    }
    // dayOffset === 0 and hour >= WINDOW_END_HOUR falls through to the next day.
  }
  // Unreachable in practice (Mon–Sat always recurs within 8 days).
  return date;
}

/** Binary-search-free approach: step in minute increments from midnight ET of the
 *  reference date until the local hour matches `targetHour`. Bounded (1440 steps
 *  max) and DST-safe since it only ever asks Intl for the local wall-clock time. */
function findEasternHourOnSameCalendarDay(referenceUtc: Date, targetHour: number): Date {
  // Start from midnight UTC of the reference day and step forward in 15-min
  // increments (max 96 steps/day) until Eastern local time reads targetHour:00.
  const dayStartUtc = new Date(Date.UTC(referenceUtc.getUTCFullYear(), referenceUtc.getUTCMonth(), referenceUtc.getUTCDate(), 0, 0, 0));
  for (let stepMinutes = 0; stepMinutes <= 24 * 60; stepMinutes += 5) {
    const candidate = new Date(dayStartUtc.getTime() + stepMinutes * 60_000);
    const { hour, minute } = easternParts(candidate);
    if (hour === targetHour && minute < 5) return candidate;
  }
  // Fallback: naive UTC-5 offset (should not be reached).
  return new Date(dayStartUtc.getTime() + (targetHour + 5) * 60 * 60_000);
}
