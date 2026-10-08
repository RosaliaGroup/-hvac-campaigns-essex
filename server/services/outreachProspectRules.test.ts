import { describe, expect, it } from "vitest";
import {
  categorizeProspect, isDirectBusinessEmail, isExcludedProspect,
  isVerifiedProspect, normalizeProspectEmail,
} from "./outreachProspectRules";

describe("HVAC prospect qualification", () => {
  it("normalizes email and rejects malformed addresses", () => {
    expect(normalizeProspectEmail("  Ana@Example.COM ")).toBe("ana@example.com");
    expect(normalizeProspectEmail("not-an-email")).toBeNull();
  });
  it("excludes generic and automated mailboxes", () => {
    for (const address of ["info@example.com", "no-reply@example.com", "leasing@example.com", "postmaster@example.com"]) {
      expect(isDirectBusinessEmail(address)).toBe(false);
    }
    expect(isDirectBusinessEmail("jane.doe@example.com")).toBe(true);
  });
  it("excludes blocked names and companies", () => {
    expect(isExcludedProspect({ name: "Gabriel Lopez", company: "ABC", email: "gabriel@abc.com" })).toBe(true);
    expect(isExcludedProspect({ name: "Jane Doe", company: "Giga Holdings", email: "jane@giga.com" })).toBe(true);
  });
  it("requires named verified business contacts with public evidence", () => {
    const candidate = { name: "Jane Doe", title: "Property Manager", company: "North NJ Properties", email: "jane@northnj.com", verificationUrl: "https://northnj.com/team" };
    expect(isVerifiedProspect(candidate)).toBe(true);
    expect(isVerifiedProspect({ ...candidate, verificationUrl: "" })).toBe(false);
    expect(isVerifiedProspect({ ...candidate, title: "" })).toBe(false);
  });
  it("categorizes contacts from their actual roles", () => {
    expect(categorizeProspect("HOA Community Manager")).toBe("HOA/Community Manager");
    expect(categorizeProspect("Chief Building Engineer")).toBe("Facilities/Engineering");
    expect(categorizeProspect("Property Manager")).toBe("Property Manager");
    expect(categorizeProspect("Commercial Broker")).toBe("Broker/Agent");
    expect(categorizeProspect("Development Director")).toBe("Developer");
  });
});
