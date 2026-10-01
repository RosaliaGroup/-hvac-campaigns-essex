import { describe, it, expect } from "vitest";
import { countPostStructure, renderPostPlainText, extractInternalLinkPaths, insertBlogPostIntoSource, extractExistingTitles, normalizeBlogPost } from "./blogPostRendering";
import type { BlogPostData } from "../client/src/data/blogPosts";

const samplePost: BlogPostData = {
  title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits",
  slug: "ptac-vs-mini-split-vs-vrf-multifamily",
  date: "September 26, 2026",
  readTime: "8 min read",
  category: "Commercial",
  metaDescription: "Comparing PTAC, mini-split, and VRF systems for multifamily HVAC retrofits in NJ.",
  excerpt: "Property managers choosing between PTAC, mini-split, and VRF face real tradeoffs.",
  sections: [
    { type: "intro", content: "Multifamily owners in [Jersey City](/hvac-jersey-city-nj) often ask which system fits best." },
    { type: "h2", content: "PTAC: The Incumbent" },
    { type: "paragraph", content: "PTAC units are common in older buildings." },
    { type: "h2", content: "Mini-Split Considerations" },
    { type: "checklist", items: ["Lower noise", "Higher upfront cost", "Zone-by-zone control"] },
    { type: "h2", content: "VRF for Larger Properties" },
    { type: "numbered_list", items: ["Assess load", "Design zoning", "Install and commission"] },
    { type: "cta_box", content: "Talk to our commercial team.", buttonText: "Get a Commercial Quote", buttonUrl: "https://mechanicalenterprise.com/commercial" },
  ],
};

describe("countPostStructure", () => {
  it("h1Count is always 1 (the title), h3Count is always 0 (no such section type)", () => {
    const counts = countPostStructure(samplePost);
    expect(counts.h1Count).toBe(1);
    expect(counts.h3Count).toBe(0);
  });

  it("counts h2 sections correctly", () => {
    expect(countPostStructure(samplePost).h2Count).toBe(3);
  });

  it("counts FAQ questions from faqSchema, 0 when absent", () => {
    expect(countPostStructure(samplePost).faqQuestionCount).toBe(0);
    const withFaq = { ...samplePost, faqSchema: [{ question: "Q1", answer: "A1" }, { question: "Q2", answer: "A2" }] };
    expect(countPostStructure(withFaq).faqQuestionCount).toBe(2);
  });

  it("word count is a positive number covering title, excerpt, and every section", () => {
    expect(countPostStructure(samplePost).wordCount).toBeGreaterThan(20);
  });
});

describe("renderPostPlainText", () => {
  it("includes text from every section type, checklist/numbered_list items joined", () => {
    const text = renderPostPlainText(samplePost);
    expect(text).toContain("PTAC units are common");
    expect(text).toContain("Lower noise");
    expect(text).toContain("Assess load");
    expect(text).toContain("Talk to our commercial team");
  });
});

describe("extractInternalLinkPaths", () => {
  it("extracts a markdown-link path unchanged", () => {
    expect(extractInternalLinkPaths(samplePost)).toContain("/hvac-jersey-city-nj");
  });

  it("normalizes an absolute mechanicalenterprise.com URL (cta_box buttonUrl) to its path", () => {
    expect(extractInternalLinkPaths(samplePost)).toContain("/commercial");
  });

  it("drops external (non-mechanicalenterprise) URLs", () => {
    const post = { ...samplePost, sections: [{ type: "paragraph" as const, content: "See [Google](https://google.com) for more." }] };
    expect(extractInternalLinkPaths(post)).toEqual([]);
  });

  it("dedupes repeated links", () => {
    const post = {
      ...samplePost,
      sections: [
        { type: "paragraph" as const, content: "[A](/commercial) and again [B](/commercial)" },
      ],
    };
    expect(extractInternalLinkPaths(post)).toEqual(["/commercial"]);
  });
});

describe("insertBlogPostIntoSource / extractExistingTitles", () => {
  const fakeSource = `export type BlogPostData = { title: string };\n\nexport const blogPosts: BlogPostData[] = [\n  {\n    title: "Existing Post One",\n    slug: "existing-one",\n  },\n];\n`;

  it("inserts the new post right after the array marker", () => {
    const updated = insertBlogPostIntoSource(fakeSource, samplePost);
    const idx = updated.indexOf("export const blogPosts: BlogPostData[] = [");
    const newEntryIdx = updated.indexOf('"slug": "ptac-vs-mini-split-vs-vrf-multifamily"');
    const existingEntryIdx = updated.indexOf('"existing-one"');
    expect(newEntryIdx).toBeGreaterThan(idx);
    expect(existingEntryIdx).toBeGreaterThan(newEntryIdx); // new post is inserted BEFORE the existing one (top of the array)
  });

  it("serializes the post as valid, round-trippable JSON (a JSON object literal is valid JS/TS syntax)", () => {
    const updated = insertBlogPostIntoSource(fakeSource, samplePost);
    // Re-extract exactly what was inserted: everything between the marker and
    // the original file's next line, minus the reindentation + trailing comma
    // insertBlogPostIntoSource adds around it.
    const marker = "export const blogPosts: BlogPostData[] = [";
    const start = updated.indexOf(marker) + marker.length;
    const end = updated.indexOf('  {\n    title: "Existing');
    const inserted = updated.slice(start, end).trim().replace(/,\s*$/, "").replace(/\n  /g, "\n");
    expect(JSON.parse(inserted)).toEqual(samplePost);
  });

  it("throws if the array marker isn't found", () => {
    expect(() => insertBlogPostIntoSource("no marker here", samplePost)).toThrow(/Could not find/);
  });

  it("extractExistingTitles finds every title in the source", () => {
    expect(extractExistingTitles(fakeSource)).toEqual(["Existing Post One"]);
  });
});

