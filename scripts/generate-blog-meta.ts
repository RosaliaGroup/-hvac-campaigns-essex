/**
 * Extract blog post metadata to a JSON file for Netlify Edge Functions.
 * Run: npx tsx scripts/generate-blog-meta.ts
 * Called automatically during `pnpm build`.
 */
import fs from "fs";
import path from "path";
import { extractBlogSlugs, extractBlogTitles, extractBlogMetaDescriptions } from "../shared/blogSource";

const blogSrc = fs.readFileSync(
  path.resolve(import.meta.dirname, "..", "client", "src", "data", "blogPosts.ts"),
  "utf-8"
);

// Tolerant of quoted keys: content-lane posts are JSON-serialized ("slug": "…"). See shared/blogSource.ts.
const slugs = extractBlogSlugs(blogSrc);
const titles = extractBlogTitles(blogSrc);
const metas = extractBlogMetaDescriptions(blogSrc);

const posts = slugs.map((slug, i) => ({
  slug,
  title: titles[i] ?? slug,
  metaDescription: metas[i] ?? "",
}));

const outPath = path.resolve(import.meta.dirname, "..", "netlify", "edge-functions", "blog-meta.json");
fs.writeFileSync(outPath, JSON.stringify(posts, null, 2), "utf-8");
console.log(`[blog-meta] Extracted ${posts.length} posts → ${outPath}`);
