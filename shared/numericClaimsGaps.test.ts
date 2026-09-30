import { describe, it, expect } from "vitest";
import { lintNumericClaims } from "./seoLinter";
import { VERIFIED_FACTS } from "./verifiedFacts";

// The claims rule (unverified_numeric_claim) was checked against a corpus of real-looking phrasings
// (2026-09-30). It missed 11 fabricated-claim shapes and blocked 4 harmless ones; each is pinned here.
// Its own file so it can't conflict with other branches appending to seoLinter.test.ts.
const facts = VERIFIED_FACTS; // 9 counties, 20 years, no customer/project/technician/review figure
const blocked = (t: string) => lintNumericClaims(t, facts).length > 0;
const kinds = (t: string) => lintNumericClaims(t, facts).map((f) => f.message.match(/is a ([a-z ]+) claim/)?.[1]);

describe("numeric claims — shapes that used to slip through (must BLOCK)", () => {
  it.each([
    ["Our HVAC crews cover fifteen counties.", "county count"],
    ["Serving 15 northern NJ counties", "county count"],
    ["Serving 12 New Jersey counties", "county count"],
    ["thirty years serving NJ", "years in business"],
    ["Serving NJ for over forty years", "years in business"],
    ["fifty repeat clients", "customer count"],
    ["Trusted by 200 property managers", "customer count"],
    ["2k satisfied clients", "customer count"],
    ["Over 1,000 installations", "project count"],
    ["1,200 installations completed", "project count"],
    ["fifty completed jobs", "project count"],
    ["200 commercial projects", "project count"],
  ])("blocks %s", (t, kind) => {
    expect(blocked(t), t).toBe(true);
    expect(kinds(t)).toContain(kind);
  });

  it("blocks vague magnitudes for property managers / building owners / scores of", () => {
    for (const t of ["dozens of property managers", "scores of building owners", "hundreds of property managers"]) expect(blocked(t), t).toBe(true);
  });

  it("reads number words in the compound form ('twenty-five') and 'a dozen'", () => {
    expect(blocked("twenty-five years of experience")).toBe(true);
    expect(blocked("a dozen counties")).toBe(true);
  });
});

describe("numeric claims — harmless phrasings that used to be blocked (must PASS)", () => {
  it.each([
    "1 in 3 homeowners qualify for rebates",
    "Call every 3 homeowners you know",
    "2 of 5 families switch",
    "Your 2027 homeowners checklist",
    "2026 homeowners guide to rebates",
    "Up to $16K HVAC installation rebates in Nutley",
    "$16,000 HVAC installation incentives",
    "One installation covers the whole floor",
    "Serving 1 county",
    "A typical installation takes 2 days",
    "3-ton heat pump installation",
  ])("passes %s", (t) => expect(blocked(t), t).toBe(false));
});

describe("numeric claims — the verified figures and the existing categories are untouched", () => {
  it.each([
    "Serving 9 counties across NJ", "Serving nine counties", "over 20 years of experience", "twenty years in business", "Serving NJ for over 20 years", "20+ years serving NJ",
    "Optional 10-year parts & labor coverage", "Systems over 10 years old", "Compressor failures happen in years 5-8", "SEER2 and HSPF2 ratings explained",
  ])("still passes %s", (t) => expect(blocked(t), t).toBe(false));

  it.each(["We have served 500 customers", "We have completed 300 projects", "Our 12 licensed technicians", "500 five-star reviews", "Rated 5 stars", "4.9/5 on Google", "Serving 15 counties", "25 years of experience", "hundreds of happy customers"])(
    "still blocks %s",
    (t) => expect(blocked(t), t).toBe(true),
  );

  it("a real count is still caught when it is a 4-digit number that is not a plausible year, or carries a comma", () => {
    expect(blocked("Over 2,000 customers")).toBe(true);
    expect(blocked("2000 customers served")).toBe(true);
  });

  it("a longer number is matched once, from its start", () => {
    expect(lintNumericClaims("1,200 customers", facts)).toHaveLength(1);
  });

  it("the message still names the verified figure, and one code is used throughout", () => {
    const [f] = lintNumericClaims("Serving fifteen counties", facts);
    expect(f.code).toBe("unverified_numeric_claim");
    expect(f.severity).toBe("block");
    expect(f.message).toMatch(/verified: 9/);
  });
});
