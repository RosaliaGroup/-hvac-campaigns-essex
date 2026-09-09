import { describe, it, expect } from "vitest";
import { blogPosts } from "../blogPosts";

// The federal 25C HVAC tax credit expired Dec 31, 2025. No blog post may
// claim it (or the fabricated "$20K/$22K" combined totals it was used to
// justify) as a live incentive. See shared/business.ts / Fix 2 (rebate
// claims) for context.
//
// A handful of posts legitimately discuss 25C as HISTORY (explaining that it
// expired, what that means, what's still available) rather than claiming it
// — those are named here explicitly rather than pattern-matched, so a new
// post can't accidentally slip onto this list.
const EXPIRED_CREDIT_EXPLANATION_SLUGS = new Set([
  "federal-25c-tax-credit-hvac-2026", // the original 25C explainer, rewritten in place
  "pseg-rebate-vs-federal-tax-credit",
  "hvac-tax-credits-2026-nj",
  "inflation-reduction-act-hvac-nj",
]);

// A couple of posts legitimately use $20,000+ as an INSTALLATION COST range
// (not a rebate claim): a Jersey City brownstone heat pump install, and a
// geothermal system install. Named explicitly for the same reason as above.
const LEGITIMATE_COST_RANGE_SLUGS = new Set([
  "hvac-contractor-jersey-city-nj",
  "geothermal-heat-pump-nj",
]);

const DOLLAR_PATTERNS = [/\$20,000/, /\$22,000/, /\$20K\b/, /\$22K\b/];

function stringifyPost(post: unknown): string {
  return JSON.stringify(post);
}

describe("blog rebate claims — expired federal 25C credit", () => {
  it("keeps the correction post at its original slug", () => {
    const post = blogPosts.find((p) => p.slug === "federal-25c-tax-credit-hvac-2026");
    expect(post).toBeDefined();
  });

  it("contains no live 25C claim outside the posts explaining its expiration", () => {
    const offenders = blogPosts
      .filter((p) => !EXPIRED_CREDIT_EXPLANATION_SLUGS.has(p.slug))
      .filter((p) => /25C/i.test(stringifyPost(p)))
      .map((p) => p.slug);
    expect(offenders).toEqual([]);
  });

  it("contains no fabricated $20K/$22K combined-rebate total outside known cost-range exceptions", () => {
    const offenders: string[] = [];
    for (const post of blogPosts) {
      if (LEGITIMATE_COST_RANGE_SLUGS.has(post.slug)) continue;
      const text = stringifyPost(post);
      for (const pattern of DOLLAR_PATTERNS) {
        if (pattern.test(text)) offenders.push(`${post.slug}: matched ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
