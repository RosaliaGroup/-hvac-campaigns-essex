/** Scheduling rules for CRM prospecting follow-up reminders (never sends messages). */
export type FollowupKind = "human" | "email_review" | "final_review";
export const FOLLOWUP_STEPS: ReadonlyArray<{ kind: FollowupKind; days: number; hour: number }> = [
  { kind: "human", days: 2, hour: 9 },
  { kind: "email_review", days: 3, hour: 10 },
  { kind: "final_review", days: 33, hour: 10 },
];

const TIME_ZONE = "America/New_York";

function easternDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}

function easternOffsetMinutes(date: Date) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(part);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return (match[1] === "+" ? 1 : -1) * minutes;
}

export function followupDueAt(introduction: Date, kind: FollowupKind): Date {
  if (!Number.isFinite(introduction.getTime())) throw new Error("Invalid introduction date");
  const step = FOLLOWUP_STEPS.find(s => s.kind === kind);
  if (!step) throw new Error("Unknown follow-up type");
  const { year, month, day } = easternDateParts(introduction);
  const calendarDay = new Date(Date.UTC(year, month - 1, day + step.days));
  // Weekend reminders roll forward to Monday. No weekend emails are sent.
  while (calendarDay.getUTCDay() === 0 || calendarDay.getUTCDay() === 6)
    calendarDay.setUTCDate(calendarDay.getUTCDate() + 1);
  const localAsUtc = Date.UTC(
    calendarDay.getUTCFullYear(), calendarDay.getUTCMonth(), calendarDay.getUTCDate(), step.hour,
  );
  const offset = easternOffsetMinutes(new Date(localAsUtc));
  return new Date(localAsUtc - offset * 60_000);
}

export function excludeFromOutreachFollowups(input: {
  email: string; name?: string | null; company?: string | null;
}): boolean {
  const email = input.email.trim().toLowerCase();
  const combined = [input.name, input.company, email].filter(Boolean).join(" ").toLowerCase();
  return email === "thomas@vizapropertymanagement.com"
    || email === "jfuller@onyxequities.com"
    || email === "ksaliba@onyxequities.com"
    || email.endsWith("@onyxequities.com")
    || /gabriel[\s._-]*(lopez|lopes)/i.test(combined)
    || /giga\s*holdings|\bgiga\b/i.test(combined);
}
