import { describe, it, expect } from "vitest";
import { lintNumericClaims, numericFactsFrom, parseNumberToken, type NumericFacts } from "./numericClaimsLinter";
import { VERIFIED_FACTS } from "./verifiedFacts";

// The real facts today: 9 counties, 20 years, no customer/project figure.
const REAL = numericFactsFrom(VERIFIED_FACTS);
const codes = (text: string, nf: NumericFacts = REAL) => lintNumericClaims(text, nf).map((f) => f.code);

describe("numericFactsFrom(VERIFIED_FACTS)", () => {
  it("counts the verified counties, carries the years figure, and leaves customers/projects unset", () => {
    expect(REAL).toEqual({ serviceCounties: 9, yearsInBusiness: 20, customersServed: null, projectsCompleted: null });
  });

  it("carries owner-supplied customer/project figures when present", () => {
    const nf = numericFactsFrom({ business: { ...VERIFIED_FACTS.business, customersServed: 800, projectsCompleted: 450 } });
    expect(nf).toMatchObject({ customersServed: 800, projectsCompleted: 450 });
  });
});

describe("parseNumberToken", () => {
  it.each([
    ["15", 15], ["1,200", 1200], ["2k", 2000], ["2K", 2000], ["2.5k", 2500], ["fifteen", 15], ["twenty", 20], ["twenty-five", 25], ["twenty five", 25],
    ["ninety-nine", 99], ["dozen", 12], ["hundred", 100], ["Twenty", 20],
  ])("reads %s as %d", (raw, n) => expect(parseNumberToken(raw)).toBe(n));

  it("returns null for anything it can't read (never treated as verified)", () => {
    expect(parseNumberToken("several")).toBeNull();
    expect(parseNumberToken("")).toBeNull();
  });
});

describe("counties", () => {
  it("BLOCKS the marketing-copy figure that isn't backed: '15 counties' (only 9 have a city page)", () => {
    expect(codes("Serving 15 counties across New Jersey")).toEqual(["unverified_county_count"]);
    expect(codes("Our HVAC crews cover fifteen counties.")).toEqual(["unverified_county_count"]);
  });

  it("allows the verified count (9), in digits, words, '+' and hyphen forms", () => {
    expect(codes("Serving 9 counties across NJ")).toEqual([]);
    expect(codes("Serving nine counties")).toEqual([]);
    expect(codes("Serving 9+ counties")).toEqual([]);
    expect(codes("A 9-county service area")).toEqual([]);
  });

  it("catches adjectives between the number and 'counties'", () => {
    expect(codes("Serving 15 northern NJ counties")).toEqual(["unverified_county_count"]);
    expect(codes("Serving 12 New Jersey counties")).toEqual(["unverified_county_count"]);
  });

  it("ignores a county name and a singular '1 county'", () => {
    expect(codes("Serving Essex County and Hudson County")).toEqual([]);
    expect(codes("Serving 1 county")).toEqual([]);
  });

  it("the message names the verified figure so the drafter can fix it", () => {
    const [f] = lintNumericClaims("Serving 15 counties", REAL);
    expect(f.claim).toBe("15 counties");
    expect(f.message).toMatch(/business\.serviceCounties/);
    expect(f.message).toMatch(/\(9\)/);
  });
});

describe("years in business / experience", () => {
  it("allows the verified 20 in every common phrasing, including '+' and 'over'", () => {
    for (const t of [
      "20 years of experience", "20+ years of experience", "over 20 years of experience", "20 years in business", "twenty years in business",
      "20 years of combined HVAC experience", "20+ years serving NJ", "Serving NJ for over 20 years", "Serving New Jersey for 20 years",
      "Experience: 20 years", "20 years of team experience",
    ]) expect(codes(t), t).toEqual([]);
  });

  it("BLOCKS any other figure", () => {
    for (const t of ["25 years of experience", "30+ years in business", "Serving NJ for over 40 years", "15 years of combined HVAC experience", "thirty years serving NJ", "Experience: 50 years"]) {
      expect(codes(t), t).toEqual(["unverified_years_claim"]);
    }
  });

  it("does NOT treat warranty terms, equipment age, lifespans or failure windows as a years-in-business claim", () => {
    for (const t of [
      "Optional 10-year parts & labor coverage", "10 years of parts and labor coverage", "Systems over 10 years old", "A furnace can last 15 years",
      "Compressor failures happen in years 5-8", "R22 was phased out 10 years ago", "3, 5 or 10 year terms", "Financing over 5 years",
      "Installing systems built to last for 15 years",
    ]) expect(codes(t), t).toEqual([]);
  });
});

