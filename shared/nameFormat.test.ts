import { describe, it, expect } from "vitest";
import {
  formatDisplayName,
  formatCompanyName,
  formatAddress,
  formatStateCode,
  formatAddressParts,
} from "./nameFormat";

describe("formatDisplayName — normalize uppercase, preserve intentional casing", () => {
  it("title-cases all-uppercase person names (spec examples)", () => {
    expect(formatDisplayName("ANA HAYNES")).toBe("Ana Haynes");
    expect(formatDisplayName("NATANYA L PHIPPS")).toBe("Natanya L Phipps");
    expect(formatDisplayName("ANIBAL ESPAILLA")).toBe("Anibal Espailla");
  });

  it("preserves words that already carry intentional mixed capitalization", () => {
    expect(formatDisplayName("McDonald")).toBe("McDonald");
    expect(formatDisplayName("O'Brien")).toBe("O'Brien");
    expect(formatDisplayName("LaSalle")).toBe("LaSalle");
    expect(formatDisplayName("iPhone Repair Co")).toBe("iPhone Repair Co");
  });

  it("preserves lowercase name particles (does not blindly re-capitalize)", () => {
    expect(formatDisplayName("de la Cruz")).toBe("de la Cruz");
    expect(formatDisplayName("van der Berg")).toBe("van der Berg");
  });

  it("normalizes entirely-lowercase names to Title Case", () => {
    expect(formatDisplayName("ana haynes")).toBe("Ana Haynes");
    expect(formatDisplayName("john smith")).toBe("John Smith");
    expect(formatDisplayName("mary o'brien")).toBe("Mary O'Brien");
    // particles stay lowercase even when the rest is lowercase
    expect(formatDisplayName("de la cruz")).toBe("de la Cruz");
    expect(formatDisplayName("juan del rio")).toBe("Juan del Rio");
  });

  it("normalizes all-caps words with internal apostrophes / hyphens", () => {
    expect(formatDisplayName("O'BRIEN")).toBe("O'Brien");
    expect(formatDisplayName("MARY-JANE WATSON")).toBe("Mary-Jane Watson");
    expect(formatDisplayName("D'ANGELO")).toBe("D'Angelo");
  });

  it("keeps single-letter middle initials", () => {
    expect(formatDisplayName("JOHN Q PUBLIC")).toBe("John Q Public");
  });

  it("normalizes accented all-caps names and preserves accented mixed-case", () => {
    expect(formatDisplayName("JOSÉ MARTÍNEZ")).toBe("José Martínez");
    expect(formatDisplayName("José Martínez")).toBe("José Martínez");
  });

  it("handles empty / null / whitespace safely", () => {
    expect(formatDisplayName(null)).toBe("");
    expect(formatDisplayName(undefined)).toBe("");
    expect(formatDisplayName("")).toBe("");
    expect(formatDisplayName("   ")).toBe("   ");
  });

  it("preserves original internal spacing", () => {
    expect(formatDisplayName("ANA   HAYNES")).toBe("Ana   Haynes");
    expect(formatDisplayName("  ANA HAYNES  ")).toBe("  Ana Haynes  ");
  });
});

