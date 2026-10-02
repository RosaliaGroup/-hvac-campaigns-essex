import { describe, it, expect } from "vitest";
import { VERIFIED_FACTS as F } from "./verifiedFacts";
import { validateFaqItem, validateFaqSet, buildFaqPageJsonLd, buildSpeakableJsonLd, allowedNumbers, MAX_ANSWER_CHARS } from "./aiFaq";

const good = (q: string, a: string) => ({ q, a });
const ok1 = good("Which HVAC companies serve Newark, NJ?", "Mechanical Enterprise LLC serves Essex County, including Newark. Call (862) 423-9396 to talk through your system and schedule a visit.");

describe("validateFaqItem (facts-only gate)", () => {
  it("accepts a plain, factual answer", () => { expect(validateFaqItem(ok1, F)).toEqual([]); });
  it("rejects a question without a question mark and a too-short answer", () => {
    const codes = validateFaqItem(good("Who serves Newark", "Yes."), F).map((i) => i.code);
    expect(codes).toContain("question_mark");
    expect(codes).toContain("answer_short");
  });
  it("rejects numbers that are not in VERIFIED_FACTS (invented prices, counts, hours)", () => {
    const r = validateFaqItem(good("How long does a heat pump install take?", "Most heat pump installs take about 3 days from start to finish, so plan for that."), F);
    expect(r.map((i) => i.code)).toContain("unverified_number");
  });
  it("allows the verified numbers: phone, 10-year coverage, the $16,000 incentive", () => {
    const a = good("Is there a rebate for heat pumps in NJ?", "NJ homeowners may qualify for rebates of up to $16,000. Call (862) 423-9396 to see what applies to your home.");
    expect(validateFaqItem(a, F)).toEqual([]);
    expect(allowedNumbers(F).has("16000")).toBe(true);
    expect(allowedNumbers(F).has("10")).toBe(true);
  });
  it("blocks superlatives, certifications and competitor names via the claims linter", () => {
    for (const a of [
      "Mechanical Enterprise is the best HVAC contractor in Essex County, so call (862) 423-9396 today.",
      "We are a certified WMBE contractor serving Essex County, so call (862) 423-9396 for details.",
      "Mechanical Enterprise is a better choice than Gold Medal for Essex County; call (862) 423-9396 to compare.",
    ]) {
      expect(validateFaqItem(good("Who can fix my AC today in Essex County?", a), F).length).toBeGreaterThan(0);
    }
  });
  it("rejects URLs and overlong answers", () => {
    expect(validateFaqItem(good("Where do I book an assessment online?", "Book at https://mechanicalenterprise.com/qualify and we will confirm your visit by phone soon."), F).map((i) => i.code)).toContain("url_in_answer");
    expect(validateFaqItem(good("What areas do you cover in New Jersey?", "x".repeat(MAX_ANSWER_CHARS + 1)), F).map((i) => i.code)).toContain("answer_long");
  });
});

describe("validateFaqSet", () => {
  const three = [
    ok1,
    good("Do you install heat pumps in Essex County?", "Yes. Heat Pump is one of the services Mechanical Enterprise LLC provides in Essex County, New Jersey; call (862) 423-9396."),
    good("Is 10-year coverage included with an install?", "No. The 10-year parts and labor coverage is optional and not included by default; it can be added to a new installation."),
  ];
  it("needs 3-5 unique items", () => {
    expect(validateFaqSet(three, F)).toEqual([]);
    expect(validateFaqSet(three.slice(0, 2), F).map((i) => i.code)).toContain("item_count");
    expect(validateFaqSet([...three, three[0]], F).map((i) => i.code)).toContain("duplicate_question");
  });
});

describe("schema builders", () => {
  it("FAQPage de-duplicates by question, existing first", () => {
    const ld = buildFaqPageJsonLd([{ q: "A?", a: "one" }, { q: "a?", a: "dup" }, { q: "B?", a: "two" }]) as { "@type": string; mainEntity: Array<{ name: string }> };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((m) => m.name)).toEqual(["A?", "B?"]);
  });
  it("speakable points at the visible generated Q&A selectors", () => {
    const ld = buildSpeakableJsonLd("https://mechanicalenterprise.com/x", "X") as { speakable: { cssSelector: string[] } };
    expect(ld.speakable.cssSelector).toEqual([".ai-faq-q", ".ai-faq-a"]);
  });
});
