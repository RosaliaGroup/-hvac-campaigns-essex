/**
 * Regression tests for the 11 content-lane lint calibrations (CONTENT-BLOCK-REPORT, 2026-09-30).
 * Every "legit" sentence below is a real sentence the drafter produced that a rule wrongly blocked;
 * every "still blocked" sentence proves the rule still catches an actual assertion. #14 and #18
 * ("true positives" in the report) are pinned as still blocked.
 */
import { describe, it, expect } from "vitest";
import {
  lintWarrantyClaims,
  lintDifferentiationClaims,
  lintDifferentiationFactClaims,
  lintNumericClaims,
  lintDollarRanges,
  lintPageMeta,
  isGuaranteeAsserted,
} from "./seoLinter";
import { lintContent, type ContentLintInput } from "./contentLinter";
import { renderPostPlainText } from "./blogPostRendering";
import { splitSentences, isQuestion, hasNegation, isQuotedAt } from "./claimContext";
import { VERIFIED_FACTS } from "./verifiedFacts";
import type { BlogPostData } from "../client/src/data/blogPosts";

const codes = (fs: Array<{ code: string }>) => fs.map((f) => f.code);
const warranty = (t: string) => codes(lintWarrantyClaims(t));
const facts = { business: VERIFIED_FACTS.business };

describe("1. warranty_implies_included — sentence-level; questions, negations and 'optional/add-on/paid/separate' are not assertions", () => {
  it.each([
    ["#1", "Does the 10-year parts & labor coverage come included with a new installation?"],
    ["#3", "Every new system typically comes with a manufacturer's warranty on parts, handled directly through the equipment maker — that coverage is separate from anything a contractor offers."],
    ["#4", "Is the 10-year parts & labor coverage included with a new heat pump or furnace installation?"],
    ["#5", "Is the 10-year parts & labor coverage included with a new HVAC installation?"],
    ["#6", "This guide walks through the line items that move a heat pump number in Essex County, so you can compare bids on an apples-to-apples basis instead of guessing at what's included."],
    ["#7", "Is the 10-year parts and labor coverage included in the installation price?"],
    ["#14", "Is the 10-year parts and labor coverage included with a new installation?"],
    ["#17", "Not every system meets the program's criteria, and the coverage is a paid add-on rather than something included with a new installation."],
  ])("does not block %s", (_t, sentence) => {
    expect(warranty(sentence)).not.toContain("warranty_implies_included");
  });

  it("#12/#16/#13: an unpunctuated heading or checklist item is its own sentence, so 'included' in one doesn't pair with 'coverage' in the next", () => {
    const post = {
      title: "t", slug: "s", date: "d", readTime: "r", category: "c", metaDescription: "m", excerpt: "e",
      sections: [
        { type: "h2", content: "What's Typically Included in Contract Scope" },
        { type: "paragraph", content: "Service contracts define scope around equipment type and visit frequency." },
        { type: "h2", content: "What to Send Us / What to Ask Any HVAC Bidder" },
        { type: "checklist", items: ["Everything included in the current scope of work", "Existing equipment schedule and condition notes", "Ask whether extended parts & labor coverage is separately priced"] },
      ],
    } as unknown as BlogPostData;
    expect(warranty(renderPostPlainText(post))).not.toContain("warranty_implies_included");
    expect(warranty(renderPostPlainText(post))).not.toContain("warranty_existing_no_eligibility");
  });

  it.each([
    "A 10-year warranty is included with every install.",
    "Every install comes with a free warranty, no cost to you.",
    "The coverage is included at no extra charge.",
    "Not only is the warranty included, it's free.", // "not only" is not a denial
  ])("STILL blocks the assertion: %s", (sentence) => {
    expect(warranty(sentence)).toContain("warranty_implies_included");
  });
});

describe("2. superlative 'guaranteed' — allowed in questions, disclaimers and negations", () => {
  it.each([
    ["#4", "Are commercial rebate amounts guaranteed for every project?"],
    ["#7", "We can help identify which buildings may qualify, but rebate outcomes are never guaranteed and should always be confirmed with the utility."],
    ["#9", "Treat these figures as a starting point for your own verification, not a guaranteed outcome for your specific building."],
  ])("%s is not a superlative", (_t, sentence) => {
    expect(isGuaranteeAsserted(sentence)).toBe(false);
    const input: ContentLintInput = {
      title: "Commercial Rebate Planning for NJ Owners", metaDescription: "Plan commercial HVAC rebates.", body: sentence,
      h1Count: 1, h2Count: 3, h3Count: 0, faqQuestionCount: 0, internalLinkPaths: [], existingTitlesAndH1s: [],
    };
    expect(codes(lintContent(input, VERIFIED_FACTS).findings)).not.toContain("superlative");
  });

  it("also allowed in a title/meta disclaimer", () => {
    const r = lintPageMeta({ pagePath: "/blog/x", title: "Rebate Outcomes Are Never Guaranteed: What to Expect", metaDescription: "Savings aren't guaranteed. Learn how programs work. Call (862) 423-9396." });
    expect(codes(r.findings)).not.toContain("superlative");
  });

  it.each(["Guaranteed savings on every install.", "Your rebate is guaranteed.", "Not only guaranteed, but free."])("STILL blocks the assertion: %s", (s) => {
    expect(isGuaranteeAsserted(s)).toBe(true);
  });

  it("other superlatives are untouched", () => {
    const r = lintPageMeta({ pagePath: "/blog/x", title: "The Best HVAC Contractor in NJ", metaDescription: "Call (862) 423-9396." });
    expect(codes(r.findings)).toContain("superlative");
  });
});

