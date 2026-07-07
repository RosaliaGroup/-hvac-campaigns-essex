import { describe, it, expect } from "vitest";
import { buildIcs, escapeIcsText, formatIcsDate } from "./ics";

const start = new Date("2026-07-08T19:53:00.000Z");
const end = new Date("2026-07-08T20:53:00.000Z");
const dtstamp = new Date("2026-07-07T12:00:00.000Z");

describe("formatIcsDate", () => {
  it("emits UTC basic format", () => {
    expect(formatIcsDate(start)).toBe("20260708T195300Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes commas, semicolons, backslashes, and newlines", () => {
    expect(escapeIcsText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });
});

describe("buildIcs", () => {
  it("builds a REQUEST invite with organizer + attendees", () => {
    const ics = buildIcs({
      uid: "appointment-42@mechanicalenterprise.com",
      sequence: 0,
      method: "REQUEST",
      start,
      end,
      summary: "Service Visit — Jane Doe",
      description: "Details: no heat",
      location: "500 Main St",
      organizer: { email: "ops@mechanicalenterprise.com", name: "Mechanical Enterprise" },
      attendees: [
        { email: "tech@mechanicalenterprise.com", name: "Tech One" },
        { email: "jane@example.com" },
      ],
      dtstamp,
    });
    // CRLF line endings as required by RFC5545.
    expect(ics).toContain("\r\n");
    // Unfold continuation lines (CRLF + space) to read logical lines.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("BEGIN:VCALENDAR");
    expect(unfolded).toContain("METHOD:REQUEST");
    expect(unfolded).toContain("UID:appointment-42@mechanicalenterprise.com");
    expect(unfolded).toContain("DTSTART:20260708T195300Z");
    expect(unfolded).toContain("DTEND:20260708T205300Z");
    expect(unfolded).toContain("STATUS:CONFIRMED");
    expect(unfolded).toContain("ORGANIZER;CN=Mechanical Enterprise:mailto:ops@mechanicalenterprise.com");
    expect(unfolded).toContain("ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=Tech One:mailto:tech@mechanicalenterprise.com");
    expect(unfolded).toContain("mailto:jane@example.com");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("builds a CANCEL with STATUS:CANCELLED and higher sequence", () => {
    const ics = buildIcs({
      uid: "appointment-42@mechanicalenterprise.com",
      sequence: 5,
      method: "CANCEL",
      start,
      end,
      summary: "Service Visit — Jane Doe",
      dtstamp,
    });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:5");
  });
});
