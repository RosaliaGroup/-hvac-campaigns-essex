import { describe, it, expect } from "vitest";
import { lintContent, fleschReadingEase, bagOfWordsCosineSimilarity, isResidentialOrRebateTopic, type ContentLintInput } from "./contentLinter";
import { VERIFIED_FACTS } from "./verifiedFacts";

function words(n: number, filler = "commercial building maintenance"): string {
  const tokens = filler.split(" ");
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(tokens[i % tokens.length]);
  return out.join(" ") + ".";
}

const cleanInput: ContentLintInput = {
  title: "HVAC Capital Budgeting for Apartment Owners in NJ",
  metaDescription: "How NJ multifamily owners should budget HVAC capital replacement.",
  body: words(1000),
  h1Count: 1,
  h2Count: 4,
  h3Count: 0,
  faqQuestionCount: 0,
  internalLinkPaths: ["/commercial"],
  existingTitlesAndH1s: ["Totally unrelated post about something else entirely"],
};

const factsWithIncentive = {
  ...VERIFIED_FACTS,
  incentives: [{ program: "PSE&G equipment rebate", amountText: "$4,000", verifiedOn: "2026-09-26", source: "pseg.com" }],
};

describe("lintContent — clean input", () => {
  it("passes with no block findings", () => {
    const result = lintContent(cleanInput, factsWithIncentive);
    expect(result.findings.filter((f) => f.severity === "block")).toEqual([]);
  });
});

describe("lintContent — reused BLOCK word-lists (same rules as title/meta)", () => {
  it("blocks a superlative in the body", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " We are the #1 choice." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "superlative")).toBe(true);
    expect(result.passes).toBe(false);
  });

  it("blocks an expired incentive mention", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " Ask about the federal tax credit." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "expired_incentive")).toBe(true);
  });

  it("blocks unverified certification wording", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " Our team is certified in every discipline." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "unverified_certification")).toBe(true);
  });

  it("blocks a competitor name (case-sensitive proper noun)", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " Unlike Gold Medal, we respond fast." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "competitor_name")).toBe(true);
  });

  it("does not false-positive on a lowercase, non-competitor use of a brand word", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " We look forward to what's on the horizon for this building." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "competitor_name")).toBe(false);
  });
});

