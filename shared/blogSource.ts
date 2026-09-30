/**
 * Reading string fields out of client/src/data/blogPosts.ts as RAW SOURCE.
 *
 * Posts in that file come in two shapes: hand-written entries use bare keys
 * (`slug: "x"`), while the content lane inserts entries serialized with
 * JSON.stringify (shared/blogPostRendering.ts insertBlogPostIntoSource), whose
 * keys are QUOTED (`"slug": "x"`). The build scripts used `/slug:\s*"…"/`, which
 * does not match a quoted key — so a content-lane post was silently absent from
 * the sitemap and routes-manifest.json (the edge function 404s any route not in
 * that manifest: PR #151's live page returned HTTP 404), and in
 * generate-blog-meta.ts the parallel slug/title/meta arrays would have
 * misaligned for every later post. One tolerant extractor, used everywhere.
 */

/** Matches `key: "value"` or `"key": "value"` (single-quoted keys too); not inside a longer identifier (`canonicalslug:`). Capture group 1 is the raw (still-escaped) value. */
export function blogFieldRegex(key: string): RegExp {
  return new RegExp(`(?<![\\w$])["']?${key}["']?\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g");
}

/** Every value of `key` in `source`, in file order, with `\"` unescaped. */
export function extractBlogField(source: string, key: string): string[] {
  return Array.from(source.matchAll(blogFieldRegex(key))).map((m) => m[1].replace(/\\"/g, '"'));
}

export const extractBlogSlugs = (source: string) => extractBlogField(source, "slug");
export const extractBlogDates = (source: string) => extractBlogField(source, "date");
export const extractBlogTitles = (source: string) => extractBlogField(source, "title");
export const extractBlogMetaDescriptions = (source: string) => extractBlogField(source, "metaDescription");
