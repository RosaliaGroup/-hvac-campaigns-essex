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

  it("never overwrites explicitly-entered contact values (name/phone/email)", () => {
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, fullName: "Different Name", phone: "973-000-0000", email: "other@x.com" },
      { customer, property },
    );
    expect(out.fullName).toBe("Different Name");
    expect(out.phone).toBe("973-000-0000");
    expect(out.email).toBe("other@x.com");
  });

  it("property address is AUTHORITATIVE — typed partial text is IGNORED when a property is linked", () => {
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, propertyAddress: "61 1/2 Merchant St" }, // partial typed
      { customer, property },
    );
    expect(out.propertyAddress).toBe("500 Main St, Suite 200, Newark, NJ 07102"); // from the property, not typed
  });

  it("a linked property with a Unit includes the unit in the resolved address", () => {
    const out = normalizeAppointmentFields({ customerId: 7, propertyId: 20 }, { customer, property });
    expect(out.propertyAddress).toBe("500 Main St, Suite 200, Newark, NJ 07102");
  });

  it("a manual appointment WITHOUT a property keeps the typed address", () => {
    const out = normalizeAppointmentFields(
      { fullName: "New Person", phone: "551-555-1234", propertyAddress: "1 New Rd, Newark, NJ 07105" },
      {},
    );
    expect(out.propertyId).toBeNull();
    expect(out.propertyAddress).toBe("1 New Rd, Newark, NJ 07105");
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

  it("update-merge: preserves existing CONTACT fields but takes the property's authoritative address", () => {
    // Simulates the router merge (patch.X ?? existing.X): only propertyId changes.
    // fullName/phone/email come from the existing row and must be preserved, while the
    // service address is always the linked property's (never a stale/typed value).
    const out = normalizeAppointmentFields(
      { customerId: 7, propertyId: 20, fullName: "Existing Name", phone: "862-555-0100", email: "existing@x.com", propertyAddress: "Existing addr" },
      { customer, property },
    );
    expect(out.customerId).toBe(7);
    expect(out.propertyId).toBe(20);
    expect(out.fullName).toBe("Existing Name");
    expect(out.phone).toBe("862-555-0100");
    expect(out.email).toBe("existing@x.com");
    expect(out.propertyAddress).toBe("500 Main St, Suite 200, Newark, NJ 07102"); // authoritative property address
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
