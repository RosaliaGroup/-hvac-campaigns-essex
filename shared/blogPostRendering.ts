/**
 * Pure helpers for working with BlogPostData (client/src/data/blogPosts.ts) —
 * structure counting for the extended content linter, plain-text rendering
 * for claims scanning, internal-link extraction, and TS-source insertion for
 * the content pipeline's PR commit (docs/seo-automation-spec.md Part 2).
 *
 * Type-only import from client/src/data/blogPosts.ts — erased at compile
 * time, so this stays a real dependency-direction-safe `shared/` module (see
 * shared/verifiedFacts.ts's comment on the same concern) despite reusing the
 * client's own post shape rather than a duplicate type.
 */
import { extractBlogTitles } from "./blogSource";
import type { BlogPostData, BlogSection } from "../client/src/data/blogPosts";

export type PostStructureCounts = {
  h1Count: number; // BlogPostData has no explicit H1 section type — `title` IS the page's one H1, always exactly 1.
  h2Count: number;
  h3Count: number; // BlogSection has no H3 variant at all — always 0 by construction.
  faqQuestionCount: number;
  wordCount: number;
};

export function countPostStructure(post: BlogPostData): PostStructureCounts {
  const h2Count = post.sections.filter((s) => s.type === "h2").length;
  const faqQuestionCount = post.faqSchema?.length ?? 0;
  const bodyText = renderPostPlainText(post);
  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
  return { h1Count: 1, h2Count, h3Count: 0, faqQuestionCount, wordCount };
}

function sectionText(s: BlogSection): string {
  switch (s.type) {
    case "intro":
    case "h2":
    case "paragraph":
    case "stat_box":
      return s.content;
    case "checklist":
    case "numbered_list":
      return s.items.join(" ");
    case "cta_box":
      return s.content;
  }
}

/** Flattened plain text of the whole post (title + excerpt + every section + FAQ) for claims scanning / word count. */
export function renderPostPlainText(post: BlogPostData): string {
  const parts = [post.title, post.excerpt, ...post.sections.map(sectionText)];
  if (post.faqSchema) {
    for (const f of post.faqSchema) parts.push(f.question, f.answer);
  }
  return parts.join(" ");
}

const MD_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

/** Path-only internal links found in markdown-style `[text](url)` links + cta_box buttonUrls. Absolute mechanicalenterprise.com URLs are normalized to their path; external URLs are dropped. */
export function extractInternalLinkPaths(post: BlogPostData): string[] {
  const urls: string[] = [];
  for (const s of post.sections) {
    if (s.type === "cta_box") urls.push(s.buttonUrl);
    const text = sectionText(s);
    for (const m of Array.from(text.matchAll(MD_LINK_RE))) urls.push(m[1]);
  }
  const paths: string[] = [];
  for (const url of urls) {
    if (url.startsWith("/")) {
      paths.push(url.split("#")[0]);
      continue;
    }
    const m = url.match(/^https?:\/\/(?:www\.)?mechanicalenterprise\.com(\/[^\s#]*)?/i);
    if (m) paths.push((m[1] || "/").split("#")[0]);
    // External (non-mechanicalenterprise) URLs are not internal links — skipped.
  }
  return Array.from(new Set(paths));
}

const BLOG_POSTS_ARRAY_MARKER = "export const blogPosts: BlogPostData[] = [";

/**
 * Insert `post` as a new entry at the TOP of the blogPosts array in
 * `sourceText` (client/src/data/blogPosts.ts's raw file content). The object
 * is serialized via JSON.stringify — valid JS/TS object-literal syntax (JSON
 * is a syntactic subset), chosen over hand-rolled formatting to guarantee
 * correctness over cosmetic style-matching for machine-generated content.
 * Throws if the marker isn't found (the file's shape changed unexpectedly —
 * better to fail loudly than corrupt the source).
 */
export function insertBlogPostIntoSource(sourceText: string, post: BlogPostData): string {
  const idx = sourceText.indexOf(BLOG_POSTS_ARRAY_MARKER);
  if (idx === -1) {
    throw new Error(`Could not find "${BLOG_POSTS_ARRAY_MARKER}" in blogPosts.ts — its shape may have changed.`);
  }
  const insertAt = idx + BLOG_POSTS_ARRAY_MARKER.length;
  const entry = `\n  ${JSON.stringify(post, null, 2).split("\n").join("\n  ")},\n`;
  return sourceText.slice(0, insertAt) + entry + sourceText.slice(insertAt);
}

/** All existing posts' titles (for the duplicate-topic check) — parsed from the raw source rather than requiring a live import (server-side, no bundler). */
export function extractExistingTitles(sourceText: string): string[] {
  // Tolerant of quoted keys, so a duplicate of an earlier CONTENT-LANE post (JSON-serialized, "title": "…") is detected too.
  return extractBlogTitles(sourceText);
}
