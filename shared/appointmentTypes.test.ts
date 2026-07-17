import { describe, it, expect } from "vitest";
import {
  normalizeAppointmentType,
  appointmentTypeLabel,
  serviceTypeLabel,
  showsServiceType,
  buildAppointmentTitle,
  buildAppointmentDescription,
  reminderToGoogle,
  reminderLabel,
} from "./appointmentTypes";

describe("normalizeAppointmentType (backwards compatibility)", () => {
  it("defaults missing type to Assessment", () => {
    expect(normalizeAppointmentType(null)).toBe("assessment");
    expect(normalizeAppointmentType(undefined)).toBe("assessment");
    expect(normalizeAppointmentType("")).toBe("assessment");
  });

  it("maps legacy Free Consultation to Assessment", () => {
    expect(normalizeAppointmentType("free_consultation")).toBe("assessment");
    expect(appointmentTypeLabel("free_consultation")).toBe("Assessment");
  });

  it("maps other legacy types to their new equivalents", () => {
    expect(normalizeAppointmentType("technician_dispatch")).toBe("service_call");
    expect(normalizeAppointmentType("maintenance_plan")).toBe("maintenance");
    expect(normalizeAppointmentType("commercial_assessment")).toBe("assessment");
  });

  it("passes through new values unchanged", () => {
    expect(normalizeAppointmentType("installation")).toBe("installation");
  });
});

describe("showsServiceType", () => {
  it("shows for assessment/estimate/service_call/installation/maintenance", () => {
    for (const t of ["assessment", "estimate", "service_call", "installation", "maintenance"]) {
      expect(showsServiceType(t)).toBe(true);
    }
  });
  it("hides for the rest (and shows for legacy free_consultation via normalization)", () => {
    expect(showsServiceType("warranty")).toBe(false);
    expect(showsServiceType("inspection")).toBe(false);
    expect(showsServiceType("sales_visit")).toBe(false);
    expect(showsServiceType("other")).toBe(false);
    expect(showsServiceType("free_consultation")).toBe(true); // → assessment
  });
});

describe("buildAppointmentTitle (Google Calendar title)", () => {
  it("Assessment → Mini Split", () => {
    expect(buildAppointmentTitle("assessment", "mini_split_installation")).toBe("Assessment – Mini Split Installation");
  });
  it("Installation → Heat Pump", () => {
    expect(buildAppointmentTitle("installation", "heat_pump")).toBe("Installation – Heat Pump");
  });
  it("Maintenance → Furnace", () => {
    expect(buildAppointmentTitle("maintenance", "furnace")).toBe("Maintenance – Furnace");
  });
  it("Estimate → Boiler", () => {
    expect(buildAppointmentTitle("estimate", "boiler")).toBe("Estimate – Boiler");
  });
  it("uses an en dash, not an em dash, and omits the customer name", () => {
    const title = buildAppointmentTitle("assessment", "central_air");
    expect(title).toContain("–");
    expect(title).not.toContain("—");
  });
  it("falls back to just the type label when no service type", () => {
    expect(buildAppointmentTitle("warranty", null)).toBe("Warranty");
    expect(buildAppointmentTitle("free_consultation", null)).toBe("Assessment"); // legacy → Assessment
  });

  it("changing the appointment type changes the generated title (edit updates event)", () => {
    const before = buildAppointmentTitle("assessment", "furnace");
    const after = buildAppointmentTitle("maintenance", "furnace");
    expect(before).toBe("Assessment – Furnace");
    expect(after).toBe("Maintenance – Furnace");
    expect(after).not.toBe(before);
  });
});

describe("buildAppointmentDescription (ordering)", () => {
  const desc = buildAppointmentDescription({
    fullName: "Rosalia Roqueirr",
    phone: "862-555-0100",
    email: "rosalia@example.com",
    propertyAddress: "12 Elm St, Newark NJ",
    appointmentType: "assessment",
    serviceType: "mini_split_installation",
    issueDescription: "No heat upstairs",
    assignedTechnician: "Mike R.",
    additionalTechnicians: ["Sam T.", "Dana K."],
    notes: "Rear unit",
  });

  it("orders sections Customer → Phone → Email → Service Address → Appointment Type → Service Type → Job Description → Assigned Technician → Additional Technicians → Notes", () => {
    const order = [
      "Customer", "Phone", "Email", "Service Address",
      "Appointment Type", "Service Type", "Job Description", "Assigned Technician", "Additional Technicians", "Notes",
    ].map(l => desc.indexOf(l));
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
    expect(order.every(i => i >= 0)).toBe(true);
  });

  it("puts the customer name above the location", () => {
    expect(desc.indexOf("Rosalia Roqueirr")).toBeLessThan(desc.indexOf("12 Elm St, Newark NJ"));
  });

  it("ends with the CRM footer and joins additional technicians with commas", () => {
    expect(desc).toContain("Additional Technicians\nSam T., Dana K.");
    expect(desc.endsWith("Booked via Mechanical Enterprise CRM")).toBe(true);
  });

  it("omits blank sections", () => {
    const minimal = buildAppointmentDescription({ fullName: "Solo", appointmentType: "other" });
    expect(minimal).toContain("Customer\nSolo");
    expect(minimal).not.toContain("Phone");
    expect(minimal).not.toContain("Service Type");
    expect(minimal).not.toContain("Additional Technicians");
    expect(minimal).not.toContain("Job Description");
  });

  it("renders the job description (issueDescription) as its own section", () => {
    expect(desc).toContain("Job Description\nNo heat upstairs");
    // Positioned after Service Type and before the technician sections.
    expect(desc.indexOf("Service Type")).toBeLessThan(desc.indexOf("Job Description"));
    expect(desc.indexOf("Job Description")).toBeLessThan(desc.indexOf("Assigned Technician"));
  });
});

describe("reminders (Google sync)", () => {
  it("maps a reminder to a popup override", () => {
    expect(reminderToGoogle(30)).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 30 }] });
    expect(reminderToGoogle(1440)).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 1440 }] });
  });
  it("maps none to no overrides", () => {
    expect(reminderToGoogle(null)).toEqual({ useDefault: false, overrides: [] });
    expect(reminderToGoogle(undefined)).toEqual({ useDefault: false, overrides: [] });
  });
  it("labels reminders", () => {
    expect(reminderLabel(60)).toBe("1 hour");
    expect(reminderLabel(null)).toBe("None");
  });
});

describe("serviceTypeLabel", () => {
  it("resolves known values and falls back to the raw string", () => {
    expect(serviceTypeLabel("refrigeration")).toBe("Refrigeration");
    expect(serviceTypeLabel(null)).toBeNull();
    expect(serviceTypeLabel("something_custom")).toBe("something_custom");
  });
});
