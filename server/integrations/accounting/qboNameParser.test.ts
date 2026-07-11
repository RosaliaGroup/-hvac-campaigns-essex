import { describe, it, expect } from "vitest";
import { parseQboDisplayName, isProjectSegment, looksLikeAddress, parseAddressSegment, looksLikeCompanyName } from "./qboNameParser";

describe("parseQboDisplayName — composite PN names", () => {
  it("splits PN-173-B | Marco Weber | address | Basement I", () => {
    const p = parseQboDisplayName("PN-173-B | Marco Weber | 9005 Smith Ave, North Bergen, NJ 07047 | Basement I");
    expect(p.isComposite).toBe(true);
    expect(p.projectReference).toBe("PN-173-B");
    expect(p.customerName).toBe("Marco Weber");
    expect(p.serviceAddress).toMatchObject({ line1: "9005 Smith Ave", city: "North Bergen", state: "NJ", zip: "07047" });
    expect(p.locationNotes).toBe("Basement I");
    expect(p.raw).toBe("PN-173-B | Marco Weber | 9005 Smith Ave, North Bergen, NJ 07047 | Basement I");
  });

  it("splits PN#172 | Cushman & Wakefield | 28th Floor 444 Madison Avenue, New York, NY 10022", () => {
    const p = parseQboDisplayName("PN#172 | Cushman & Wakefield | 28th Floor 444 Madison Avenue, New York, NY 10022");
    expect(p.isComposite).toBe(true);
    expect(p.projectReference).toBe("PN#172");
    expect(p.customerName).toBe("Cushman & Wakefield");
    // The floor is pulled out of the address and surfaced as a location note.
    expect(p.serviceAddress).toMatchObject({ line1: "444 Madison Avenue", city: "New York", state: "NY", zip: "10022" });
    expect(p.serviceAddress?.line2).toBeNull();
    expect(p.locationNotes).toBe("28th Floor");
  });

  it("splits PN#171 | Helen Espiallat | 1600 Center Ave, Fort Lee, NJ (no zip, no note)", () => {
    const p = parseQboDisplayName("PN#171 | Helen Espiallat | 1600 Center Ave, Fort Lee, NJ");
    expect(p.isComposite).toBe(true);
    expect(p.projectReference).toBe("PN#171");
    expect(p.customerName).toBe("Helen Espiallat");
    expect(p.serviceAddress).toMatchObject({ line1: "1600 Center Ave", city: "Fort Lee", state: "NJ", zip: null });
    expect(p.locationNotes).toBeNull();
  });

  it("splits an Anthony Paladino composite (PN 170 space form, Suite note)", () => {
    const p = parseQboDisplayName("PN 170 | Anthony Paladino | 12 Oak St, Ridgefield, NJ 07657 | Suite 200");
    expect(p.isComposite).toBe(true);
    expect(p.projectReference).toBe("PN 170");
    expect(p.customerName).toBe("Anthony Paladino");
    expect(p.serviceAddress).toMatchObject({ line1: "12 Oak St", city: "Ridgefield", state: "NJ", zip: "07657" });
    expect(p.locationNotes).toBe("Suite 200");
  });

  it("recognizes Project/Job/WO prefix variants", () => {
    expect(parseQboDisplayName("Project 88 | Jane Doe | 1 A St, Newark, NJ 07102").projectReference).toBe("Project 88");
    expect(parseQboDisplayName("Job #5 | Jane Doe | 1 A St, Newark, NJ 07102").projectReference).toBe("Job #5");
    expect(parseQboDisplayName("WO-100 | Jane Doe | 1 A St, Newark, NJ 07102").projectReference).toBe("WO-100");
  });
});

