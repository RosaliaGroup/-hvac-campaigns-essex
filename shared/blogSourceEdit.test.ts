import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { findBlogPostSpan, replaceBlogPostInSource } from "./blogSourceEdit";
import { blogPosts, type BlogPostData } from "../client/src/data/blogPosts";

const SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/data/blogPosts.ts"), "utf-8");

const fake = (slug: string): BlogPostData => ({
  title: "Refreshed: braces { } and \"quotes\" and 'apostrophes'",
  slug, date: "March 31, 2026", updatedDate: "October 29, 2026", readTime: "9 min read", category: "Rebates & Incentives",
  metaDescription: "m", excerpt: "e", sections: [{ type: "intro", content: "slug: \"other-post\" inside text must not match" }],
});

describe("blogSourceEdit on the real blogPosts.ts", () => {
  it("finds every post by slug (hand-written and JSON-serialized entries alike)", () => {
    for (const p of blogPosts) {
      const span = findBlogPostSpan(SRC, p.slug);
      expect(span, p.slug).not.toBeNull();
      expect(SRC.slice(span!.start, span!.end).startsWith("{")).toBe(true);
      expect(SRC.slice(span!.start, span!.end).endsWith("}")).toBe(true);
    }
  });

  it("returns null for an unknown slug", () => {
    expect(findBlogPostSpan(SRC, "no-such-post")).toBeNull();
  });

  it("replaces exactly one post and leaves the rest of the file byte-identical", () => {
    for (const slug of ["nj-heat-pump-rebates-2026", blogPosts[0].slug, blogPosts[blogPosts.length - 1].slug]) {
      const span = findBlogPostSpan(SRC, slug)!;
      const out = replaceBlogPostInSource(SRC, slug, fake(slug));
      expect(out.slice(0, span.start)).toBe(SRC.slice(0, span.start));
      expect(out.endsWith(SRC.slice(span.end))).toBe(true);
      // Still exactly one entry with that slug, and every other post still findable.
      const again = findBlogPostSpan(out, slug)!;
      expect(out.slice(again.start, again.end)).toContain("Refreshed: braces");
      for (const p of blogPosts) expect(findBlogPostSpan(out, p.slug), p.slug).not.toBeNull();
    }
  });

  it("the replaced entry is a valid object literal with the new content", () => {
    const slug = "nj-heat-pump-rebates-2026";
    const out = replaceBlogPostInSource(SRC, slug, fake(slug));
    const span = findBlogPostSpan(out, slug)!;
    const parsed = JSON.parse(out.slice(span.start, span.end));
    expect(parsed.slug).toBe(slug);
    expect(parsed.updatedDate).toBe("October 29, 2026");
  });

  it("throws rather than guessing when the slug is missing", () => {
    expect(() => replaceBlogPostInSource(SRC, "no-such-post", fake("x"))).toThrow(/No post with slug/);
  });
});