describe("3. warranty_existing_no_eligibility — questions are not claims; list items are segmented", () => {
  it.each([
    ["#10", "Is coverage available on existing HVAC equipment, not just new installs?"],
    ["#11", "Does the 10-year parts and labor coverage apply to existing systems?"],
    ["#15", "Does the optional 10-year parts and labor coverage apply to existing HVAC systems?"],
  ])("does not block the FAQ question %s", (_t, q) => {
    expect(warranty(q)).not.toContain("warranty_existing_no_eligibility");
  });

  it("#4/#7: a 'what to send us' checklist with no punctuation is not glued into one sentence", () => {
    const post = {
      title: "t", slug: "s", date: "d", readTime: "r", category: "c", metaDescription: "m", excerpt: "e",
      sections: [{ type: "checklist", items: [
        "Electrical service capacity, especially for heat pump conversions",
        "Ask every bidder for a load calculation, not just a quote based on existing equipment size",
        "Ask whether extended parts & labor coverage is separately priced",
      ] }],
    } as unknown as BlogPostData;
    expect(warranty(renderPostPlainText(post))).not.toContain("warranty_existing_no_eligibility");
  });

  it("#14 STAYS a true positive: it implies existing equipment can be covered, with no 'eligible'", () => {
    expect(warranty("For portfolio owners, it's worth asking whether extending coverage to existing equipment makes more sense than replacing it outright as part of the renovation scope.")).toContain("warranty_existing_no_eligibility");
  });

  it("still blocks a declarative claim, and accepts one that says eligible", () => {
    expect(warranty("Coverage on existing systems is available.")).toContain("warranty_existing_no_eligibility");
    expect(warranty("Coverage on existing systems is available if they are eligible after inspection.")).not.toContain("warranty_existing_no_eligibility");
  });
});

describe("4. warranty_manufacturer_confusion — same sentence, not a contrast", () => {
  it.each([
    ["#5", "They fail in the middle years — typically years 5 through 8 — right after the manufacturer's warranty window closes and right before you've budgeted for replacement."],
    ["#3", "Every new system typically comes with a manufacturer's warranty on parts, handled directly through the equipment maker — that coverage is separate from anything a contractor offers."],
  ])("does not block %s", (_t, s) => {
    expect(warranty(s)).not.toContain("warranty_manufacturer_confusion");
  });

  it("not document-level any more: 'manufacturer's warranty' in one sentence and 'we' in another is fine", () => {
    expect(warranty("Start with the manufacturer's warranty terms. Then we can compare what a contractor adds.")).not.toContain("warranty_manufacturer_confusion");
  });

  it("STILL blocks presenting the manufacturer's warranty as ours", () => {
    expect(warranty("Our manufacturer's warranty covers parts on every unit we install.")).toContain("warranty_manufacturer_confusion");
  });
});

describe("5. 'lease renewal' is not equipment leasing", () => {
  it.each([
    "You're approaching a property sale, refinance, or major lease renewal and want documentation of system condition.",
    "One bad week of noise or lost heat turns into complaint calls and lease-renewal risk.",
    "Tenants notice a lease term that ends with a broken unit.",
  ])("does not block: %s", (s) => {
    expect(codes(lintDifferentiationClaims(s))).not.toContain("membership_equipment_ownership_implied");
  });

  it.each(["Membership includes a lease on the equipment.", "You rent the equipment with membership."])("STILL blocks equipment leasing: %s", (s) => {
    expect(codes(lintDifferentiationClaims(s))).toContain("membership_equipment_ownership_implied");
  });
});

describe("6. warranty_wrong_year_count — only a year count attached to the coverage term, never a range", () => {
  it("#5: '5-8 year window' is an equipment age, not a coverage term", () => {
    expect(warranty("Have a portfolio with aging compressors approaching the 5-8 year window?")).not.toContain("warranty_wrong_year_count");
    expect(warranty("Compressors fail in years 5 to 8, right after the warranty window. Ask about coverage for that window.")).not.toContain("warranty_wrong_year_count");
  });

  it.each(["A 12-year warranty on every system.", "We offer 20 year parts and labor.", "Our coverage lasts 15 years.", "Extended coverage for 8 years."])("STILL blocks a wrong term: %s", (s) => {
    expect(warranty(s)).toContain("warranty_wrong_year_count");
  });

  it("10 years is still correct", () => {
    expect(warranty("Optional 10-year parts & labor coverage. Coverage for 10 years.")).not.toContain("warranty_wrong_year_count");
  });
});

