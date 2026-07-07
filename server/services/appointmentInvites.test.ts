import { describe, it, expect } from "vitest";
import {
  normalizeAttendees,
  isValidEmail,
  appointmentSummary,
  appointmentDescription,
} from "./appointmentInvites";

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
  it("labels the summary by appointment type", () => {
    expect(appointmentSummary({ appointmentType: "technician_dispatch", fullName: "Jane Doe" })).toBe(
      "Service Visit — Jane Doe",
    );
    expect(appointmentSummary({ appointmentType: "unknown_type", fullName: "Jane" })).toBe("Appointment — Jane");
  });

  it("includes only the details that are present", () => {
    const desc = appointmentDescription({
      issueDescription: "No heat",
      notes: null,
      phone: "862-555-0100",
      propertyAddress: "500 Main St",
    });
    expect(desc).toContain("Details: No heat");
    expect(desc).toContain("Location: 500 Main St");
    expect(desc).toContain("Contact: 862-555-0100");
    expect(desc).not.toContain("Notes:");
  });
});
