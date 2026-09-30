import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { blogFieldRegex, extractBlogField, extractBlogSlugs, extractBlogDates, extractBlogTitles, extractBlogMetaDescriptions } from "./blogSource";
import { insertBlogPostIntoSource, extractExistingTitles } from "./blogPostRendering";
import type { BlogPostData } from "../client/src/data/blogPosts";

const HAND_WRITTEN = `export const blogPosts: BlogPostData[] = [
  {
    slug: "old-hand-written-post",
    title: "An Old Post",
    metaDescription: "Old meta.",
    date: "January 1, 2026",
  },
];`;

const post: BlogPostData = {
  title: "What a Commercial HVAC Response SLA Should Include",
  slug: "commercial-hvac-response-sla-checklist",
  date: "September 26, 2026",
  readTime: "7 min read",
  category: "Commercial HVAC",
  metaDescription: "What a real commercial HVAC SLA should specify.",
  excerpt: "An overview.",
  sections: [{ type: "intro", content: "Hello." }],
} as BlogPostData;

describe("extractBlog* — bare AND quoted keys (the content lane's JSON-serialized posts 404ed without this)", () => {
  it("reads bare keys (hand-written posts), exactly as before", () => {
    expect(extractBlogSlugs(HAND_WRITTEN)).toEqual(["old-hand-written-post"]);
    expect(extractBlogTitles(HAND_WRITTEN)).toEqual(["An Old Post"]);
    expect(extractBlogMetaDescriptions(HAND_WRITTEN)).toEqual(["Old meta."]);
    expect(extractBlogDates(HAND_WRITTEN)).toEqual(["January 1, 2026"]);
  });

  it("reads quoted keys (JSON.stringify'd, content-lane posts)", () => {
    const src = `[\n  ${JSON.stringify(post, null, 2)},\n]`;
    expect(extractBlogSlugs(src)).toEqual(["commercial-hvac-response-sla-checklist"]);
    expect(extractBlogTitles(src)).toEqual(["What a Commercial HVAC Response SLA Should Include"]);
    expect(extractBlogMetaDescriptions(src)).toEqual(["What a real commercial HVAC SLA should specify."]);
    expect(extractBlogDates(src)).toEqual(["September 26, 2026"]);
  });

  it("REGRESSION: a post inserted by insertBlogPostIntoSource is found by the sitemap/manifest extractor, in file order, alongside the old ones", () => {
    const merged = insertBlogPostIntoSource(HAND_WRITTEN, post);
    // The old sitemap/generate-blog-meta regex — documents what was wrong.
    expect(Array.from(merged.matchAll(/slug:\s*"([^"]+)"/g)).map((m) => m[1])).toEqual(["old-hand-written-post"]);
    expect(extractBlogSlugs(merged)).toEqual(["commercial-hvac-response-sla-checklist", "old-hand-written-post"]);
  });

  it("keeps the parallel slug/title/meta/date arrays ALIGNED across mixed-shape posts (generate-blog-meta indexes them together)", () => {
    const merged = insertBlogPostIntoSource(HAND_WRITTEN, post);
    const slugs = extractBlogSlugs(merged), titles = extractBlogTitles(merged), metas = extractBlogMetaDescriptions(merged), dates = extractBlogDates(merged);
    expect(new Set([slugs.length, titles.length, metas.length, dates.length]).size).toBe(1);
    expect(slugs.map((s, i) => [s, titles[i]])).toEqual([
      ["commercial-hvac-response-sla-checklist", "What a Commercial HVAC Response SLA Should Include"],
      ["old-hand-written-post", "An Old Post"],
    ]);
  });

  it("accepts single-quoted keys and unescapes \\\" in values", () => {
    expect(extractBlogField(`{ 'slug': "a-b", title: "He said \\"hi\\"" }`, "slug")).toEqual(["a-b"]);
    expect(extractBlogField(`{ title: "He said \\"hi\\"" }`, "title")).toEqual(['He said "hi"']);
  });

  it("does not match a longer identifier or a non-string value", () => {
    expect(extractBlogSlugs(`{ canonicalslug: "nope", subslug: "nope", slugify: "nope" }`)).toEqual([]);
    expect(extractBlogSlugs(`{ slug: someVariable }`)).toEqual([]);
    expect(blogFieldRegex("slug").flags).toBe("g");
  });

  it("extractExistingTitles (duplicate-topic check) now also sees JSON-serialized titles, so a repeat of a content-lane post is caught", () => {
    const merged = insertBlogPostIntoSource(HAND_WRITTEN, post);
    expect(extractExistingTitles(merged)).toEqual(["What a Commercial HVAC Response SLA Should Include", "An Old Post"]);
  });
});

describe("the real blogPosts.ts", () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/data/blogPosts.ts"), "utf-8");

  it("every extractor finds the content-lane post from PR #151 and the four arrays line up", () => {
    const slugs = extractBlogSlugs(src);
    expect(slugs).toContain("commercial-hvac-response-sla-checklist");
    expect(slugs.length).toBeGreaterThan(90);
    expect(extractBlogTitles(src)).toContain("What a Commercial HVAC Response SLA Should Include");
    // generate-blog-meta zips slugs[i] with titles[i] and metas[i]: they must be the same length.
    expect(extractBlogTitles(src).length).toBe(slugs.length);
    expect(extractBlogMetaDescriptions(src).length).toBe(slugs.length);
    expect(extractBlogDates(src).length).toBe(slugs.length);
  });
});
