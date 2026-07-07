/**
 * Minimal, dependency-free iCalendar (RFC 5545) builder (Task 8).
 *
 * Used for the ICS email-invite fallback when Google Calendar isn't connected:
 * the attendee gets an .ics attachment they can add to any calendar app. Pure
 * and deterministic (pass `dtstamp` to fix the timestamp) so it is unit-tested.
 */

export interface IcsAttendee {
  email: string;
  name?: string | null;
  role?: "REQ-PARTICIPANT" | "OPT-PARTICIPANT";
  rsvp?: boolean;
  partstat?: "NEEDS-ACTION" | "ACCEPTED" | "DECLINED" | "TENTATIVE";
}

export interface IcsEvent {
  /** Stable per-appointment id, e.g. "appointment-42@mechanicalenterprise.com". */
  uid: string;
  /** Bump on every update so clients replace the prior version. */
  sequence?: number;
  method?: "REQUEST" | "CANCEL" | "PUBLISH";
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  organizer?: { email: string; name?: string | null } | null;
  attendees?: IcsAttendee[];
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  /** Defaults to now; injectable for deterministic tests. */
  dtstamp?: Date;
}

/** RFC5545 TEXT escaping: backslash, semicolon, comma, and newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** UTC form: 20260708T195300Z. */
export function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Fold content lines to <=75 octets per RFC5545 (continuation lines start with a space). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

function attendeeLine(a: IcsAttendee): string {
  const params = [
    a.role ? `ROLE=${a.role}` : "ROLE=REQ-PARTICIPANT",
    `PARTSTAT=${a.partstat ?? "NEEDS-ACTION"}`,
    `RSVP=${a.rsvp === false ? "FALSE" : "TRUE"}`,
  ];
  if (a.name) params.push(`CN=${escapeIcsText(a.name)}`);
  return `ATTENDEE;${params.join(";")}:mailto:${a.email}`;
}

/** Build a complete VCALENDAR document (CRLF line endings, as required). */
export function buildIcs(event: IcsEvent): string {
  const method = event.method ?? "REQUEST";
  const status = event.status ?? (method === "CANCEL" ? "CANCELLED" : "CONFIRMED");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mechanical Enterprise//CRM//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `DTSTAMP:${formatIcsDate(event.dtstamp ?? new Date())}`,
    `DTSTART:${formatIcsDate(event.start)}`,
    `DTEND:${formatIcsDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `STATUS:${status}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.organizer) {
    const cn = event.organizer.name ? `;CN=${escapeIcsText(event.organizer.name)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${event.organizer.email}`);
  }
  for (const a of event.attendees ?? []) lines.push(attendeeLine(a));
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
