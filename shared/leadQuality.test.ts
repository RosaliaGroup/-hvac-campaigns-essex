import { describe, it, expect } from "vitest";
import { isLeadPushable, isGibberishName, phoneDigits } from "./leadQuality";

// The exact 56 gibberish names the Aug 2026 bot flood pushed into live QuickBooks
// (customers.source='web:quick_quote', ids 50–112, later archived). Pulled from
// production; kept verbatim as a regression corpus — the detector must catch 100%.
const REAL_SPAM_NAMES = [
  "HdMJXLBFoDZkNKBDpCMUcg", "RzVBtSHAzOwBtCyIaRZOwPk", "vKUmXCOkOIISAmxqYHaCgNw",
  "OJStaEUbBltsoiDWlmC", "otKYnHOflDnGtchKbewkq", "NWcervafXNLlwQNWFNi",
  "uowbFQFPMcvoIpAK", "bWSOOBgoKuAiprXMZRJabn", "bdklrXKuZwnOsCGy",
  "fedNjZfxMWQdtRuIxW", "MRjTuWsCmBGWBrWKBZnKwZU", "XmGybldCtJYCpmvlpc",
  "LaqODSCNoLdaEHWzCndmiGXM", "WZVXjKzwoqawuWVgNOVWPA", "lMtQGEygjcpaidGaYDmxkl",
  "bjpOEsGqmucexPzp", "lWCfOfZhKeNpdqzdHh", "OCSFDxhWITXCXLdjBxn",
  "pBbQwhwAsrfHASycVAXywczB", "mcYaoGenNPIgKwcK", "rSxWLScnVqhifcckHsrfUJM",
  "XXgScQNqlcwsvgMFYUTIoo", "uVeLAjCYuuvQBxfzPJ", "HBbVRrbMRmTcTIKiCzlOIUF",
  "FttWxVPVxTrnHGZbNotCha", "oZlGnmrjEGWzEpwK", "RATrdOwqVehfoEBKGDtVo",
  "YGCDooyoAUMBOcVggE", "ogKzmkLctPovmHypBE", "pabBabntTpnVzPPh",
  "zYylPjfOvTCwlbqVLkFAFPr", "EbrPVIYdvOzJscCLPbPrfbd", "EHWyQCtDADkaZUhKqqMHaEH",
  "ZzwnESAZtTDWuahOxJNLeMWn", "nOxXRjEItEaCKkSZg", "qYTXtGgpNGLgKIuvoEnJv",
  "nCPRHQeuItpYGwZBCfUqRU", "vpfZqGZZckOkRzKmDtYaBQ", "XoMJFLWrCxOQtnsFdB",
  "idEZeBEPVjAYJltAuJIGqY", "KUplnwyKjBseKepo", "zgbTszVImBLLZjKFiPGrAWjM",
  "QCAtlVIHIaQqDJDB", "ubTLnzmqByhNRdWc", "IwtVgobFtlgHwkhpRowPDxu",
  "LmeeatgKYutymqJddvnELO", "iyApccxzDxMfijQPvpYTdotd", "ibYFgAHBhpvOQvsSfijXybXp",
  "SdwXnivyvepOnKZaWqua", "TUHqVSFfgaezICLDLRMRUU", "uGlSDyfYuYKWYvQy",
  "ILowUTuFpdlVDrJtX", "CLufDZJTAkSjuODblj", "GsJyrubVIrEdolkPRXB",
  "bxLnGVnsRzkHYYcwhbWmDOX", "UeguKHwXIHkLmRHyfhxjsL",
];

// Real names that MUST NOT be flagged — legit rows seen alongside the spam plus
// the edge cases called out in the task: hyphenated, apostrophe, short ethnic,
// and long-but-real single tokens.
const LEGIT_NAMES = [
  // Legit customers that arrived through the SAME quick_quote form during the flood:
  "Asad Khan", "Jason Morales", "Ahmed Kamel", "Emilee Burgman",
  "Brice Mcmillon", "Ade Ola", "Kelly Fitzpatrick",
  // Hyphenated / apostrophe:
  "Anne-Marie", "Jean-Baptiste", "Mary-Jane Watson", "O'Brien", "D'Angelo", "Sarah O'Connor",
  // Short ethnic names:
  "Ng", "Li", "Xu Wei", "An Nguyen", "Jo Kim", "Bo Li",
  // Long but real single tokens (near the length threshold):
  "Konstantinos", "Christopher", "Bartholomew", "Schlumberger", "Muhammad",
  // Longer real full names with a company:
  "United Builders Group LLC", "Jersey's Mike", "Alexandria Featherstone",
];

describe("isGibberishName — bot form-spam name detector", () => {
  it("flags every one of the 56 real production spam names (100% recall)", () => {
    const missed = REAL_SPAM_NAMES.filter((n) => !isGibberishName({ name: n }));
    expect(missed).toEqual([]);
  });

  it("does not flag any legit / edge-case name (no false positives)", () => {
    const falsePositives = LEGIT_NAMES.filter((n) => isGibberishName({ name: n }));
    expect(falsePositives).toEqual([]);
  });

  it("reads firstName/lastName the same way the gate does", () => {
    expect(isGibberishName({ firstName: "UeguKHwXIHkLmRHyfhxjsL", lastName: null })).toBe(true);
    expect(isGibberishName({ firstName: "Jason", lastName: "Morales" })).toBe(false);
  });

  it("ignores short tokens and empty input", () => {
    expect(isGibberishName({ name: "" })).toBe(false);
    expect(isGibberishName({ name: "aBcDeF" })).toBe(false); // case flips but too short to judge
  });
});

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

  it("rejects a gibberish name even with a real-looking phone and email", () => {
    // Bots supply plausible contacts, so the name alone must reject.
    const r = isLeadPushable({ name: "UeguKHwXIHkLmRHyfhxjsL", email: "tomharaske@aol.com", phone: "4724790281" });
    expect(r).toMatchObject({ pushable: false, rule: "gibberish_name" });
  });

  it("still passes the legit leads that came through the same spammed form", () => {
    expect(isLeadPushable({ name: "Asad Khan", email: "khanasad@gmail.com", phone: "8457461300" }).pushable).toBe(true);
    expect(isLeadPushable({ name: "Jason Morales", email: "jasonmorales6585@gmail.com", phone: "8625294086" }).pushable).toBe(true);
    expect(isLeadPushable({ firstName: "Brice", lastName: "Mcmillon", phone: "9739514052" }).pushable).toBe(true);
    expect(isLeadPushable({ firstName: "Ade", lastName: "Ola", phone: "8623380792" }).pushable).toBe(true);
  });

  it("phoneDigits strips a leading US country code", () => {
    expect(phoneDigits("+1 (908) 285-9802")).toBe("9082859802");
    expect(phoneDigits("9082859802")).toBe("9082859802");
  });
});
