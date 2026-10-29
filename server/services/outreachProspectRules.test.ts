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

import { isPublicBidEntity as isPublic } from "./outreachProspectRules";
describe("public bodies and schools (public bidding)", () => {
  it.each([
    ["jsmith@essexcountynj.gov", "Essex County"],
    ["jsmith@state.nj.us", "NJ Department of Treasury"],
    ["jsmith@westorange.k12.nj.us", "West Orange"],
    ["jsmith@montclair.edu", "Montclair State University"],
    ["jsmith@wops.org", "West Orange Public Schools"],
    ["jsmith@twp.example.org", "Township of Livingston"],
    ["jsmith@nhha.org", "Newark Housing Authority"],
    ["jsmith@school.org", "Seton Hall Preparatory School"],
    ["jsmith@ccm.org", "County College of Morris"],
  ])("%s / %s is excluded", (email, company) => {
    expect(isPublic({ email, company })).toBe(true);
  });
  it.each([
    ["jsmith@acmeproperties.com", "Acme Properties LLC"],
    ["ops@hiltonnewark.com", "Hilton Newark Penn Station"],
    ["fm@stbarnabas.org", "Saint Barnabas Medical Center"],
    ["jdoe@prologis.com", "Prologis"],
  ])("%s / %s is allowed", (email, company) => {
    expect(isPublic({ email, company })).toBe(false);
  });
});