describe("7. sla_hours_mismatch / 24-7 / same-day — quoted and negated mentions are discussing the phrase, not claiming it", () => {
  const f = (t: string) => codes(lintDifferentiationFactClaims(t, VERIFIED_FACTS));

  it("#8: a quoted, critical '24-hour response'", () => {
    expect(f("Most commercial HVAC contracts advertise a '24-hour response' without ever defining what that phrase actually obligates the contractor to do.")).not.toContain("sla_hours_mismatch");
    expect(f('Be wary of a "24-hour response" promise with no definition.')).not.toContain("sla_hours_mismatch");
  });
  it("#8: a negated 24/7", () => {
    expect(f("Coverage hours — business hours only, or extended hours, stated explicitly (don't assume 24/7 unless it's written).")).not.toContain("service_hours_24x7_unverified");
  });
  it("a negated same-day", () => {
    expect(f("We do not offer same-day service unless it is written into the contract.")).not.toContain("service_hours_same_day_unverified");
  });

  it.each([
    ["We offer a 24-hour response on every call.", "sla_hours_mismatch"],
    ["We offer 24/7 emergency service.", "service_hours_24x7_unverified"],
    ["Same-day installs are available.", "service_hours_same_day_unverified"],
    ["Not only do we offer 24/7 service, we never close.", "service_hours_24x7_unverified"],
    ["Not only do we offer same-day service, it is free.", "service_hours_same_day_unverified"],
  ])("STILL blocks the claim: %s", (s, code) => {
    expect(f(s)).toContain(code);
  });

  it("helpers: isQuotedAt / hasNegation / stripped 'not only'", () => {
    expect(isQuotedAt("say '24-hour response' here", 5)).toBe(true);
    expect(isQuotedAt("we offer 24-hour response", 9)).toBe(false);
    expect(hasNegation("rebates are never guaranteed")).toBe(true);
    expect(hasNegation("Not only is it included")).toBe(false);
  });
});

describe("8. numeric claims — N/5 needs rating context; reader-context counts aren't about us", () => {
  it.each([
    "Many contractors use a 3/5/10 year parts and labor structure.",
    "Plan the project in a 4/5 step process.",
    "A crew of 3 technicians will be on site for two days.",
    "For portfolios spanning 3 counties, ask for per-county pricing.",
    "If you have 5 projects a year, negotiate one master agreement.",
  ])("does not block: %s", (s) => {
    expect(lintNumericClaims(s, facts)).toEqual([]);
  });

  it.each([
    ["Serving 15 counties across New Jersey."],
    ["Our 12 technicians are licensed."],
    ["Our crew of 12 technicians is licensed."],
    ["Over 500 customers trust us."],
    ["4.9/5 on Google."],
    ["Rated 4.9/5 by our clients."],
    ["4/5 stars from customers."],
    ["We completed 40 projects last year."],
    ["30 years in business."],
    ["A 4.9-star contractor."],
  ])("STILL blocks the claim: %s", (s) => {
    expect(lintNumericClaims(s, facts).length).toBeGreaterThan(0);
  });
});

describe("9. price ranges — 'between $X and $Y' is a range", () => {
  it("blocks the worded range, and accepts it only when it matches a verified range", () => {
    expect(lintDollarRanges("Budget between $8,000 and $15,000 per unit.", []).map((x) => x.code)).toContain("unverified_dollar_range");
    expect(lintDollarRanges("Budget between $8K and $15K per unit.", []).length).toBe(1);
    expect(lintDollarRanges("Budget between $8,000 and $15,000 per unit.", [{ page: "/x", low: 8000, high: 15000 }])).toEqual([]);
    expect(lintDollarRanges("Typical range: $8,000-$15,000.", []).length).toBe(1);
  });
  it("a single figure is not a range", () => {
    expect(lintDollarRanges("PSE&G rebates up to $16,000 may apply, between installations.", [])).toEqual([]);
  });
});

describe("10. claimContext helpers", () => {
  it("splitSentences splits on terminal punctuation AND newlines; isQuestion only for '?'", () => {
    expect(splitSentences("One. Two?\nThree heading\nFour!")).toEqual(["One.", "Two?", "Three heading", "Four!"]);
    expect(isQuestion("Is it covered?")).toBe(true);
    expect(isQuestion("It is covered.")).toBe(false);
  });
  it("renderPostPlainText separates units with newlines but keeps the word count", () => {
    const post = {
      title: "A title", slug: "s", date: "d", readTime: "r", category: "c", metaDescription: "m", excerpt: "An excerpt",
      sections: [{ type: "h2", content: "Heading" }, { type: "checklist", items: ["one item", "two item"] }],
    } as unknown as BlogPostData;
    const text = renderPostPlainText(post);
    expect(text.split("\n")).toEqual(["A title", "An excerpt", "Heading", "one item\ntwo item"].join("\n").split("\n"));
    expect(text.trim().split(/\s+/).length).toBe("A title An excerpt Heading one item two item".split(" ").length);
  });
});
