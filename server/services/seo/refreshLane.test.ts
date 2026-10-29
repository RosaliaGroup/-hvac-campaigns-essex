import { describe, expect, it } from "vitest";
import { applyRefreshLintRules } from "./contentPipeline";
import { buildRefreshSystemPrompt, isResidentialPost, pinRefreshIdentity } from "./refreshDrafting";
import { VERIFIED_FACTS } from "../../../shared/verifiedFacts";
import { blogPosts, type BlogPostData } from "../../../client/src/data/blogPosts";
import type { ContentLintResult } from "../../../shared/contentLinter";

const lint = (...codes: Array<[string, string, "block" | "warn"]>): ContentLintResult => ({
  findings: codes.map(([code, message, severity]) => ({ code, message, severity })),
  passes: codes.every(([, , sev]) => sev !== "block"),
});

describe("refresh lane lint adjustments", () => {
  const opts = { ownTitle: "x", maxWords: 2300, residential: true };

  it("drops only the new-post rules a refresh can't meet; claim rules stay blocking", () => {
    const out = applyRefreshLintRules(lint(
      ["no_b2b_link", "Body links to no B2B page", "block"],
      ["word_count", "Body is 1900 words (must be 900-1400).", "block"],
      ["unverified_dollar_figure", 'Dollar figure "$7,000" is not present in any verified incentive.', "block"],
    ), opts);
    expect(out.findings.map((f) => f.code)).toEqual(["unverified_dollar_figure"]);
    expect(out.passes).toBe(false);
  });

  it("passes when the only findings were relaxed ones", () => {
    expect(applyRefreshLintRules(lint(["no_b2b_link", "m", "block"], ["word_count", "Body is 1500 words (must be 900-1400).", "block"]), opts).passes).toBe(true);
  });

  it("keeps word-count limits outside the refresh window, and the B2B link rule for commercial posts", () => {
    expect(applyRefreshLintRules(lint(["word_count", "Body is 2600 words (must be 900-1400).", "block"]), opts).passes).toBe(false);
    expect(applyRefreshLintRules(lint(["word_count", "Body is 700 words (must be 900-1400).", "block"]), opts).passes).toBe(false);
    expect(applyRefreshLintRules(lint(["no_b2b_link", "m", "block"]), { ...opts, residential: false }).passes).toBe(false);
  });
});

describe("refresh drafting", () => {
  const rebatePost = blogPosts.find((p) => p.slug === "nj-heat-pump-rebates-2026")!;

  it("keeps the post's identity: slug, category, original date; stamps updatedDate", () => {
    const draft = { ...rebatePost, slug: "something-else", category: "Other", date: "January 1, 2030", title: "New title" } as BlogPostData;
    const pinned = pinRefreshIdentity(draft, rebatePost, "October 29, 2026");
    expect(pinned).toMatchObject({ slug: rebatePost.slug, category: rebatePost.category, date: rebatePost.date, updatedDate: "October 29, 2026", title: "New title" });
  });

  it("classifies the rebate guides as residential and commercial guides as not", () => {
    expect(isResidentialPost(rebatePost)).toBe(true);
    const commercial = blogPosts.find((p) => /commercial|property manager/i.test(p.category + p.title));
    if (commercial) expect(isResidentialPost(commercial)).toBe(false);
  });

  it("prompt pins the slug, allows only verified figures and bans the expired programs", () => {
    const prompt = buildRefreshSystemPrompt({ current: rebatePost, reason: "clicks down 96%", maxWords: 2000 }, VERIFIED_FACTS);
    expect(prompt).toContain(`Keep "slug" exactly "${rebatePost.slug}"`);
    expect(prompt).toContain("ONLY amounts that appear in VERIFIED_FACTS.incentives");
    expect(prompt).toContain("HEEHRA");
    expect(prompt).toContain("mechanicalenterprise.com/contact");
    expect(prompt).toContain("950-2000 words");
    expect(prompt).toContain("Why it was picked: clicks down 96%");
  });
});
