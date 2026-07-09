import { describe, expect, it } from "vitest";
import { appointmentMatchesLead, buildDisplayName, normalizePhone, splitName } from "./routers/customers";

describe("customers helpers — normalizePhone", () => {
  it("strips formatting and keeps last 10 digits", () => {
    expect(normalizePhone("(862) 419-1763")).toBe("8624191763");
    expect(normalizePhone("+1 862-419-1763")).toBe("8624191763");
    expect(normalizePhone("18624191763")).toBe("8624191763");
  });
  it("matches the same number written differently", () => {
    expect(normalizePhone("862.419.1763")).toBe(normalizePhone("+1 (862) 419 1763"));
  });
  it("rejects empty/too-short values", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("911")).toBeNull();
  });
});

describe("customers helpers — splitName", () => {
  it("splits first/last", () => {
    expect(splitName("Ana Haynes")).toEqual({ firstName: "Ana", lastName: "Haynes" });
  });
  it("keeps middle names in firstName", () => {
    expect(splitName("Mary Ann Smith")).toEqual({ firstName: "Mary Ann", lastName: "Smith" });
  });
  it("handles single names and blanks", () => {
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: null });
    expect(splitName("   ")).toEqual({ firstName: null, lastName: null });
    expect(splitName(null)).toEqual({ firstName: null, lastName: null });
  });
});

describe("customers helpers — buildDisplayName", () => {
  it("prefers company name", () => {
    expect(buildDisplayName({ companyName: "Acme HVAC", firstName: "Ana", lastName: "H" })).toBe("Acme HVAC");
  });
  it("falls back to First Last", () => {
    expect(buildDisplayName({ firstName: "Ana", lastName: "Haynes" })).toBe("Ana Haynes");
  });
  it("falls back to email, then phone, then placeholder", () => {
    expect(buildDisplayName({ email: "a@b.com" })).toBe("a@b.com");
    expect(buildDisplayName({ phone: "8624191763" })).toBe("8624191763");
    expect(buildDisplayName({})).toBe("Unnamed Customer");
  });
});

describe("customers helpers — appointmentMatchesLead (appointment appears under lead/contact)", () => {
  const lead = { customerId: 5, phone: "(862) 419-1763", email: "Hector@Example.com" };

  it("matches on the same customerId", () => {
    expect(appointmentMatchesLead({ customerId: 5, phone: null, email: null }, lead)).toBe(true);
  });
  it("matches on phone even when written differently and not yet linked", () => {
    expect(appointmentMatchesLead({ customerId: null, phone: "+1 862-419-1763", email: null }, lead)).toBe(true);
  });
  it("matches on email case-insensitively", () => {
    expect(appointmentMatchesLead({ customerId: null, phone: null, email: "hector@example.com" }, lead)).toBe(true);
  });
  it("does not match an unrelated appointment", () => {
    expect(appointmentMatchesLead({ customerId: 9, phone: "973-000-0000", email: "someone@else.com" }, lead)).toBe(false);
  });
  it("does not cross-link two different people who both lack contact keys", () => {
    expect(appointmentMatchesLead({ customerId: null, phone: null, email: null }, { customerId: null, phone: null, email: null })).toBe(false);
  });
});
