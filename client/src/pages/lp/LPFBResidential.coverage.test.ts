import { describe, it, expect } from "vitest";
import { lintWarrantyClaims } from "@shared/seoLinter";
import { COVERAGE_HEADING, COVERAGE_INTRO, COVERAGE_POINTS, COVERAGE_FOOTNOTE } from "./LPFBResidential";

const all = [COVERAGE_HEADING, COVERAGE_INTRO, ...COVERAGE_POINTS, COVERAGE_FOOTNOTE].join(". ");

describe("residential LP optional coverage section", () => {
  it("passes the site's warranty-claims linter (optional, not included, eligibility stated)", () => {
    expect(lintWarrantyClaims(all)).toEqual([]);
  });
  it("only states verified terms and calls coverage optional / separately purchased", () => {
    expect(COVERAGE_HEADING).toMatch(/optional/i);
    expect(COVERAGE_FOOTNOTE).toMatch(/purchased separately/i);
    expect(all).not.toMatch(/\b(free|included|lifetime|unlimited|guarantee)/i);
    expect(all).toMatch(/10 years|10-Year/);
    expect(COVERAGE_POINTS.join(" ")).toMatch(/Eligible existing systems may qualify/);
  });
});
