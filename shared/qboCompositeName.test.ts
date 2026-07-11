import { describe, it, expect } from "vitest";
import { parseQboCompositeName, classifyCustomerSegment } from "./qboCompositeName";

describe("parseQboCompositeName — real production composites", () => {
  it("Marco Weber: project + person + address + basement location, trailing empty", () => {
    const p = parseQboCompositeName("PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).toBe("high");
    expect(p.projectReference).toBe("PN-173-B");
    expect(p.customerKind).toBe("person");
    expect(p.customerDisplayName).toBe("Marco Weber");
    expect(p.firstName).toBe("Marco");
    expect(p.lastName).toBe("Weber");
    expect(p.serviceAddressLine1).toBe("9005 Smith Ave");
    expect(p.serviceCity).toBe("North Bergen");
    expect(p.serviceState).toBe("NJ");
    expect(p.servicePostalCode).toBe("07047");
    expect(p.locationNotes).toBe("Basement");
    expect(p.reasonCodes).toContain("TRAILING_EMPTY_SEGMENT");
    // project code must never leak into the name
    expect(p.customerDisplayName).not.toMatch(/PN-173/);
    expect(p.firstName).not.toMatch(/PN/);
  });

  it("Cushman & Wakefield: company (&) + leading floor pulled into location", () => {
    const p = parseQboCompositeName("PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).toBe("high");
    expect(p.customerKind).toBe("company");
    expect(p.companyName).toBe("Cushman & Wakefield");
    expect(p.customerDisplayName).toBe("Cushman & Wakefield");
    expect(p.firstName).toBeNull();
    expect(p.lastName).toBeNull();
    expect(p.serviceAddressLine1).toBe("444 Madison Avenue");
    expect(p.serviceCity).toBe("New York");
    expect(p.serviceState).toBe("NY");
    expect(p.servicePostalCode).toBe("10022");
    expect(p.locationNotes).toBe("28th Floor");
    expect(p.reasonCodes).toContain("LOCATION_IN_ADDRESS");
  });

  it("Helen Espiallat: person + address without zip", () => {
    const p = parseQboCompositeName("PN#171 I Helen Espiallat I 1600 Center Ave, Fort Lee, NJ");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).toBe("high");
    expect(p.customerDisplayName).toBe("Helen Espiallat");
    expect(p.firstName).toBe("Helen");
    expect(p.lastName).toBe("Espiallat");
    expect(p.serviceAddressLine1).toBe("1600 Center Ave");
    expect(p.serviceState).toBe("NJ");
    expect(p.servicePostalCode).toBeNull();
  });

  it("Anthony Paladino: person + address", () => {
    const p = parseQboCompositeName("PN#167 I Anthony Paladino I 689 Elm St, Maywood, NJ");
    expect(p.isComposite).toBe(true);
    expect(p.customerDisplayName).toBe("Anthony Paladino");
    expect(p.firstName).toBe("Anthony");
    expect(p.lastName).toBe("Paladino");
    expect(p.serviceAddressLine1).toBe("689 Elm St");
    expect(p.serviceState).toBe("NJ");
  });

  it("project code removed from name AND preserved as projectReference", () => {
    const p = parseQboCompositeName("PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666");
    expect(p.customerDisplayName).toBe("Cynthia Rodriguez");
    expect(p.projectReference).toBe("PN#165");
    expect(p.projectNumber).toBe("165");
  });

  it("all-caps person name with middle initial (Natanya L Phipps)", () => {
    const p = parseQboCompositeName("PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON");
    expect(p.isComposite).toBe(true);
    expect(p.customerKind).toBe("person");
    expect(p.firstName).toBe("NATANYA L");
    expect(p.lastName).toBe("PHIPPS");
    expect(p.serviceAddressLine1).toMatch(/^351 CENTRAL AVE/);
  });
});

describe("location detail parsing", () => {
  const loc = (addr: string) => parseQboCompositeName(`PN#1 I John Smith I ${addr}`);
  it("basement → location notes", () => expect(loc("10 Main St, Newark, NJ I Basement").locationNotes).toBe("Basement"));
  it("floor → location notes", () => expect(loc("10 Main St I 3rd Floor").locationNotes).toBe("3rd Floor"));
  it("rooftop → location notes", () => expect(loc("10 Main St I Rooftop Unit").locationNotes).toContain("Rooftop"));
  it("mechanical room → location notes", () => expect(loc("10 Main St I Mechanical Room").locationNotes).toContain("Mechanical Room"));
  it("rear → location notes", () => expect(loc("10 Main St I Rear").locationNotes).toBe("Rear"));
  it("suite kept as address line 2 when a formal unit", () => {
    const p = parseQboCompositeName("PN#1 I John Smith I 10 Main St, Suite 200, Newark, NJ");
    // suite appears in the address; it must not land in the customer name
    expect(p.customerDisplayName).toBe("John Smith");
    expect(`${p.serviceAddressLine1} ${p.serviceAddressLine2 ?? ""} ${p.locationNotes ?? ""}`).toMatch(/Suite 200/i);
  });
});

describe("legitimate names are NOT treated as composite", () => {
  const cases = [
    "55 WEST 21 STREET LLC",                 // numbered company
    "Eurostar Hotel Wall Street",            // company with address-like words
    "Atlantic Construction Services INC",    // company
    "Riflessi Luxury Italian Menswear",      // company
    "Moinian",                               // single-word company
    "Alex Brody",                            // plain person
    "Smith & Sons: Plumbing",                // colon + ampersand company
    "Jean-Pierre Dubois",                    // hyphenated person
    "3M Company",                            // numbered company
    "A-1 Heating & Cooling",                 // hyphen + numbered + ampersand company
  ];
  for (const c of cases) {
    it(`"${c}" → not composite`, () => {
      const p = parseQboCompositeName(c);
      expect(p.isComposite).toBe(false);
      expect(p.confidence).toBe("low");
    });
  }
});

describe("skip / ambiguity / safety", () => {
  it("malformed composite (only 2 segments) is skipped", () => {
    expect(parseQboCompositeName("PN#132 I PDC").isComposite).toBe(false);
  });

  it("ambiguous acronym customer (PDC) is composite but medium confidence → not auto-repairable", () => {
    const p = parseQboCompositeName("PN#132 I PDC I 828 Summer Ave Newark NJ");
    expect(p.isComposite).toBe(true);
    expect(p.confidence).toBe("medium");
    expect(p.customerKind).toBe("unknown");
    expect(p.reasonCodes).toContain("CUSTOMER_AMBIGUOUS_ACRONYM");
  });

  it("string that has ' I ' but no project code is not composite", () => {
    expect(parseQboCompositeName("Acme I Beta I Gamma").isComposite).toBe(false);
  });

  it("missing address does not crash (2-part after project fails gate anyway)", () => {
    expect(() => parseQboCompositeName("PN#1 I John Smith I ")).not.toThrow();
  });

  it("null / empty input handled safely", () => {
    expect(parseQboCompositeName(null).isComposite).toBe(false);
    expect(parseQboCompositeName(undefined).isComposite).toBe(false);
    expect(parseQboCompositeName("").isComposite).toBe(false);
  });

  it("is deterministic — repeated parses are identical", () => {
    const s = "PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I";
    expect(parseQboCompositeName(s)).toEqual(parseQboCompositeName(s));
  });
});

describe("classifyCustomerSegment", () => {
  it("person for First Last", () => expect(classifyCustomerSegment("Marco Weber").kind).toBe("person"));
  it("company for ampersand", () => expect(classifyCustomerSegment("Cushman & Wakefield").kind).toBe("company"));
  it("company for suffix", () => expect(classifyCustomerSegment("Avant Developers").kind).toBe("company"));
  it("unknown for acronym", () => expect(classifyCustomerSegment("PDC").kind).toBe("unknown"));
});
