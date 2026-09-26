import { describe, it, expect } from "vitest";
import { countPostStructure, renderPostPlainText, extractInternalLinkPaths, insertBlogPostIntoSource, extractExistingTitles } from "./blogPostRendering";
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
