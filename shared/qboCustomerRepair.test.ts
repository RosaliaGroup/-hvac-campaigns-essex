import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  normalizeAddressKey,
  proposeMerge,
  proposePropertyAction,
  type CustomerIdentity,
  type PropertyRow,
} from "./qboCustomerRepair";

const base = (o: Partial<CustomerIdentity> & { id: number }): CustomerIdentity => ({
  quickbooksCustomerId: null, email: null, phone: null, altPhone: null, displayName: null, companyName: null, ...o,
});

describe("normalization", () => {
  it("email lowercased/trimmed", () => expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com"));
  it("phone → last 10 digits", () => expect(normalizePhone("(973) 919-8745")).toBe("9739198745"));
  it("phone null when <10 digits", () => expect(normalizePhone("12345")).toBeNull());
  it("address key normalizes", () =>
    expect(normalizeAddressKey({ line1: "9005 Smith Ave.", city: "North Bergen", zip: "07047-1234" })).toBe("9005 smith ave|north bergen|07047"));
});

describe("proposeMerge — safe only on strong identifier, never name-only", () => {
  it("same QBO id → merge", () => {
    const d = proposeMerge(base({ id: 1, quickbooksCustomerId: "X" }), base({ id: 2, quickbooksCustomerId: "X" }));
    expect(d).toMatchObject({ merge: true, matchedBy: "qbo_id" });
  });
  it("exact email, no conflicts → merge", () => {
    const d = proposeMerge(base({ id: 1, email: "a@b.com" }), base({ id: 2, email: "A@B.com" }));
    expect(d).toMatchObject({ merge: true, matchedBy: "email" });
  });
  it("exact phone, no conflicts → merge", () => {
    const d = proposeMerge(base({ id: 1, phone: "973-919-8745" }), base({ id: 2, phone: "(973) 919 8745" }));
    expect(d).toMatchObject({ merge: true, matchedBy: "phone" });
  });
  it("name-only match → NO merge", () => {
    const d = proposeMerge(base({ id: 1, displayName: "John Smith" }), base({ id: 2, displayName: "John Smith" }));
    expect(d.merge).toBe(false);
  });
  it("conflicting QBO ids → NO merge", () => {
    const d = proposeMerge(base({ id: 1, quickbooksCustomerId: "X", email: "a@b.com" }), base({ id: 2, quickbooksCustomerId: "Y", email: "a@b.com" }));
    expect(d.merge).toBe(false);
    expect((d as { conflicts: string[] }).conflicts.join()).toMatch(/qbo_id/);
  });
  it("email matches but phone conflicts → NO merge", () => {
    const d = proposeMerge(base({ id: 1, email: "a@b.com", phone: "9999999999" }), base({ id: 2, email: "a@b.com", phone: "1111111111" }));
    expect(d.merge).toBe(false);
    expect((d as { conflicts: string[] }).conflicts.join()).toMatch(/phone/);
  });
});

describe("proposePropertyAction — never duplicate, never cross-customer reuse", () => {
  const props: PropertyRow[] = [
    { id: 10, customerId: 1, addressLine1: "9005 Smith Ave", city: "North Bergen", zip: "07047" },
    { id: 11, customerId: 2, addressLine1: "1 Other Rd", city: "Newark", zip: "07103" },
  ];
  it("existing normalized property → no duplicate proposed", () => {
    const d = proposePropertyAction(1, { line1: "9005 Smith Ave.", city: "North Bergen", state: "NJ", zip: "07047" }, props);
    expect(d).toMatchObject({ action: "existing", propertyId: 10 });
  });
  it("property belonging to another customer is not reused", () => {
    const d = proposePropertyAction(3, { line1: "1 Other Rd", city: "Newark", state: "NJ", zip: "07103" }, props);
    expect(d.action).toBe("create");
  });
  it("new customer + new address → create", () => {
    const d = proposePropertyAction(5, { line1: "500 New St", city: "Teaneck", state: "NJ", zip: "07666" }, props);
    expect(d.action).toBe("create");
  });
  it("same customer with a different existing property → conflict (review, not silent add)", () => {
    const d = proposePropertyAction(1, { line1: "77 Different Ave", city: "Newark", state: "NJ", zip: "07103" }, props);
    expect(d.action).toBe("conflict");
  });
  it("no parsed address → none", () => {
    expect(proposePropertyAction(1, { line1: null, city: null, state: null, zip: null }, props).action).toBe("none");
  });
});
