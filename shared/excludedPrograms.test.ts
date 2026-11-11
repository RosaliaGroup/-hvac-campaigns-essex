import { describe, it, expect } from "vitest";
import { KEPT_REBATE_TOPIC_POSTS, isKeptRebateTopicPost, isRebateWordingExemptPath, REBATE_PROMO_RE } from "./excludedPrograms";
import { blogPosts } from "../client/src/data/blogPosts";

describe("kept rebate-topic posts (owner 2026-11-10: leave them as-is)", () => {
  it("lists 47 unique slugs that all exist as blog posts", () => {
    expect(KEPT_REBATE_TOPIC_POSTS).toHaveLength(47);
    expect(new Set(KEPT_REBATE_TOPIC_POSTS).size).toBe(47);
    const slugs = new Set(blogPosts.map((p) => p.slug));
    for (const s of KEPT_REBATE_TOPIC_POSTS) expect(slugs.has(s), s).toBe(true);
  });
  it("matches a slug, blog/slug or /blog/slug", () => {
    expect(isKeptRebateTopicPost("hvac-rebates-essex-county-nj")).toBe(true);
    expect(isKeptRebateTopicPost("blog/hvac-rebates-essex-county-nj")).toBe(true);
    expect(isKeptRebateTopicPost("/blog/hvac-rebates-essex-county-nj/")).toBe(true);
    expect(isKeptRebateTopicPost("/blog/heat-pump-installation-nj-guide")).toBe(false);
  });
  it("exempts only kept posts and commercial / Direct Install pages from the rebate wording rule", () => {
    expect(isRebateWordingExemptPath("/blog/pseg-rebate-application-process")).toBe(true);
    expect(isRebateWordingExemptPath("/direct-install")).toBe(true);
    expect(isRebateWordingExemptPath("/direct-install/restaurants")).toBe(true);
    expect(isRebateWordingExemptPath("/commercial")).toBe(true);
    expect(isRebateWordingExemptPath("/")).toBe(false);
    expect(isRebateWordingExemptPath("/hvac-montclair-nj")).toBe(false);
    expect(isRebateWordingExemptPath("/blog/heat-pump-vs-gas-furnace-nj-2026")).toBe(false);
  });
  it("REBATE_PROMO_RE catches the promo words but not ordinary text", () => {
    for (const t of ["rebates", "Rebate", "incentive", "tax credits", "25C", "Clean Heat", "on-bill", "OBR"]) expect(REBATE_PROMO_RE.test(t), t).toBe(true);
    for (const t of ["installation", "debate", "monthly bill", "credit card"]) expect(REBATE_PROMO_RE.test(t), t).toBe(false);
  });
});
