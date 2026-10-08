import { describe, it, expect } from "vitest";
import { contactClassification } from "./contactClassification";
describe("imported contact classification", () => {
  const imported = {
    source: "Gmail Sent",
    type: "residential",
    email: "person@example.com",
  };
  it("does not claim email recipients are residential leads", () => {
    expect(contactClassification(imported, "lead", false)).toEqual({
      lifecycle: "Contact",
      contactRole: "Unclassified",
      serviceType: "Unclassified",
    });
  });
  it("preserves sales activity and explicit conversion", () => {
    expect(contactClassification(imported, "customer", false).lifecycle).toBe(
      "Customer"
    );
    expect(contactClassification(imported, "prospect", false).lifecycle).toBe(
      "Prospect"
    );
    expect(contactClassification(imported, "lead", true).lifecycle).toBe(
      "Lead"
    );
    expect(
      contactClassification(
        { ...imported, convertedFromLeadId: 1 },
        "lead",
        false
      ).lifecycle
    ).toBe("Lead");
  });
  it("identifies internal imported contacts without reclassifying existing leads", () => {
    expect(
      contactClassification(
        { ...imported, email: "John@mechanicalenterprise.com" },
        "lead",
        false
      ).lifecycle
    ).toBe("Team");
    expect(
      contactClassification(
        { ...imported, source: "web", email: "John@mechanicalenterprise.com" },
        "lead",
        true
      ).lifecycle
    ).toBe("Lead");
  });
});
