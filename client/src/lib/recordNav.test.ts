import { describe, it, expect } from "vitest";
import { recordNavPath } from "./recordNav";

describe("recordNavPath — canonical record navigation", () => {
  it("1. appointment/customer name with customerId opens the canonical Customer", () => {
    expect(recordNavPath({ customerId: 28 })).toBe("/customers/28");
  });
  it("2. lead-only record (no customerId) opens the Lead detail", () => {
    expect(recordNavPath({ leadId: 5 })).toBe("/leads?leadId=5");
  });
  it("3. linked lead (has customerId) opens the Customer, not the lead", () => {
    expect(recordNavPath({ customerId: 28, leadId: 5 })).toBe("/customers/28");
  });
  it("no stable id → null (render plain text; never navigate by phone/email)", () => {
    expect(recordNavPath({})).toBe(null);
    expect(recordNavPath({ customerId: null, leadId: null })).toBe(null);
    expect(recordNavPath({ customerId: 0 })).toBe(null);
  });
});