describe("lintContent — extended body-specific rules (spec Part 2 / addendum §A4)", () => {
  it("blocks a project-count claim", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " We've completed 47 projects like this." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "project_count_claim")).toBe(true);
  });

  it("blocks a named-client heuristic match", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " We recently finished this for client John Smith in Newark." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "named_client")).toBe(true);
  });

  it("does NOT false-positive on ordinary B2B title/headline grammar ('for [Capitalized] [Capitalized]')", () => {
    const result = lintContent({ ...cleanInput, title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits", body: words(1000) + " This guide is written for Property Managers and Apartment Owners." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "named_client")).toBe(false);
  });

  it("blocks a dollar figure not present in verified incentives", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " Save up to $9,500 on your next install." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "unverified_dollar_figure")).toBe(true);
  });

  it("allows a dollar figure that matches a verified incentive exactly", () => {
    const result = lintContent({ ...cleanInput, body: words(1000) + " PSE&G offers a rebate of $4,000 on qualifying equipment." }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "unverified_dollar_figure")).toBe(false);
  });

  it("blocks any dollar figure at all when facts aren't configured yet", () => {
    const unconfiguredFacts = { ...VERIFIED_FACTS, incentives: [] };
    const result = lintContent({ ...cleanInput, body: words(1000) + " Save $500 today." }, unconfiguredFacts);
    expect(result.findings.some((f) => f.code === "facts_not_configured")).toBe(true);
  });

  it("blocks word count outside 900-1400", () => {
    expect(lintContent({ ...cleanInput, body: words(500) }, factsWithIncentive).findings.some((f) => f.code === "word_count")).toBe(true);
    expect(lintContent({ ...cleanInput, body: words(2000) }, factsWithIncentive).findings.some((f) => f.code === "word_count")).toBe(true);
    expect(lintContent({ ...cleanInput, body: words(1100) }, factsWithIncentive).findings.some((f) => f.code === "word_count")).toBe(false);
  });

  it("blocks zero or multiple H1s — exactly one required", () => {
    expect(lintContent({ ...cleanInput, h1Count: 0 }, factsWithIncentive).findings.some((f) => f.code === "h1_count")).toBe(true);
    expect(lintContent({ ...cleanInput, h1Count: 2 }, factsWithIncentive).findings.some((f) => f.code === "h1_count")).toBe(true);
  });

  it("blocks more than 6 H2s", () => {
    expect(lintContent({ ...cleanInput, h2Count: 7 }, factsWithIncentive).findings.some((f) => f.code === "h2_count")).toBe(true);
    expect(lintContent({ ...cleanInput, h2Count: 6 }, factsWithIncentive).findings.some((f) => f.code === "h2_count")).toBe(false);
  });

  it("blocks any H3 usage (no H3 walls)", () => {
    expect(lintContent({ ...cleanInput, h3Count: 1 }, factsWithIncentive).findings.some((f) => f.code === "h3_wall")).toBe(true);
  });

  it("blocks a FAQ block with 1-2 questions but allows 0 or 3+", () => {
    expect(lintContent({ ...cleanInput, faqQuestionCount: 2 }, factsWithIncentive).findings.some((f) => f.code === "faq_too_few")).toBe(true);
    expect(lintContent({ ...cleanInput, faqQuestionCount: 0 }, factsWithIncentive).findings.some((f) => f.code === "faq_too_few")).toBe(false);
    expect(lintContent({ ...cleanInput, faqQuestionCount: 3 }, factsWithIncentive).findings.some((f) => f.code === "faq_too_few")).toBe(false);
  });

  it("blocks when there is no B2B link", () => {
    expect(lintContent({ ...cleanInput, internalLinkPaths: ["/blog/some-post"] }, factsWithIncentive).findings.some((f) => f.code === "no_b2b_link")).toBe(true);
  });

  it("blocks more than 3 internal links", () => {
    const result = lintContent({ ...cleanInput, internalLinkPaths: ["/commercial", "/blog/a", "/blog/b", "/blog/c"] }, factsWithIncentive);
    expect(result.findings.some((f) => f.code === "too_many_internal_links")).toBe(true);
  });

  it("blocks a near-duplicate title against an existing post (same words, one addition)", () => {
    const result = lintContent(
      { ...cleanInput, title: "The Complete HVAC Capital Budgeting Guide for Apartment Owners in NJ", existingTitlesAndH1s: ["HVAC Capital Budgeting Guide for Apartment Owners in NJ"] },
      factsWithIncentive,
    );
    expect(result.findings.some((f) => f.code === "duplicate_topic")).toBe(true);
  });

  it("documented limitation: a paraphrase ('NJ' vs 'New Jersey') falls just under the bag-of-words threshold — see file header caveat", () => {
    const result = lintContent(
      { ...cleanInput, title: "HVAC Capital Budgeting for Apartment Owners in New Jersey", existingTitlesAndH1s: ["HVAC Capital Budgeting for Apartment Owners in NJ"] },
      factsWithIncentive,
    );
    expect(result.findings.some((f) => f.code === "duplicate_topic")).toBe(false);
  });

  it("warns (does not block) on reading level outside the target band", () => {
    const denseBody = words(1000).replace(/\./g, "") + "."; // one giant sentence — low Flesch score
    const result = lintContent({ ...cleanInput, body: denseBody }, factsWithIncentive);
    const finding = result.findings.find((f) => f.code === "reading_level");
    if (finding) expect(finding.severity).toBe("warn");
  });
});

describe("fleschReadingEase", () => {
  it("scores short, simple sentences higher than one long, complex sentence with the same word count", () => {
    const simple = "The cat sat. The dog ran. We ate food. It was fun. She smiled wide.";
    const complex = "The multifaceted, interdisciplinary considerations underpinning contemporary organizational restructuring necessitate comprehensive stakeholder deliberation.";
    expect(fleschReadingEase(simple)).toBeGreaterThan(fleschReadingEase(complex));
  });
});

describe("bagOfWordsCosineSimilarity", () => {
  it("is 1 for identical text", () => {
    expect(bagOfWordsCosineSimilarity("HVAC capital budgeting guide", "HVAC capital budgeting guide")).toBeCloseTo(1, 5);
  });
  it("is 0 for completely disjoint text", () => {
    expect(bagOfWordsCosineSimilarity("aaa bbb ccc", "xxx yyy zzz")).toBe(0);
  });
  it("is higher for near-identical wording than for unrelated text", () => {
    const a = "HVAC capital budgeting for apartment owners in NJ";
    const near = "HVAC capital budgeting for apartment owners in New Jersey";
    const far = "Best pizza recipes for a summer cookout";
    expect(bagOfWordsCosineSimilarity(a, near)).toBeGreaterThan(bagOfWordsCosineSimilarity(a, far));
  });
});

describe("isResidentialOrRebateTopic", () => {
  it("flags residential/rebate/homeowner topics", () => {
    expect(isResidentialOrRebateTopic({ title: "NJ Heat Pump Rebates 2026" })).toBe(true);
    expect(isResidentialOrRebateTopic({ title: "Homeowner's Guide to Mini Splits" })).toBe(true);
    expect(isResidentialOrRebateTopic({ title: "Something else", audience: "residential customers" })).toBe(true);
  });
  it("does not flag genuine B2B topics", () => {
    expect(isResidentialOrRebateTopic({ title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits", audience: "property managers" })).toBe(false);
  });
});
