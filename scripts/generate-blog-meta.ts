/**
 * Extract blog post metadata to a JSON file for Netlify Edge Functions.
 * Run: npx tsx scripts/generate-blog-meta.ts
 * Called automatically during `pnpm build`.
 */
import fs from "fs";
import path from "path";

const blogSrc = fs.readFileSync(
  path.resolve(import.meta.dirname, "..", "client", "src", "data", "blogPosts.ts"),
  "utf-8"
);

const slugs = Array.from(blogSrc.matchAll(/slug:\s*"([^"]+)"/g)).map(m => m[1]);
const titles = Array.from(blogSrc.matchAll(/title:\s*"([^"]+)"/g)).map(m => m[1]);
const metas = Array.from(blogSrc.matchAll(/metaDescription:\s*"([^"]+)"/g)).map(m => m[1]);

const posts = slugs.map((slug, i) => ({
  slug,
  title: titles[i] ?? slug,
  metaDescription: metas[i] ?? "",
}));

const outPath = path.resolve(import.meta.dirname, "..", "netlify", "edge-functions", "blog-meta.json");
fs.writeFileSync(outPath, JSON.stringify(posts, null, 2), "utf-8");
console.log(`[blog-meta] Extracted ${posts.length} posts → ${outPath}`);