describe("parseQboDisplayName — conservative non-composite handling", () => {
  it("leaves a normal customer name with no PN prefix untouched", () => {
    const p = parseQboDisplayName("Marco Weber");
    expect(p.isComposite).toBe(false);
    expect(p.customerName).toBe("Marco Weber");
    expect(p.projectReference).toBeNull();
    expect(p.serviceAddress).toBeNull();
  });

  it("does not treat a legitimate company containing 'PN' letters as a project", () => {
    for (const name of ["PNC Bank", "Painters Plus Inc", "PN Solutions LLC"]) {
      const p = parseQboDisplayName(name);
      expect(p.isComposite).toBe(false);
      expect(p.customerName).toBe(name);
    }
  });

  it("does not treat a company name that merely contains a pipe as composite", () => {
    const p = parseQboDisplayName("Smith | Sons Plumbing & Heating");
    expect(p.isComposite).toBe(false);
    // First segment is not a project code, so we keep the whole raw name.
    expect(p.customerName).toBe("Smith | Sons Plumbing & Heating");
    expect(p.projectReference).toBeNull();
  });

  it("treats a pipe value with no customer segment as non-composite", () => {
    expect(parseQboDisplayName("PN-173-B | ").isComposite).toBe(false);
  });

  it("treats a project-only space name as a LOW-confidence composite (manual review, no rename)", () => {
    const p = parseQboDisplayName("PN-173-B");
    expect(p.isComposite).toBe(true); // structurally a project composite …
    expect(p.confidence).toBe("low"); // … but not safe to auto-repair
    expect(p.customerName).toBe(""); // never propose the PN code as a name
    expect(p.format).toBe("space");
  });

  it("handles empty / whitespace input", () => {
    const p = parseQboDisplayName("   ");
    expect(p.isComposite).toBe(false);
    expect(p.customerName).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Required fixtures for the space-delimited production format. All names and
// addresses below are FABRICATED (no real PII) but mirror the 9 confirmed
// production structures.
// ─────────────────────────────────────────────────────────────────────────────
describe("space-delimited composites (production format)", () => {
  it("#1 regression: pipe-delimited composite still parses (high, format=pipe)", () => {
    const p = parseQboDisplayName("PN-173-B | Jordan Fielder | 4200 Example Ave, Springfield, NJ 07081 | Basement II");
    expect(p).toMatchObject({ isComposite: true, format: "pipe", confidence: "high", projectReference: "PN-173-B", customerName: "Jordan Fielder", locationNotes: "Basement II" });
    expect(p.serviceAddress).toMatchObject({ line1: "4200 Example Ave", city: "Springfield", state: "NJ", zip: "07081" });
  });

  it("#2 space: PN code + person name + address", () => {
    const p = parseQboDisplayName("PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081");
    expect(p).toMatchObject({ isComposite: true, format: "space", confidence: "high", projectReference: "PN#210", customerName: "Jordan Fielder", locationNotes: null });
    expect(p.serviceAddress).toMatchObject({ line1: "4200 Example Ave", city: "Springfield", state: "NJ", zip: "07081" });
  });

  it("#3 space: PN code + company containing '&' + address", () => {
    const p = parseQboDisplayName("PN#211 Northgate & Reed 500 Sample Blvd, Riverton, NJ 07020");
    expect(p).toMatchObject({ isComposite: true, confidence: "high", projectReference: "PN#211", customerName: "Northgate & Reed" });
    expect(p.serviceAddress).toMatchObject({ line1: "500 Sample Blvd", city: "Riverton", state: "NJ", zip: "07020" });
  });

  it("#4 multi-word person name", () => {
    const p = parseQboDisplayName("PN 213 Maria Del Carmen Ruiz 77 Placeholder St, Kearny, NJ 07032");
    expect(p.customerName).toBe("Maria Del Carmen Ruiz");
    expect(p.confidence).toBe("high");
  });

  it("#5 multi-word company name", () => {
    const p = parseQboDisplayName("PN#214 Summit Ridge Property Management 9 Mock Ave, Newark, NJ 07102 Suite 400");
    expect(p.customerName).toBe("Summit Ridge Property Management");
    expect(p.locationNotes).toBe("Suite 400");
    expect(p.confidence).toBe("high");
  });

  it("#6 address with commas is preserved & parsed", () => {
    const p = parseQboDisplayName("PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081");
    expect(p.serviceAddressText).toBe("4200 Example Ave, Springfield, NJ 07081");
  });

  it("#7 basement descriptor BEFORE the street address", () => {
    const p = parseQboDisplayName("PN#222 Delta Group Basement 200 Mock St, Newark, NJ 07102");
    expect(p.customerName).toBe("Delta Group");
    expect(p.locationNotes).toMatch(/Basement/i);
    expect(p.serviceAddress).toMatchObject({ line1: "200 Mock St", city: "Newark", state: "NJ" });
  });

  it("#8 suite/floor AFTER the address", () => {
    const p = parseQboDisplayName("PN-212-A Dana Whitfield 88 Testbrook Rd, Fairview, NJ 07022 Suite 5");
    expect(p.customerName).toBe("Dana Whitfield");
    expect(p.locationNotes).toBe("Suite 5");
    expect(p.serviceAddress).toMatchObject({ line1: "88 Testbrook Rd", city: "Fairview", state: "NJ", zip: "07022" });
  });

  it("#9 floor BEFORE the address (leading unit)", () => {
    const p = parseQboDisplayName("PN#223 Cushing & Blythe 3rd Floor 44 Sample Ave, Newark, NJ 07102");
    expect(p.customerName).toBe("Cushing & Blythe");
    expect(p.locationNotes).toBe("3rd Floor");
    expect(p.serviceAddress).toMatchObject({ line1: "44 Sample Ave", city: "Newark" });
  });

  it("#10 project code with letters after the number (PN-212-A)", () => {
    expect(parseQboDisplayName("PN-212-A Dana Whitfield 88 Testbrook Rd, Fairview, NJ 07022").projectReference).toBe("PN-212-A");
  });

  it("#11 customer/company name containing a number does NOT split on that number", () => {
    const p = parseQboDisplayName("PN-216 3rd Coast Mechanical 150 Sample St, Lodi, NJ 07644");
    expect(p.customerName).toBe("3rd Coast Mechanical");
    expect(p.serviceAddress).toMatchObject({ line1: "150 Sample St", city: "Lodi" });
  });

  it("#12 normal name without a leading PN reference → not composite", () => {
    expect(parseQboDisplayName("Jordan Fielder").isComposite).toBe(false);
  });

  it("#13 legitimate company containing 'PN' internally → not composite", () => {
    for (const n of ["PNC Bank", "PN Solutions LLC", "Painters Guild Inc"]) {
      expect(parseQboDisplayName(n).isComposite, n).toBe(false);
    }
  });

  it("#14 leading PN reference with NO detectable address → medium, manual-review", () => {
    const p = parseQboDisplayName("PN#218 Cornerstone Advisors");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).toBe("medium");
    expect(p.customerName).toBe("Cornerstone Advisors");
    expect(p.serviceAddress).toBeNull();
  });

  it("#15 ambiguous customer/address boundary → NOT high (manual review)", () => {
    const p = parseQboDisplayName("PN#224 Meadowlands 12 Units");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).not.toBe("high");
  });

  it("#16 project-only name → low confidence, no proposed name", () => {
    const p = parseQboDisplayName("PN-220-C");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).toBe("low");
    expect(p.customerName).toBe("");
  });

  it("no-address space composite is never 'high'", () => {
    expect(parseQboDisplayName("PN#215 Bayside Lighting Partners 300 Fake Turnpike").confidence).toBe("medium");
  });
});

describe("corrupted-pipe recovery (production 'I'-delimited format)", () => {
  it("recovers a standalone 'I' delimiter into a clean pipe composite", () => {
    const p = parseQboDisplayName("PN#301 I Jordan Fielder I 36 Sample Rd, Teaneck, NJ 07666");
    expect(p.isComposite).toBe(true);
    expect(p.format).toBe("pipe"); // routed through the pipe path after recovery
    expect(p.projectReference).toBe("PN#301");
    expect(p.customerName).toBe("Jordan Fielder"); // NOT "I Jordan Fielder I"
    expect(p.serviceAddress).toMatchObject({ line1: "36 Sample Rd", city: "Teaneck", state: "NJ", zip: "07666" });
    expect(p.confidence).toBe("high");
    // The raw audit string keeps the original corrupted form.
    expect(p.raw).toBe("PN#301 I Jordan Fielder I 36 Sample Rd, Teaneck, NJ 07666");
  });

  it("preserves a trailing roman-numeral 'I' as a note, not a delimiter", () => {
    const p = parseQboDisplayName("PN-302-B I Dana Whitfield I 9005 Sample Ave, North Bergen, NJ 07047 I Basement I");
    expect(p.customerName).toBe("Dana Whitfield");
    expect(p.locationNotes).toBe("Basement I");
    expect(p.serviceAddress).toMatchObject({ line1: "9005 Sample Ave", city: "North Bergen", state: "NJ", zip: "07047" });
  });

  it("recovers a company composite with '&'", () => {
    const p = parseQboDisplayName("PN#303 I Northgate & Reed I 28th Floor 444 Sample Avenue, New York, NY 10022");
    expect(p.customerName).toBe("Northgate & Reed");
    expect(p.locationNotes).toBe("28th Floor");
    expect(p.serviceAddress).toMatchObject({ line1: "444 Sample Avenue", city: "New York", state: "NY", zip: "10022" });
  });

  it("does NOT touch a plain name with a middle initial (no project prefix)", () => {
    expect(parseQboDisplayName("Jordan I Fielder").isComposite).toBe(false);
  });
});

describe("looksLikeCompanyName", () => {
  it("classifies '&' and recognized company suffixes as company", () => {
    for (const n of [
      "Cushman & Wakefield",
      "Summit HVAC LLC",
      "Northgate Inc.",
      "Riverton Corp.",
      "Bayside Corporation",
      "Delta Partners LP",
      "Meadow Builders LLP",
      "Harbor Freight Co.",
      "Cornerstone Company",
    ]) {
      expect(looksLikeCompanyName(n), n).toBe(true);
    }
  });

  it("does NOT classify ordinary person names as company", () => {
    for (const n of ["Marco Weber", "Helen Espiallat", "Anthony Paladino", "Maria Del Carmen Ruiz", "Jordan Fielder"]) {
      expect(looksLikeCompanyName(n), n).toBe(false);
    }
  });
});

describe("segment helpers", () => {
  it("isProjectSegment requires a code with digits, not just the letters PN", () => {
    expect(isProjectSegment("PN-173-B")).toBe(true);
    expect(isProjectSegment("PN#172")).toBe(true);
    expect(isProjectSegment("PN 173")).toBe(true);
    expect(isProjectSegment("Project 42")).toBe(true);
    expect(isProjectSegment("PNC Bank")).toBe(false);
    expect(isProjectSegment("PN Solutions")).toBe(false);
    expect(isProjectSegment("Marco Weber")).toBe(false);
  });

  it("looksLikeAddress recognizes street + city/state tails", () => {
    expect(looksLikeAddress("9005 Smith Ave, North Bergen, NJ 07047")).toBe(true);
    expect(looksLikeAddress("1600 Center Ave, Fort Lee, NJ")).toBe(true);
    expect(looksLikeAddress("Basement I")).toBe(false);
    expect(looksLikeAddress("Suite 200")).toBe(false);
  });

  it("parseAddressSegment tolerates a missing zip", () => {
    expect(parseAddressSegment("1600 Center Ave, Fort Lee, NJ")).toMatchObject({
      line1: "1600 Center Ave",
      city: "Fort Lee",
      state: "NJ",
      zip: null,
    });
  });
});
