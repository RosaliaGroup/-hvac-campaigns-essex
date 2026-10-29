/**
 * In-place replacement of one post inside client/src/data/blogPosts.ts's raw source, for the content
 * lane's refresh path. The file mixes hand-written TS object literals (unquoted keys, older posts) and
 * JSON-serialized entries (content-lane posts), so the post is located by its slug and its enclosing
 * `{ … }` is found with a small scanner that skips strings and comments — braces inside post text never
 * count. Everything outside that one object is left byte-for-byte unchanged, so reverting the PR restores
 * the original post exactly.
 */
import type { BlogPostData } from "../client/src/data/blogPosts";
import { normalizeBlogPost } from "./blogPostRendering";

export type PostSpan = { start: number; end: number };

/** Index just past the string/comment that starts at `i`, or -1 if `i` doesn't start one. */
function skipNonCode(src: string, i: number): number {
  const c = src[i];
  if (c === '"' || c === "'" || c === "`") {
    let j = i + 1;
    while (j < src.length) {
      if (src[j] === "\\") { j += 2; continue; }
      if (src[j] === c) return j + 1;
      j++;
    }
    throw new Error("Unterminated string in blogPosts.ts source.");
  }
  if (c === "/" && src[i + 1] === "/") {
    const nl = src.indexOf("\n", i);
    return nl === -1 ? src.length : nl + 1;
  }
  if (c === "/" && src[i + 1] === "*") {
    const close = src.indexOf("*/", i + 2);
    if (close === -1) throw new Error("Unterminated comment in blogPosts.ts source.");
    return close + 2;
  }
  return -1;
}

/**
 * Span of the top-level array element (a `{ … }` object) whose own `slug` is `slug`. Walks the array
 * once, element by element, so a matching slug string inside some OTHER post's text can't be mistaken
 * for it. Returns null when no post has that slug.
 */
export function findBlogPostSpan(src: string, slug: string, marker = "export const blogPosts: BlogPostData[] = ["): PostSpan | null {
  const at = src.indexOf(marker);
  if (at === -1) throw new Error(`Could not find "${marker}" in blogPosts.ts — its shape may have changed.`);
  const slugRe = new RegExp(`^\\s*(?:"slug"|slug)\\s*:\\s*(["'])${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`);
  let i = at + marker.length;
  while (i < src.length) {
    const skipped = skipNonCode(src, i);
    if (skipped !== -1) { i = skipped; continue; }
    const c = src[i];
    if (c === "]") return null; // end of the array
    if (c !== "{") { i++; continue; }
    // One element: find its matching close brace, noting whether one of its depth-1 keys is our slug.
    const start = i;
    let depth = 0;
    let matched = false;
    let j = i;
    while (j < src.length) {
      const s = skipNonCode(src, j);
      if (s !== -1) { j = s; continue; }
      const ch = src[j];
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) break;
      }
      // A key of THIS object starts right after its opening brace or a depth-1 comma.
      if (depth === 1 && !matched && (ch === "{" || ch === ",")) {
        if (slugRe.test(src.slice(j + 1, j + 1 + 400))) matched = true;
      }
      j++;
    }
    if (depth !== 0) throw new Error("Unbalanced braces in blogPosts.ts source.");
    if (matched) return { start, end: j + 1 };
    i = j + 1;
  }
  return null;
}

/** Replace the post with `slug` by `post` (serialized like content-lane posts). Throws if the slug isn't there. */
export function replaceBlogPostInSource(src: string, slug: string, post: BlogPostData): string {
  const span = findBlogPostSpan(src, slug);
  if (!span) throw new Error(`No post with slug "${slug}" in blogPosts.ts.`);
  // Re-indent to the column the original object started at, so the diff stays readable.
  const lineStart = src.lastIndexOf("\n", span.start) + 1;
  const indent = src.slice(lineStart, span.start).match(/^\s*/)?.[0] ?? "  ";
  const serialized = JSON.stringify(normalizeBlogPost(post), null, 2).split("\n").join(`\n${indent}`);
  return src.slice(0, span.start) + serialized + src.slice(span.end);
}
