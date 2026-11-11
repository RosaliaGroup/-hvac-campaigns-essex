import { describe, expect, it } from "vitest";
import { isRealCustomer } from "./outreachProspectRules";

describe("isRealCustomer", () => {
  it("a Contacts row created by outreach is a prospect, not a customer", () => {
    for (const s of ["HVAC Prospecting Task", "Gmail Selected", "Gmail Sent", "CRM Manual"]) expect(isRealCustomer(s, false)).toBe(false);
  });
  it("an outreach-created contact with a job is a customer", () => {
    expect(isRealCustomer("HVAC Prospecting Task", true)).toBe(true);
  });
  it("contacts from QuickBooks, jobs, leads or staff entry are customers", () => {
    for (const s of ["quickbooks", "office", "field", "website", null]) expect(isRealCustomer(s, false)).toBe(true);
  });
});