describe("customers", () => {
  it("BLOCKS any customer/client/homeowner/property-manager count while none is verified", () => {
    for (const t of ["We have served 500 customers", "Trusted by 200 property managers", "over 1,000 happy homeowners", "2k satisfied clients", "fifty repeat clients", "Helping 300 NJ families"]) {
      expect(codes(t), t).toEqual(["unverified_customer_count"]);
    }
  });

  it("BLOCKS vague magnitudes with no number to verify ('hundreds of customers')", () => {
    for (const t of ["hundreds of happy customers", "thousands of homeowners", "dozens of property managers"]) expect(codes(t), t).toEqual(["unverified_customer_count"]);
  });

  it("allows exactly the owner-supplied figure once one is set", () => {
    const nf = { ...REAL, customersServed: 800 };
    expect(codes("We have served 800 customers", nf)).toEqual([]);
    expect(codes("We have served 500 customers", nf)).toEqual(["unverified_customer_count"]);
    expect(lintNumericClaims("500 customers", nf)[0].message).toMatch(/\(800\)/);
  });

  it("ignores rates and shares: '1 in 3 homeowners', 'every 3 homeowners', '2 of 5 families'", () => {
    for (const t of ["1 in 3 homeowners qualify for rebates", "Call every 3 homeowners you know", "2 of 5 families switch", "Only 1 customer needs this"]) expect(codes(t), t).toEqual([]);
  });
});

describe("projects", () => {
  it("BLOCKS project / installation / job counts while none is verified", () => {
    for (const t of ["We have completed 300 projects", "Over 1,000 installations", "500+ successful installs", "fifty completed jobs", "200 commercial projects"]) {
      expect(codes(t), t).toEqual(["unverified_project_count"]);
    }
  });

  it("BLOCKS vague magnitudes ('thousands of projects')", () => {
    expect(codes("thousands of projects across NJ")).toEqual(["unverified_project_count"]);
  });

  it("allows the owner-supplied figure once set, and blocks a different one", () => {
    const nf = { ...REAL, projectsCompleted: 450 };
    expect(codes("450 completed projects", nf)).toEqual([]);
    expect(codes("500 completed projects", nf)).toEqual(["unverified_project_count"]);
  });

  it("ignores singular use and unrelated numbers", () => {
    for (const t of ["One installation covers the whole floor", "A typical installation takes 2 days", "3-ton heat pump installation", "Step 1: schedule your project"]) expect(codes(t), t).toEqual([]);
  });
});

describe("mixed text", () => {
  it("reports each unverified claim once, with its own code", () => {
    const found = codes("Serving 15 counties for over 30 years, with 500 customers and 200 projects completed.");
    expect(found.sort()).toEqual(["unverified_county_count", "unverified_customer_count", "unverified_project_count", "unverified_years_claim"].sort());
  });

  it("does not repeat a finding for the same claim written twice", () => {
    expect(codes("15 counties. Again: 15 counties.")).toEqual(["unverified_county_count"]);
  });

  it("passes clean copy through untouched", () => {
    expect(codes("Heat pump installation in Newark with optional 10-year parts & labor coverage. Call today.")).toEqual([]);
  });
});

describe("regressions: false positives found by scanning the real prod drafts (2026-09-30)", () => {
  it("a dollar amount before 'HVAC installation' is not a project count ('Up to $16K HVAC installation')", () => {
    for (const t of ["Up to $16K HVAC installation rebates in Nutley", "Save $16K HVAC installation costs", "$16,000 HVAC installation incentives", "Only $ 16K installation"]) {
      expect(codes(t), t).toEqual([]);
    }
  });

  it("a calendar year in a title is not a count ('2026 Homeowner's Guide', '2026 NJ HVAC installation cost')", () => {
    for (const t of ["2026 Homeowner's Guide to HVAC Rebates", "2026 NJ HVAC installation cost guide", "Your 2027 homeowners checklist"]) {
      expect(codes(t), t).toEqual([]);
    }
  });

  it("but a real count is still caught when it is not a plausible year or carries a comma", () => {
    expect(codes("Over 2,000 customers")).toEqual(["unverified_customer_count"]);
    expect(codes("2000 customers served")).toEqual(["unverified_customer_count"]);
    expect(codes("1,200 installations completed")).toEqual(["unverified_project_count"]);
  });

  it("a longer number is matched once, from its start ('1,200 customers' is not also read as '200 customers')", () => {
    const found = lintNumericClaims("1,200 customers", REAL);
    expect(found).toHaveLength(1);
    expect(found[0].claim).toBe("1,200 customers");
  });
});
