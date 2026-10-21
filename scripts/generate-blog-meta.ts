/**
 * Extract blog post metadata to a JSON file for Netlify Edge Functions.
 * Run: npx tsx scripts/generate-blog-meta.ts
 * Called automatically during `pnpm build`.
 */
import fs from "fs";
import path from "path";
import { allBlogPosts } from "../client/src/data/allBlogPosts";

const posts = allBlogPosts.map(post => ({ slug: post.slug, title: post.title, metaDescription: post.metaDescription }));

const outPath = path.resolve(import.meta.dirname, "..", "netlify", "edge-functions", "blog-meta.json");
fs.writeFileSync(outPath, JSON.stringify(posts, null, 2), "utf-8");
console.log(`[blog-meta] Extracted ${posts.length} posts → ${outPath}`);
