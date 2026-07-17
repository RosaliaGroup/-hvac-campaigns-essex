import { describe, it, expect } from "vitest";
import {
  formatPropertyAddress,
  pickAppointmentProperty,
  customerAppointmentDefaults,
  leadAppointmentDefaults,
  type PropertyLike,
} from "./appointmentDefaults";

const primary: PropertyLike = {
  id: 10,
  isPrimary: true,
  addressLine1: "500 Main St",
  addressLine2: "Suite 200",
  city: "Newark",
  state: "NJ",
  zip: "07102",
};
const secondary: PropertyLike = {
  id: 20,
  isPrimary: false,
  addressLine1: "12 Elm Ave",
  city: "Montclair",
  state: "NJ",
  zip: "07042",
};

const customer = { id: 7, displayName: "Jane Doe", phone: "862-555-0100", email: "jane@example.com", type: "residential" as const };

describe("formatPropertyAddress", () => {
  it("composes a full single-line street address", () => {
    expect(formatPropertyAddress(primary)).toBe("500 Main St, Suite 200, Newark, NJ 07102");
  });

  it("omits blank parts without dangling separators", () => {
    expect(formatPropertyAddress({ id: 1, addressLine1: "9 Oak Rd", state: "NJ" })).toBe("9 Oak Rd, NJ");
    expect(formatPropertyAddress({ id: 1, addressLine1: "9 Oak Rd" })).toBe("9 Oak Rd");
  });

  it("returns empty string for a missing property", () => {
    expect(formatPropertyAddress(undefined)).toBe("");
    expect(formatPropertyAddress(null)).toBe("");
  });
});

describe("pickAppointmentProperty", () => {
  it("prefers the primary property when nothing is explicitly selected", () => {
    expect(pickAppointmentProperty([secondary, primary])?.id).toBe(10);
  });

  it("falls back to the first property when none is marked primary", () => {
    expect(pickAppointmentProperty([secondary, { ...primary, isPrimary: false }])?.id).toBe(20);
  });

  it("returns undefined when the customer has no properties", () => {
    expect(pickAppointmentProperty([])).toBeUndefined();
  });

  it("uses an explicitly selected property over the primary (does not overwrite the selection)", () => {
    expect(pickAppointmentProperty([primary, secondary], 20)?.id).toBe(20);
  });

  it("ignores an unknown selected id and falls back to the primary", () => {
    expect(pickAppointmentProperty([primary, secondary], 999)?.id).toBe(10);
  });
});

describe("customerAppointmentDefaults", () => {
  it("prefills the customer, primary property id, and full property address", () => {
    const d = customerAppointmentDefaults(customer, [secondary, primary]);
    expect(d).toEqual({
      customerId: 7,
      fullName: "Jane Doe",
      phone: "862-555-0100",
      email: "jane@example.com",
      propertyType: "residential",
      propertyId: 10,
      propertyAddress: "500 Main St, Suite 200, Newark, NJ 07102",
    });
  });

  it("respects an explicitly selected property and does not overwrite it with the primary", () => {
    const d = customerAppointmentDefaults(customer, [primary, secondary], 20);
    expect(d.propertyId).toBe(20);
    expect(d.propertyAddress).toBe("12 Elm Ave, Montclair, NJ 07042");
  });

  it("leaves propertyId undefined and address blank when the customer has no properties", () => {
    const d = customerAppointmentDefaults(customer, []);
    expect(d.propertyId).toBeUndefined();
    expect(d.propertyAddress).toBe("");
  });

  it("coerces null contact fields to empty strings", () => {
    const d = customerAppointmentDefaults({ id: 3, displayName: "No Contact", phone: null, email: null, type: "commercial" }, []);
    expect(d.phone).toBe("");
    expect(d.email).toBe("");
    expect(d.propertyType).toBe("commercial");
  });
});

describe("leadAppointmentDefaults", () => {
  it("uses the lead's requested service as the job description", () => {
    const d = leadAppointmentDefaults({
      fullName: "Hector M.",
      phone: "973-555-0000",
      email: "hector@example.com",
      requestedService: "Mini-split install quote",
      customerId: null,
    });
    expect(d.issueDescription).toBe("Mini-split install quote");
    expect(d.fullName).toBe("Hector M.");
    expect(d.phone).toBe("973-555-0000");
    expect(d.email).toBe("hector@example.com");
  });

  it("passes customerId when the lead is already converted", () => {
    const d = leadAppointmentDefaults({ fullName: "X", requestedService: "Service call", customerId: 42 });
    expect(d.customerId).toBe(42);
  });

  it("omits customerId for an unconverted lead so the server keeps phone/email auto-linking", () => {
    expect(leadAppointmentDefaults({ fullName: "X", requestedService: "Service call", customerId: null }).customerId).toBeUndefined();
    expect(leadAppointmentDefaults({ fullName: "X", requestedService: "Service call" }).customerId).toBeUndefined();
  });

  it("coerces missing phone/email to empty strings", () => {
    const d = leadAppointmentDefaults({ fullName: "X", requestedService: "S" });
    expect(d.phone).toBe("");
    expect(d.email).toBe("");
  });
});
