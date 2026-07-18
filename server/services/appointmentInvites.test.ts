import { describe, it, expect } from "vitest";
import {
  normalizeAttendees,
  isValidEmail,
  appointmentSummary,
  appointmentDescription,
} from "./appointmentInvites";
import { buildIcs } from "./ics";
import { mapToGoogleEvent } from "../integrations/google/calendar";

describe("isValidEmail", () => {
  it("accepts real addresses and rejects junk", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe("normalizeAttendees", () => {
  it("lowercases, drops invalid emails, and auto-adds the customer", () => {
    const out = normalizeAttendees(
      [
        { email: "Tech@Mechanical.com", name: "Tech", role: "team_member", teamMemberId: 3 },
        { email: "not-an-email", role: "guest" },
        { email: "guest@partner.com", role: "guest" },
      ],
      { customerEmail: "Jane@Example.com", customerName: "Jane Doe" },
    );
    const emails = out.map(a => a.email);
    expect(emails).toEqual(["tech@mechanical.com", "guest@partner.com", "jane@example.com"]);
    expect(out.find(a => a.email === "jane@example.com")?.role).toBe("customer");
    expect(out.find(a => a.email === "tech@mechanical.com")?.teamMemberId).toBe(3);
  });

  it("de-duplicates by email, keeping the higher-priority role", () => {
    const out = normalizeAttendees([
      { email: "same@x.com", role: "guest" },
      { email: "same@x.com", role: "team_member", teamMemberId: 9 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("team_member");
    expect(out[0].teamMemberId).toBe(9);
  });

  it("does not add the customer when no customer email is given", () => {
    const out = normalizeAttendees([{ email: "g@x.com", role: "guest" }]);
    expect(out).toHaveLength(1);
    expect(out.some(a => a.role === "customer")).toBe(false);
  });

  it("skips an invalid customer email", () => {
    const out = normalizeAttendees([], { customerEmail: "bad", customerName: "X" });
    expect(out).toHaveLength(0);
  });
});

describe("appointment summary/description", () => {
  it("builds the title from appointment + service type (en dash, no customer name)", () => {
    expect(appointmentSummary({ appointmentType: "assessment", serviceType: "mini_split_installation" })).toBe(
      "Assessment – Mini Split Installation",
    );
    // Legacy type falls back to Assessment; no service type → just the type label.
    expect(appointmentSummary({ appointmentType: "free_consultation", serviceType: null })).toBe("Assessment");
  });

  it("orders the description and puts the customer above the address", () => {
    const desc = appointmentDescription(
      {
        fullName: "Jane Doe",
        phone: "862-555-0100",
        email: "jane@example.com",
        propertyAddress: "500 Main St",
        appointmentType: "installation",
        serviceType: "heat_pump",
        notes: "Gate code 4432",
      },
      { assignedTechnician: "Mike R.", assignedTechnicianEmail: "mike@x.com", additionalTechnicians: ["Sam T."] },
    );
    expect(desc.indexOf("Customer")).toBeLessThan(desc.indexOf("Service Address"));
    expect(desc).toContain("Customer\nJane Doe");
    expect(desc).toContain("Appointment Type\nInstallation");
    expect(desc).toContain("Service Type\nHeat Pump");
    expect(desc).toContain("Assigned Technician\nMike R.");
    expect(desc).toContain("Additional Technicians\nSam T.");
    expect(desc.endsWith("Booked via Mechanical Enterprise CRM")).toBe(true);
  });

  it("includes the appointment's job description (issueDescription) in the body", () => {
    const desc = appointmentDescription({
      fullName: "Jane Doe",
      phone: "862-555-0100",
      email: "jane@example.com",
      propertyAddress: "500 Main St",
      appointmentType: "service_call",
      serviceType: null,
      issueDescription: "No heat on second floor; furnace short-cycling",
      notes: "Gate code 4432",
    });
    expect(desc).toContain("Job Description\nNo heat on second floor; furnace short-cycling");
    // Job description is distinct from internal notes; both appear.
    expect(desc).toContain("Notes\nGate code 4432");
  });

  it("carries the job description into both the Google Calendar event and the ICS invite", () => {
    const appt = {
      fullName: "Jane Doe",
      phone: "862-555-0100",
      email: "jane@example.com",
      propertyAddress: "500 Main St",
      appointmentType: "service_call" as const,
      serviceType: null,
      issueDescription: "No heat on second floor",
      notes: null,
    };
    const description = appointmentDescription(appt);
    const start = new Date("2026-07-08T19:53:00.000Z");
    const end = new Date("2026-07-08T20:53:00.000Z");

    // Google Calendar path (mapToGoogleEvent receives the same description string).
    const event = mapToGoogleEvent({
      summary: appointmentSummary(appt),
      description,
      location: appt.propertyAddress,
      scheduledAt: start,
      durationMinutes: 60,
      attendees: [{ email: "jane@example.com" }],
    });
    expect(event.description).toContain("Job Description\nNo heat on second floor");

    // ICS fallback path.
    const ics = buildIcs({
      uid: "appointment-1@mechanicalenterprise.com",
      sequence: 0,
      method: "REQUEST",
      start,
      end,
      summary: appointmentSummary(appt),
      description,
      location: appt.propertyAddress,
      organizer: { email: "ops@mechanicalenterprise.com", name: "Mechanical Enterprise" },
      attendees: [{ email: "jane@example.com" }],
      dtstamp: new Date("2026-07-07T12:00:00.000Z"),
    });
    // Unfold RFC5545 continuation lines before asserting on the logical DESCRIPTION value.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("Job Description");
    expect(unfolded).toContain("No heat on second floor");
  });
});
