import { describe, it, expect } from "vitest";
import { normalizeAppointmentFields, fillBlank } from "./appointmentNormalization";

const customer = { id: 7, displayName: "Jane Doe", phone: "862-555-0100", email: "jane@example.com", type: "residential" as const };
const property = { id: 20, customerId: 7, addressLine1: "500 Main St", addressLine2: "Suite 200", city: "Newark", state: "NJ", zip: "07102", propertyType: "residential" as const };

describe("fillBlank (backfill-only)", () => {
  it("keeps a non-empty user value", () => {
    expect(fillBlank("Typed Name", "Authoritative")).toBe("Typed Name");
    expect(fillBlank("  Trimmed  ", "X")).toBe("Trimmed");
  });
  it("uses authoritative when user value is blank", () => {
    expect(fillBlank("", "Authoritative")).toBe("Authoritative");
    expect(fillBlank(null, "Authoritative")).toBe("Authoritative");
    expect(fillBlank("   ", "Authoritative")).toBe("Authoritative");
  });
  it("returns undefined when both are blank", () => {
    expect(fillBlank(null, null)).toBeUndefined();
    expect(fillBlank("", "  ")).toBeUndefined();
  });
});

describe("normalizeAppointmentFields", () => {
  it("backfills name/phone/email/address + full location from linked customer+property", () => {
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, fullName: "", phone: "", email: null, propertyAddress: "" },
      { customer, property },
    );
    expect(out).toMatchObject({
      customerId: 7,
      propertyId: 20,
      fullName: "Jane Doe",
      phone: "862-555-0100",
      email: "jane@example.com",
      propertyAddress: "500 Main St, Suite 200, Newark, NJ 07102",
      propertyType: "residential",
    });
  });

  it("never overwrites explicitly-entered user values", () => {
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, fullName: "Different Name", phone: "973-000-0000", email: "other@x.com", propertyAddress: "Custom addr" },
      { customer, property },
    );
    expect(out.fullName).toBe("Different Name");
    expect(out.phone).toBe("973-000-0000");
    expect(out.email).toBe("other@x.com");
    expect(out.propertyAddress).toBe("Custom addr");
  });

  it("REJECTS a property that does not belong to the customer (CONFLICT)", () => {
    expect(() =>
      normalizeAppointmentFields({ customerId: 99, propertyId: 20 }, { customer: { ...customer, id: 99 }, property }),
    ).toThrow(/does not belong|belongs to customer/i);
  });

  it("derives customerId from the property when customerId is omitted", () => {
    const out = normalizeAppointmentFields({ propertyId: 20 }, { property });
    expect(out.customerId).toBe(7);
    expect(out.propertyId).toBe(20);
    expect(out.propertyAddress).toBe("500 Main St, Suite 200, Newark, NJ 07102");
  });

  it("leaves a typed address intact when no property is resolved", () => {
    const out = normalizeAppointmentFields({ customerId: 7, propertyAddress: "12 Elm Ave, Montclair NJ" }, { customer });
    expect(out.propertyAddress).toBe("12 Elm Ave, Montclair NJ");
    expect(out.propertyId).toBeNull();
    expect(out.fullName).toBe("Jane Doe");
  });

  it("update-merge: changing only propertyId preserves existing contact fields (omitted stay unchanged)", () => {
    // Simulates the router merge (patch.X ?? existing.X): only propertyId changes;
    // fullName/phone/email come from the existing row and must be preserved.
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, fullName: "Existing Name", phone: "862-555-0100", email: "existing@x.com", propertyAddress: "Existing addr" },
      { customer, property },
    );
    expect(out.customerId).toBe(7);
    expect(out.propertyId).toBe(20);
    expect(out.fullName).toBe("Existing Name");
    expect(out.phone).toBe("862-555-0100");
    expect(out.email).toBe("existing@x.com");
    expect(out.propertyAddress).toBe("Existing addr"); // typed/existing value not overwritten
  });

  it("update-merge: backfills location from newly linked property when address was blank", () => {
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, fullName: "Existing Name", phone: "862-555-0100", email: "existing@x.com", propertyAddress: "" },
      { customer, property },
    );
    expect(out.propertyAddress).toBe("500 Main St, Suite 200, Newark, NJ 07102");
  });

  it("passes through a manual (unlinked) contact untouched", () => {
    const out = normalizeAppointmentFields(
      { fullName: "New Person", phone: "551-555-1234", email: "new@x.com", propertyAddress: "1 New Rd" },
      {},
    );
    expect(out).toMatchObject({ customerId: null, propertyId: null, fullName: "New Person", phone: "551-555-1234", email: "new@x.com", propertyAddress: "1 New Rd" });
  });
});
