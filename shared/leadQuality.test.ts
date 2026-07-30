import { describe, it, expect } from "vitest";
import { isLeadPushable, phoneDigits } from "./leadQuality";

describe("isLeadPushable — shared live+backfill quality gate", () => {
  it("passes a real consumer lead with a name and a working phone or email", () => {
    expect(isLeadPushable({ name: "Avagay Burnett", phone: "908-875-2017", email: "avagay.burnett@gmail.com" })).toEqual({ pushable: true });
    expect(isLeadPushable({ name: "Karen Albers", phone: "9082859802", email: "Kario11@verizon.net" })).toEqual({ pushable: true });
    expect(isLeadPushable({ firstName: "Zaria", lastName: "Duncan", phone: "9296398919" }).pushable).toBe(true);
    expect(isLeadPushable({ name: "Jane Doe", email: "jane@gmail.com" }).pushable).toBe(true);
  });

  it("requires a real name", () => {
    expect(isLeadPushable({ name: "(no name)", email: "jrchin2010@gmail.com" })).toMatchObject({ pushable: false, rule: "no_name" });
    expect(isLeadPushable({ name: "", phone: "9085551212" }).rule).toBe("no_name"); // (also a 555 test number)
    expect(isLeadPushable({ name: "N/A", email: "x@gmail.com" }).rule).toBe("no_name");
  });

  it("requires at least one working contact", () => {
    expect(isLeadPushable({ name: "Real Person" })).toMatchObject({ pushable: false, rule: "no_contact" });
    expect(isLeadPushable({ name: "Real Person", phone: "123" }).rule).toBe("no_contact"); // too short
  });

  it("skips test/placeholder emails and phones, but not when the OTHER field is usable", () => {
    expect(isLeadPushable({ name: "GA Rollout", phone: "8625550100", email: "ga4-rollout-test@example.com" })).toMatchObject({ pushable: false });
    expect(isLeadPushable({ name: "Test Domain", email: "someone@example.com" }).rule).toBe("test_email");
    expect(isLeadPushable({ name: "Fake Phone", phone: "862-555-0100" }).rule).toBe("test_phone"); // 555 exchange, no email
    // A junk phone does NOT reject a lead that has a usable email.
    expect(isLeadPushable({ name: "Good Email", phone: "862-555-0100", email: "real@gmail.com" })).toEqual({ pushable: true });
  });

  it("skips our own internal domain", () => {
    expect(isLeadPushable({ name: "Staff Member", email: "someone@mechanicalenterprise.com" })).toMatchObject({ pushable: false, rule: "own_domain" });
  });

  it("flags (does not push) B2B role inboxes and competitor/HVAC domains, even with a phone", () => {
    expect(isLeadPushable({ name: "Justin Hawk", phone: "6469304111", email: "estimator.justinhawk@gmail.com" })).toMatchObject({ pushable: false, rule: "b2b_role_email" });
    expect(isLeadPushable({ name: "Andrew Veigel", phone: "4062994196", email: "andrew@allstar-estimation.com" })).toMatchObject({ pushable: false, rule: "b2b_competitor_domain" });
    expect(isLeadPushable({ name: "Ana Haynes", email: "ana@daphvacservicesolutions.com" })).toMatchObject({ pushable: false, rule: "b2b_competitor_domain" });
    expect(isLeadPushable({ name: "Sales Team", email: "sales@somebiz.com" }).rule).toBe("b2b_role_email");
  });

  it("does not mistake a normal name containing a role word for a role inbox", () => {
    // "salesman" starts with "sales" but isn't the role token → still pushable.
    expect(isLeadPushable({ name: "Bob Smith", email: "salesman.bob@gmail.com" }).pushable).toBe(true);
  });

  it("phoneDigits strips a leading US country code", () => {
    expect(phoneDigits("+1 (908) 285-9802")).toBe("9082859802");
    expect(phoneDigits("9082859802")).toBe("9082859802");
  });
});
