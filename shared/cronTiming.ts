/**
 * Pure "run at HH:MM in a timezone, on these weekdays" scheduling math —
 * no timers, no I/O. Used by in-process schedulers (mirrors the pattern
 * server/services/seo/routes.ts already uses for the daily Search Console
 * sync, extended to a specific time-of-day and a weekday allowlist).
 *
 * Timezone handling: Node has no built-in "next occurrence of HH:MM in TZ"
 * primitive, so this walks forward day-by-day from `now` (in UTC), checking
 * each candidate's wall-clock time in `timeZone` via Intl — correct across
 * DST transitions without a date library dependency.
 */

/** 0 = Sunday ... 6 = Saturday, matching Date#getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleSpec = {
  hour: number; // 0-23, local to `timeZone`
  minute: number; // 0-59
  timeZone: string; // IANA name, e.g. "America/New_York"
  /** Which local weekdays this may run on. Omit for every day. */
  weekdays?: Weekday[];
};

const WEEKDAY_MAP: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function makeFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function wallClockParts(fmt: Intl.DateTimeFormat, date: Date): { weekday: Weekday; hour: number; minute: number } {
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false can render midnight as "24" in some ICU builds — normalize.
  const hour = Number(get("hour")) % 24;
  return { weekday: WEEKDAY_MAP[get("weekday")] ?? 0, hour, minute: Number(get("minute")) };
}

/**
 * Milliseconds from `now` until the next moment that is `spec.hour:minute`
 * local time in `spec.timeZone`, on one of `spec.weekdays` (or any day).
 * Always strictly positive — if `now` IS that exact minute, returns the
 * delay to the NEXT occurrence (a day or more out), never 0, so a caller
 * using this to arm a repeating `setTimeout` can never double-fire.
 */
export function msUntilNextRun(spec: ScheduleSpec, now: Date = new Date()): number {
  const allowedDays = spec.weekdays && spec.weekdays.length > 0 ? new Set(spec.weekdays) : null;
  const fmt = makeFormatter(spec.timeZone);

  // Coarse pass: which of the next 9 UTC-midnight-anchored days (day 0 = today)
  // is a permitted weekday LOCALLY? Cheap — one Intl call per candidate day.
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const dayAnchor = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const anchorLocal = wallClockParts(fmt, dayAnchor);
    if (allowedDays && !allowedDays.has(anchorLocal.weekday)) continue;

    // Fine pass: within +/- 26 hours of this UTC-midnight anchor (covers every
    // timezone offset plus a full day, so the local calendar day this anchor
    // maps to is fully scanned), find the first later instant matching HH:MM
    // that also lands on an allowed local weekday (offset zones can shift the
    // matching minute onto the adjacent local day).
    const startMs = dayAnchor.getTime() - 26 * 60 * 60 * 1000;
    for (let minuteStep = 0; minuteStep < (26 * 2) * 60; minuteStep++) {
      const probe = new Date(startMs + minuteStep * 60 * 1000);
      if (probe.getTime() <= now.getTime()) continue;
      const local = wallClockParts(fmt, probe);
      if (local.hour !== spec.hour || local.minute !== spec.minute) continue;
      if (allowedDays && !allowedDays.has(local.weekday)) continue;
      return probe.getTime() - now.getTime();
    }
  }
  // Unreachable in practice (9 days always contains every weekday+minute
  // combination at least once), but never return a non-positive delay.
  return 24 * 60 * 60 * 1000;
}

/** True if `date`'s wall-clock day (in `timeZone`) is one of `weekdays`. */
export function isAllowedWeekday(date: Date, timeZone: string, weekdays: Weekday[]): boolean {
  const { weekday } = wallClockParts(makeFormatter(timeZone), date);
  return weekdays.includes(weekday);
}