describe("renderPostPlainText / extractInternalLinkPaths never throw on a malformed section (regression: TypeError reading 'matchAll' of undefined)", () => {
  const base = { title: "T", slug: "s", date: "d", readTime: "r", category: "c", metaDescription: "m", excerpt: "e" };
  const bad = (sections: unknown[], faq?: unknown[]) => ({ ...base, sections, ...(faq ? { faqSchema: faq } : {}) }) as unknown as BlogPostData;

  it("survives sections missing content / items / buttonUrl, unknown types, and a half-filled FAQ", () => {
    const post = bad(
      [{ type: "intro" }, { type: "checklist" }, { type: "cta_box", content: "x" }, { type: "image", content: "y" }, { type: "paragraph", content: "ok [a](/hvac-newark-nj)" }],
      [{ question: "only a question" }, null],
    );
    expect(() => renderPostPlainText(post)).not.toThrow();
    expect(() => extractInternalLinkPaths(post)).not.toThrow();
    expect(() => countPostStructure(post)).not.toThrow();
    expect(extractInternalLinkPaths(post)).toEqual(["/hvac-newark-nj"]);
  });

  it("still reads a well-formed section exactly as before", () => {
    const post = bad([{ type: "checklist", items: ["one", "two"] }, { type: "cta_box", content: "go", buttonText: "b", buttonUrl: "https://mechanicalenterprise.com/commercial" }]);
    expect(renderPostPlainText(post)).toContain("one\ntwo");
    expect(extractInternalLinkPaths(post)).toEqual(["/commercial"]);
  });
});

describe("normalizeBlogPost — only the fields BlogPostData allows (a stray checklist 'content' label broke tsc on main in PR #162)", () => {
  const base = { title: "T", slug: "s", date: "d", readTime: "r", category: "c", metaDescription: "m", excerpt: "e" };

  it("REGRESSION: drops the stray `content` on a checklist (the exact PR #162 shape) and keeps the items", () => {
    const post = {
      ...base,
      sections: [{ type: "checklist", items: ["a", "b"], content: "What to Send Us Before Requesting a Portfolio Bid" }],
    } as unknown as BlogPostData;
    const out = normalizeBlogPost(post);
    expect(out.sections).toEqual([{ type: "checklist", items: ["a", "b"] }]);
    expect(JSON.stringify(out)).not.toContain("What to Send Us Before");
  });

  it("drops unknown keys at the post, section and FAQ level, for every section type", () => {
    const post = {
      ...base, extraTop: 1, confidence: 0.9,
      sections: [
        { type: "intro", content: "i", note: "x" }, { type: "h2", content: "h", level: 2 }, { type: "paragraph", content: "p", items: ["stray"] },
        { type: "stat_box", content: "s", source: "y" }, { type: "numbered_list", items: ["1"], content: "label" },
        { type: "cta_box", content: "c", buttonText: "b", buttonUrl: "https://mechanicalenterprise.com/commercial", style: "big" },
      ],
      faqSchema: [{ question: "Q?", answer: "A.", id: 3 }],
    } as unknown as BlogPostData;
    const out = normalizeBlogPost(post) as unknown as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(["category", "date", "excerpt", "faqSchema", "metaDescription", "readTime", "sections", "slug", "title"]);
    const secs = out.sections as Array<Record<string, unknown>>;
    expect(secs.map((s) => Object.keys(s).sort())).toEqual([
      ["content", "type"], ["content", "type"], ["content", "type"], ["content", "type"], ["items", "type"], ["buttonText", "buttonUrl", "content", "type"],
    ]);
    expect(out.faqSchema).toEqual([{ question: "Q?", answer: "A." }]);
  });

  it("leaves a well-formed post untouched (same JSON), and omits faqSchema when there is none", () => {
    const post = { ...base, sections: [{ type: "intro", content: "hi" }, { type: "checklist", items: ["x"] }] } as unknown as BlogPostData;
    expect(JSON.stringify(normalizeBlogPost(post))).toBe(JSON.stringify(post));
    expect("faqSchema" in normalizeBlogPost(post)).toBe(false);
  });

  it("insertBlogPostIntoSource writes the normalized post — no stray key can reach blogPosts.ts", () => {
    const src = "export const blogPosts: BlogPostData[] = [\n];";
    const post = { ...base, sections: [{ type: "checklist", items: ["a"], content: "label that must not ship" }] } as unknown as BlogPostData;
    const out = insertBlogPostIntoSource(src, post);
    expect(out).not.toContain("label that must not ship");
    expect(out).toContain('"items"');
  });
});