describe("formatCompanyName — preserve acronyms & entity suffixes", () => {
  it("title-cases the words but keeps the entity suffix (spec example)", () => {
    expect(formatCompanyName("55 WEST 21 STREET LLC")).toBe("55 West 21 Street LLC");
    expect(formatCompanyName("PDC LLC")).toBe("PDC LLC");
  });

  it("preserves the whitelisted acronyms & suffixes from the spec", () => {
    expect(formatCompanyName("HVAC")).toBe("HVAC");
    expect(formatCompanyName("HVACR")).toBe("HVACR");
    expect(formatCompanyName("LLC")).toBe("LLC");
    expect(formatCompanyName("LP")).toBe("LP");
    expect(formatCompanyName("LLP")).toBe("LLP");
    expect(formatCompanyName("USA")).toBe("USA");
  });

  it("maps whitelisted tokens regardless of input case and Title-cases plain words", () => {
    // "pdc" & "llc" are whitelisted → canonical; "acme"/"corp" normalize.
    expect(formatCompanyName("pdc llc")).toBe("PDC LLC");
    expect(formatCompanyName("acme corp")).toBe("Acme Corp");
    expect(formatCompanyName("ACME CORP")).toBe("Acme Corp");
    expect(formatCompanyName("acme llc")).toBe("Acme LLC");
    expect(formatCompanyName("riverside plumbing & heating")).toBe("Riverside Plumbing & Heating");
  });

  it("preserves trailing punctuation on dotted suffixes", () => {
    expect(formatCompanyName("ACME LLC.")).toBe("Acme LLC.");
    expect(formatCompanyName("ACME INC.")).toBe("Acme Inc.");
    expect(formatCompanyName("ACME CORP.")).toBe("Acme Corp.");
    expect(formatCompanyName("ACME CO.")).toBe("Acme Co.");
  });

  it("handles dotted acronyms via separator-aware casing", () => {
    expect(formatCompanyName("L.L.C.")).toBe("L.L.C.");
    expect(formatCompanyName("U.S.A.")).toBe("U.S.A.");
  });

  it("preserves an already-correct company name", () => {
    expect(formatCompanyName("iPhone Repair Co")).toBe("iPhone Repair Co");
    expect(formatCompanyName("McDonald's LLC")).toBe("McDonald's LLC");
  });
});

describe("formatAddress — preserve directionals, street & unit abbreviations", () => {
  it("title-cases spelled-out street words (spec examples)", () => {
    expect(formatAddress("55 WEST 21 STREET")).toBe("55 West 21 Street");
    expect(formatAddress("123 SOUTH ORANGE AVENUE")).toBe("123 South Orange Avenue");
  });

  it("preserves directional + street + unit abbreviations (spec example)", () => {
    expect(formatAddress("45 N BROAD ST STE 201")).toBe("45 N Broad St Ste 201");
  });

  it("keeps ZIP codes and unit identifiers intact", () => {
    expect(formatAddress("TEANECK NJ 07666")).toBe("Teaneck NJ 07666");
    expect(formatAddress("36 STUYVESANT RD APT 2B")).toBe("36 Stuyvesant Rd Apt 2B");
    expect(formatAddress("PO BOX 123")).toBe("PO Box 123");
    expect(formatAddress("UNIT A")).toBe("Unit A");
    expect(formatAddress("APT 2B")).toBe("Apt 2B");
    expect(formatAddress("BLDG A")).toBe("Bldg A");
  });

  it("keeps ZIP+4 intact", () => {
    expect(formatAddress("NEWARK NJ 07102-1234")).toBe("Newark NJ 07102-1234");
  });

  it("applies the documented CT→Ct (Court) collision resolution", () => {
    expect(formatAddress("12 MAPLE CT")).toBe("12 Maple Ct");
  });

  it("formatStateCode preserves USPS codes uppercase", () => {
    expect(formatStateCode("ct")).toBe("CT");
    expect(formatStateCode("CT")).toBe("CT");
    expect(formatStateCode("nj")).toBe("NJ");
    expect(formatStateCode("Co")).toBe("CO");
    expect(formatStateCode("")).toBe("");
    expect(formatStateCode(null)).toBe("");
    // Not a USPS code → title-cased, not forced uppercase.
    expect(formatStateCode("NEW JERSEY")).toBe("New Jersey");
  });

  it("formatAddressParts joins non-empty formatted fields", () => {
    expect(
      formatAddressParts(["55 WEST 21 STREET", "", "NEW YORK", "NY", "10010"]),
    ).toBe("55 West 21 Street, New York, NY, 10010");
    expect(formatAddressParts([null, undefined, "  "])).toBe("");
  });
});

