/**
 * Deterministic parsing of the free-text preferredDate / preferredTime strings
 * that Jessica (Vapi) and the assessment forms have historically written.
 *
 * Design: strictly rule-based (no NLP dependency), returns null when unsure —
 * an unparsed appointment is safer than a wrongly-scheduled one. Unparsed rows
 * surface in the calendar's "Unscheduled" backlog (Task 4).
 */
import { addDays, isValid, parse, setHours, setMinutes } from "date-fns";

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "M/d/yyyy",
  "MM/dd/yyyy",
  "M/d/yy",
  "M-d-yyyy",
  "MMMM d yyyy",
  "MMMM d, yyyy",
  "MMM d yyyy",
  "MMM d, yyyy",
];

const YEARLESS_FORMATS = ["MMMM d", "MMM d", "M/d"];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Parse a date string to a local Date at midnight, or null. */
export function parsePreferredDate(raw: string | null | undefined, now: Date = new Date()): Date | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/(\d+)(st|nd|rd|th)/g, "$1");
  if (!s) return null;

  if (s === "today") return startOfDayLocal(now);
  if (s === "tomorrow") return startOfDayLocal(addDays(now, 1));

  // "friday", "next friday", "this friday" → next occurrence (never today)
  const weekdayMatch = s.match(/^(next |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(weekdayMatch[2]);
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    if (weekdayMatch[1]?.trim() === "next" && delta <= 3) delta += 7; // "next" implies not the immediate few days
    return startOfDayLocal(addDays(now, delta));
  }

  for (const fmt of DATE_FORMATS) {
    const d = parse(s, fmt.toLowerCase() === fmt ? fmt : fmt, now);
    if (isValid(d) && d.getFullYear() > 2000) return startOfDayLocal(d);
  }

  // Year-less dates: assume the next occurrence (this year, or next year if already past)
  for (const fmt of YEARLESS_FORMATS) {
    const d = parse(s, fmt, now);
    if (isValid(d)) {
      const candidate = startOfDayLocal(d);
      if (candidate.getTime() < startOfDayLocal(now).getTime()) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }
      return candidate;
    }
  }

  return null;
}

/** Parse a time string to {hours, minutes}, or null. */
export function parsePreferredTime(raw: string | null | undefined): { hours: number; minutes: number } | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;

  if (s === "noon" || s === "12pm" || s === "12 pm") return { hours: 12, minutes: 0 };
  if (s === "midnight") return { hours: 0, minutes: 0 };
  if (/^morning$/.test(s)) return { hours: 9, minutes: 0 };
  if (/^(early )?afternoon$/.test(s)) return { hours: 13, minutes: 0 };
  if (/^(late afternoon)$/.test(s)) return { hours: 16, minutes: 0 };
  if (/^evening$/.test(s)) return { hours: 17, minutes: 0 };

  // "2pm", "2 pm", "2:30pm", "2:30 pm", "02:30 PM"
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let hours = parseInt(ampm[1]);
    const minutes = ampm[2] ? parseInt(ampm[2]) : 0;
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (ampm[3] === "pm" && hours !== 12) hours += 12;
    if (ampm[3] === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // 24h "14:00" / "9:30"
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const hours = parseInt(h24[1]);
    const minutes = parseInt(h24[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  // ranges like "between 2 and 4 pm" / "2-4pm" → take the start
  const range = s.match(/^(?:between )?(\d{1,2})(?::(\d{2}))?\s*(?:-|to|and)\s*\d{1,2}(?::\d{2})?\s*(am|pm)$/);
  if (range) {
    let hours = parseInt(range[1]);
    const minutes = range[2] ? parseInt(range[2]) : 0;
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (range[3] === "pm" && hours !== 12) hours += 12;
    return { hours, minutes };
  }

  return null;
}

/**
 * Combine preferredDate + preferredTime into a Date.
 * Returns null if the DATE can't be parsed. If only the TIME fails,
 * defaults to 9:00 AM (documented default for calendar placement).
 */
export function parsePreferredDateTime(
  dateRaw: string | null | undefined,
  timeRaw: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  const date = parsePreferredDate(dateRaw, now);
  if (!date) return null;
  const time = parsePreferredTime(timeRaw) ?? { hours: 9, minutes: 0 };
  return setMinutes(setHours(date, time.hours), time.minutes);
}

function startOfDayLocal(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
