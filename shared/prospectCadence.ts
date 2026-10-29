/**
 * Pure timing rules for the single automated HVAC email sender (Railway prospect workflow).
 * No I/O. All clock logic is America/New_York.
 *
 *  - Sending cycles: Mon–Fri 09:00–16:59 ET (one cycle per Eastern clock hour).
 *  - 17:00 ET: read-only closing report, no sends.
 *  - Follow-ups: weekday (business) day 4/10/18/26 after the introduction, in the
 *    original thread, one step at a time — only the oldest unsent due step.
 *  - Shared cap: 20 outreach messages per Eastern hour while a follow-up backlog
 *    exists, 10 once it is reconciled. Counts every non-report message in Gmail
 *    Sent for the hour (manual + automated). A safety ceiling, not a target.
 */

export const FOLLOW_UP_BUSINESS_DAYS = [4, 10, 18, 26] as const;
export const CATCH_UP_HOURLY_CAP = 20;
export const NORMAL_HOURLY_CAP = 10;
export const MAX_CANDIDATES_PER_PHASE = 5; // follow-ups inspected per hour
/** New introductions per hour (PROSPECT_INTROS_PER_HOUR, 1–15). Still bounded by the shared hourly cap. */
export const DEFAULT_INTROS_PER_HOUR = 10;
export function introsPerHour(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.PROSPECT_INTROS_PER_HOUR);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 15) : DEFAULT_INTROS_PER_HOUR;
}
/** Queued candidates inspected per hour to reach the intro target (about half are stopped by safety checks). */
export const MAX_INTRO_CANDIDATES = 30;
export const REPORT_SUBJECT_PREFIX = "Mechanical Enterprise Hourly Outreach Report";

type EtParts = { weekday: string; year: string; month: string; day: string; hour: number; minute: number; second: number };

export function easternParts(now: Date): EtParts {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", weekday: "short", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map(x => [x.type, x.value]),
  );
  return {
    weekday: p.weekday, year: p.year, month: p.month, day: p.day,
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
  };
}

const isWeekendDay = (weekday: string) => weekday === "Sat" || weekday === "Sun";
const hourKey = (p: EtParts) => `${p.year}-${p.month}-${p.day}T${String(p.hour).padStart(2, "0")}`;

/** Key for an eligible SENDING hour (Mon–Fri 9–16 ET), else null. */
export function sendingHour(now: Date): string | null {
  const p = easternParts(now);
  return !isWeekendDay(p.weekday) && p.hour >= 9 && p.hour < 17 ? hourKey(p) : null;
}

/** Key for any scheduled CYCLE hour (Mon–Fri 9–17 ET; 17 is report-only), else null. */
export function cycleHour(now: Date): string | null {
  const p = easternParts(now);
  return !isWeekendDay(p.weekday) && p.hour >= 9 && p.hour <= 17 ? hourKey(p) : null;
}

/** Epoch seconds of the start of the current Eastern clock hour (DST-safe). */
export function easternHourStartEpochSec(now: Date): number {
  const p = easternParts(now);
  const ms = now.getTime() - (p.minute * 60 + p.second) * 1000 - now.getMilliseconds();
  return Math.floor(ms / 1000);
}

/** `Mechanical Enterprise Hourly Outreach Report — YYYY-MM-DD HH:00 ET` */
export function reportSubject(now: Date): string {
  const p = easternParts(now);
  return `${REPORT_SUBJECT_PREFIX} — ${p.year}-${p.month}-${p.day} ${String(p.hour).padStart(2, "0")}:00 ET`;
}

/** Add N Eastern business days (Mon–Fri) to a date, keeping the time of day. */
export function addBusinessDays(from: Date, days: number): Date {
  let d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d = new Date(d.getTime() + 86_400_000);
    if (!isWeekendDay(easternParts(d).weekday)) added++;
  }
  return d;
}

/**
 * When the next follow-up step is due. `touchCount` counts sent messages
 * including the introduction (1 = intro only → step day 4 is next).
 * Returns null when the cadence is complete. Steps never catch up in bursts:
 * the next step is at least one business day after the most recent send.
 */
export function nextFollowUpDue(introAt: Date, touchCount: number, lastSentAt: Date): Date | null {
  const step = touchCount - 1;
  if (step < 0 || step >= FOLLOW_UP_BUSINESS_DAYS.length) return null;
  const cadenceDate = addBusinessDays(introAt, FOLLOW_UP_BUSINESS_DAYS[step]);
  const spacing = addBusinessDays(lastSentAt, 1);
  return cadenceDate > spacing ? cadenceDate : spacing;
}

/** 20/hour during catch-up (any overdue follow-up backlog), 10/hour once reconciled. */
export function hourlyCap(overdueBacklog: number): number {
  return overdueBacklog > 0 ? CATCH_UP_HOURLY_CAP : NORMAL_HOURLY_CAP;
}

/** Remaining outreach allowance this hour. Fails closed on unknown counts. */
export function remainingAllowance(cap: number, sentThisHour: number | null): number {
  if (sentThisHour === null || !Number.isFinite(sentThisHour)) return 0;
  return Math.max(0, cap - sentThisHour);
}

export const normalizeCompany = (company: string) =>
  company.toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|inc|corp|corporation|co|company|group|the|ltd|lp|llp)\b/g, " ")
    .replace(/\s+/g, " ").trim();

/** Make a follow-up subject thread under the original ("Re: <original>"). */
export function replySubject(original: string): string {
  const s = original.trim() || "HVAC service partnership — Mechanical Enterprise";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}