describe("context-aware address disambiguation (state code vs street/word)", () => {
  it("CT is Connecticut (state) in the state slot before a ZIP", () => {
    expect(formatAddress("STAMFORD CT 06901")).toBe("Stamford CT 06901");
    expect(formatAddress("123 MAIN ST STAMFORD CT 06901")).toBe("123 Main St Stamford CT 06901");
  });

  it("CT is Court (street suffix) when there is no state slot", () => {
    expect(formatAddress("12 MAPLE CT")).toBe("12 Maple Ct");
    expect(formatAddress("12 MAPLE CT APT 4")).toBe("12 Maple Ct Apt 4");
  });

  it("IN is Indiana (state) before a ZIP; the word 'in' never becomes the state code", () => {
    expect(formatAddress("500 W WASHINGTON ST INDIANAPOLIS IN 46204")).toBe(
      "500 W Washington St Indianapolis IN 46204",
    );
    // The lowercase connector word title-cases to "In" — it is NEVER uppercased
    // to the state code "IN" (state normalization only happens in the state slot).
    expect(formatAddress("the shop in newark")).toBe("The Shop In Newark");
  });

  it("preserves every USPS state code when it sits before a ZIP", () => {
    const codes = [
      "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "IA", "ID",
      "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT",
      "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI",
      "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY", "DC",
    ];
    for (const code of codes) {
      expect(formatAddress(`ANYTOWN ${code} 12345`)).toBe(`Anytown ${code} 12345`);
    }
  });

  it("resolves 'City ST' state at the end when it is not a street-suffix collision", () => {
    expect(formatAddress("NEWARK NJ")).toBe("Newark NJ");
    expect(formatAddress("PORTLAND OR")).toBe("Portland OR");
  });

  it("handles ZIP+4 and keeps the state", () => {
    expect(formatAddress("DENVER CO 80202-1234")).toBe("Denver CO 80202-1234");
  });

  it("company 'CO' suffix reads as Company, not the state (no address context)", () => {
    expect(formatCompanyName("ACME CO")).toBe("Acme Co");
    expect(formatCompanyName("ACME CO.")).toBe("Acme Co.");
  });
});

describe("opaque values — emails, URLs, phones, and ids are never modified", () => {
  it("returns emails byte-for-byte", () => {
    expect(formatDisplayName("Cynthia@Example.COM")).toBe("Cynthia@Example.COM");
    expect(formatCompanyName("SALES@MechanicalEnterprise.com")).toBe(
      "SALES@MechanicalEnterprise.com",
    );
  });

  it("returns phone-shaped strings unchanged", () => {
    expect(formatDisplayName("+1 (201) 555-1234")).toBe("+1 (201) 555-1234");
    expect(formatAddress("201.555.1234")).toBe("201.555.1234");
    expect(formatDisplayName("2015551234")).toBe("2015551234");
  });

  it("does not treat a short number-bearing name as a phone", () => {
    expect(formatDisplayName("21 CLUB")).toBe("21 Club");
  });

  it("returns URLs unchanged", () => {
    expect(formatDisplayName("https://Example.COM/Path")).toBe("https://Example.COM/Path");
    expect(formatCompanyName("www.MechanicalEnterprise.com")).toBe("www.MechanicalEnterprise.com");
  });

  it("preserves digit-bearing identifiers (QuickBooks ids, doc numbers)", () => {
    expect(formatDisplayName("QB-1234")).toBe("QB-1234");
    expect(formatDisplayName("E1")).toBe("E1");
    expect(formatDisplayName("PN#165")).toBe("PN#165");
    expect(formatDisplayName("DOC 1001")).toBe("Doc 1001");
  });
});

describe("idempotency — formatting an already-formatted value is a no-op", () => {
  const samples = [
    "Ana Haynes",
    "55 West 21 Street LLC",
    "45 N Broad St Ste 201",
    "PDC LLC",
    "de la Cruz",
    "McDonald's LLC",
  ];
  for (const s of samples) {
    it(`is stable for "${s}"`, () => {
      expect(formatDisplayName(s)).toBe(formatDisplayName(formatDisplayName(s)));
      expect(formatAddress(s)).toBe(formatAddress(formatAddress(s)));
    });
  }
});
