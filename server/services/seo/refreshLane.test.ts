import { describe, expect, it } from "vitest";
import { applyRefreshLintRules } from "./contentPipeline";
import { buildRefreshSystemPrompt, isResidentialPost, pinRefreshIdentity, stripUnverifiedAmounts } from "./refreshDrafting";
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

describe("unverified amounts never reach the model", () => {
  const facts = { incentives: [{ program: "p", amountText: "Up to $16,000", verifiedOn: "x", source: "s" }] };

  it("replaces unverified dollar amounts and keeps verified ones", () => {
    const out = stripUnverifiedAmounts({ a: "Install runs $8,000 to $14,000; rebates up to $16,000. Save $2k or $1.5 million.", b: ["$7,000 Whole-Home"] }, facts);
    expect(out.a).toBe("Install runs [amount removed] to [amount removed]; rebates up to $16,000. Save [amount removed] or [amount removed].");
    expect(out.b[0]).toBe("[amount removed] Whole-Home");
  });

  it("scrubs the real rebate guide and the prompt built from it", () => {
    const post = blogPosts.find((p) => p.slug === "heat-pump-vs-gas-furnace-nj-2026") ?? blogPosts.find((p) => p.slug === "nj-heat-pump-rebates-2026")!;
    const prompt = buildRefreshSystemPrompt({ current: post, maxWords: 2000 }, VERIFIED_FACTS);
    const currentJson = prompt.slice(prompt.indexOf("CURRENT POST"), prompt.indexOf("VERIFIED FACTS"));
    const verified = VERIFIED_FACTS.incentives.map((i) => i.amountText);
    for (const m of currentJson.match(/\$\s?\d[\d,]*/g) ?? []) expect(verified.some((v) => v.includes(m.replace(/,+$/, "")))).toBe(true);
    expect(prompt).toContain('"hear"');
  });
});

describe("new-post drafter knows the checker's blocked words", () => {
  it("lists superlatives like 'cheapest' and the competitor names", async () => {
    const { buildContentSystemPrompt } = await import("./contentDrafting");
    const prompt = buildContentSystemPrompt({ id: 41, title: "NJ Commercial HVAC Guide: affordable hvac new jersey", targetQuery: "affordable hvac new jersey", audience: "NJ property managers", brief: "b" } as never, VERIFIED_FACTS);
    expect(prompt).toContain('"cheapest"');
    expect(prompt).toContain('"hear"');
    expect(prompt).toContain("A.J. Perri");
  });
});

describe("refresh prompt warns about fact-checker rejects", () => {
  it("bans unverified credentials, brands, efficiency thresholds and utility territory", () => {
    const post = blogPosts.find((p) => p.slug === "nj-heat-pump-rebates-2026")!;
    const prompt = buildRefreshSystemPrompt({ current: post, maxWords: 2000 }, VERIFIED_FACTS);
    for (const w of ["license", "brand names", "SEER2", "which towns or counties a utility serves", "serviceCounties"]) expect(prompt).toContain(w);
  });
});
