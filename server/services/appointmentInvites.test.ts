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
});
