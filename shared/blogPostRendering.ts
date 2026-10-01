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
  // Defensive: a model-drafted section can be missing its text (or use an unknown type). That must never crash the
  // pipeline with a TypeError ("Cannot read properties of undefined (reading 'matchAll')" took a content drain down) —
  // contentDrafting.parseContentDraftResponse rejects such drafts as a retryable parse error, and this is the backstop.
  const x = s as { content?: unknown; items?: unknown };
  switch (s.type) {
    case "intro":
    case "h2":
    case "paragraph":
    case "stat_box":
    case "cta_box":
      return typeof x.content === "string" ? x.content : "";
    case "checklist":
    case "numbered_list":
      return Array.isArray(x.items) ? x.items.filter((i): i is string => typeof i === "string").join("\n") : "";
    default:
      return "";
  }
}

/** Flattened plain text of the whole post (title + excerpt + every section + FAQ) for claims scanning / word count. */
export function renderPostPlainText(post: BlogPostData): string {
  const parts = [post.title, post.excerpt, ...post.sections.map(sectionText)];
  if (post.faqSchema) {
    for (const f of post.faqSchema) parts.push(String(f?.question ?? ""), String(f?.answer ?? ""));
  }
  // Newline-separated so every heading, paragraph, checklist item and FAQ entry is its own unit: the claims linters split
  // sentences on newlines too, so an unpunctuated "What to send us" list can no longer be glued into one giant "sentence".
  return parts.join("\n");
}

const MD_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

/** Path-only internal links found in markdown-style `[text](url)` links + cta_box buttonUrls. Absolute mechanicalenterprise.com URLs are normalized to their path; external URLs are dropped. */
export function extractInternalLinkPaths(post: BlogPostData): string[] {
  const urls: string[] = [];
  for (const s of post.sections) {
    if (s.type === "cta_box" && typeof s.buttonUrl === "string") urls.push(s.buttonUrl);
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
 * Reduce a model-drafted post to EXACTLY the fields BlogPostData allows. The model sometimes adds a stray key — PR #162's
 * post gave a `checklist` section a `"content"` label (the list's heading), which is not a field of that section type.
 * The renderer ignored it, but the TypeScript object literal in blogPosts.ts then failed `tsc` ("'content' does not exist in
 * type checklist") on main. Extra keys carry no meaning the site renders, so they are dropped rather than shipped.
 */
export function normalizeBlogPost(post: BlogPostData): BlogPostData {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const sections = post.sections.map((raw): BlogSection => {
    const s = raw as unknown as Record<string, unknown>;
    switch (s.type) {
      case "checklist":
      case "numbered_list":
        return { type: s.type, items: Array.isArray(s.items) ? s.items.filter((i): i is string => typeof i === "string") : [] };
      case "cta_box":
        return { type: "cta_box", content: str(s.content), buttonText: str(s.buttonText), buttonUrl: str(s.buttonUrl) };
      default:
        return { type: s.type as "intro" | "h2" | "paragraph" | "stat_box", content: str(s.content) };
    }
  });
  const out: BlogPostData = {
    title: post.title, slug: post.slug, date: post.date, readTime: post.readTime, category: post.category,
    metaDescription: post.metaDescription, excerpt: post.excerpt, sections,
  };
  if (Array.isArray(post.faqSchema)) out.faqSchema = post.faqSchema.map((f) => ({ question: str(f?.question), answer: str(f?.answer) }));
  return out;
}

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
  const entry = `\n  ${JSON.stringify(normalizeBlogPost(post), null, 2).split("\n").join("\n  ")},\n`;
  return sourceText.slice(0, insertAt) + entry + sourceText.slice(insertAt);
}

/** All existing posts' titles (for the duplicate-topic check) — parsed from the raw source rather than requiring a live import (server-side, no bundler). */
export function extractExistingTitles(sourceText: string): string[] {
  // Tolerant of quoted keys, so a duplicate of an earlier CONTENT-LANE post (JSON-serialized, "title": "…") is detected too.
  return extractBlogTitles(sourceText);
}
