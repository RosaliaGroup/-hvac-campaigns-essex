/** Mechanical Enterprise 30-day / 10-touch cadence: Day 0 intro + nine CRM reminders.
 * Reminder creation is NOT a completed touch. Email sends require separate Gmail confirmation.
 */
export const THIRTY_DAY_STEPS = [
  { touch: 2, day: 2, kind: "human", hour: 9, label: "Personal introduction call" },
  { touch: 3, day: 4, kind: "email_review", hour: 10, label: "Brief email check-in" },
  { touch: 4, day: 7, kind: "human", hour: 9, label: "Second personal call" },
  { touch: 5, day: 10, kind: "email_review", hour: 10, label: "Maintenance insight" },
  { touch: 6, day: 14, kind: "human", hour: 9, label: "Upcoming project conversation" },
  { touch: 7, day: 18, kind: "email_review", hour: 10, label: "Replacement planning example" },
  { touch: 8, day: 22, kind: "human", hour: 9, label: "Relationship check-in" },
  { touch: 9, day: 26, kind: "email_review", hour: 10, label: "Final value-based email" },
  { touch: 10, day: 30, kind: "human", hour: 9, label: "Final personal check-in" },
] as const;
export type CadenceKind = "human" | "email_review";
export type CadenceOutcome = "attempted_no_answer" | "connected" | "not_interested" | "reviewed_no_send" | "sent_verified";
export const CADENCE_TIME_ZONE = "America/New_York";
function easternParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CADENCE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}
function offsetMinutes(date: Date) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: CADENCE_TIME_ZONE, timeZoneName: "shortOffset",
  }).formatToParts(date).find(p => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(part);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return (match[1] === "+" ? 1 : -1) * minutes;
}
export function cadenceDueAt(introduction: Date, touch: number): Date {
  if (!Number.isFinite(introduction.getTime())) throw new Error("Invalid introduction date");
  const step = THIRTY_DAY_STEPS.find(s => s.touch === touch);
  if (!step) throw new Error("Unknown cadence touch");
  const { year, month, day } = easternParts(introduction);
  const date = new Date(Date.UTC(year, month - 1, day + step.day));
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  const localUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), step.hour);
  return new Date(localUtc - offsetMinutes(new Date(localUtc)) * 60_000);
}
export function cadenceExcluded(input: { email: string; name?: string | null; company?: string | null; notes?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const text = [email, input.name, input.company].filter(Boolean).join(" ").toLowerCase();
  return email === "thomas@vizapropertymanagement.com" ||
    email.endsWith("@onyxequities.com") ||
    /gabriel[\s._-]*(lopes|lopez)/i.test(text) ||
    /giga\s*holdings|\bgiga\b/i.test(text) ||
    /do not contact|unsubscrib|opted out/i.test(input.notes ?? "");
}
