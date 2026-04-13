/**
 * Generate static sitemap.xml from blog posts + known pages.
 * Run: npx tsx scripts/generate-sitemap.ts
 * Called automatically during `pnpm build`.
 */
import fs from "fs";
import path from "path";

const BASE = "https://mechanicalenterprise.com";

// ── Read blog posts from source ─────────────────────────────────────────────

const blogSrc = fs.readFileSync(
  path.resolve(import.meta.dirname, "..", "client", "src", "data", "blogPosts.ts"),
  "utf-8"
);

interface BlogMeta { slug: string; date: string }

const slugs = Array.from(blogSrc.matchAll(/slug:\s*"([^"]+)"/g)).map(m => m[1]);
const dates = Array.from(blogSrc.matchAll(/date:\s*"([^"]+)"/g)).map(m => m[1]);

const blogPosts: BlogMeta[] = slugs.map((slug, i) => ({
  slug,
  date: dates[i] ?? "2026-04-01",
}));

function toIsoDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "2026-04-01" : d.toISOString().split("T")[0];
  } catch { return "2026-04-01"; }
}

// ── Static pages ────────────────────────────────────────────────────────────

const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string; lastmod: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly", lastmod: "2026-04-12" },
  { path: "/residential", priority: "0.9", changefreq: "weekly", lastmod: "2026-04-01" },
  { path: "/commercial", priority: "0.9", changefreq: "weekly", lastmod: "2026-04-01" },
  { path: "/rebate-calculator", priority: "0.9", changefreq: "weekly", lastmod: "2026-04-01" },
  { path: "/services", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/about", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/contact", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/blog", priority: "0.8", changefreq: "weekly", lastmod: "2026-04-12" },
  { path: "/heat-pump-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/ductless-mini-split-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/central-ac-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/oil-to-heat-pump-conversion-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/commercial-vrf-vrv-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/pseg-rebate-contractor-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/direct-install", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  // City pages
  ...([
    "newark", "jersey-city", "elizabeth", "paterson", "edison", "woodbridge",
    "toms-river", "clifton", "passaic", "union-city", "bayonne", "east-orange",
    "hackensack", "new-brunswick", "perth-amboy", "west-new-york", "plainfield",
    "bloomfield", "irvington", "montclair", "belleville", "kearny", "linden",
    "garfield", "west-orange", "orange", "nutley",
  ].map(city => ({
    path: `/hvac-${city}-nj`,
    priority: "0.7",
    changefreq: "monthly" as const,
    lastmod: "2026-04-01",
  }))),
  // Luxury areas
  ...([
    "millburn", "short-hills", "summit", "maplewood", "south-orange",
    "livingston", "glen-ridge", "montclair", "caldwell", "verona",
  ].map(area => ({
    path: `/hvac-${area}-nj`,
    priority: "0.6",
    changefreq: "monthly" as const,
    lastmod: "2026-04-01",
  }))),
  // Competitor pages
  ...([
    "aj-perri", "gold-medal-service", "central-air-systems",
    "service-experts", "polar-hvac",
  ].map(comp => ({
    path: `/vs-${comp}`,
    priority: "0.5",
    changefreq: "monthly" as const,
    lastmod: "2026-04-01",
  }))),
];

// ── Generate XML ────────────────────────────────────────────────────────────

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];

for (const p of STATIC_PAGES) {
  lines.push("  <url>");
  lines.push(`    <loc>${BASE}${p.path}</loc>`);
  lines.push(`    <lastmod>${p.lastmod}</lastmod>`);
  lines.push(`    <changefreq>${p.changefreq}</changefreq>`);
  lines.push(`    <priority>${p.priority}</priority>`);
  lines.push("  </url>");
}

for (const post of blogPosts) {
  lines.push("  <url>");
  lines.push(`    <loc>${BASE}/blog/${post.slug}</loc>`);
  lines.push(`    <lastmod>${toIsoDate(post.date)}</lastmod>`);
  lines.push(`    <changefreq>monthly</changefreq>`);
  lines.push(`    <priority>0.8</priority>`);
  lines.push("  </url>");
}

lines.push("</urlset>");

const outPath = path.resolve(import.meta.dirname, "..", "client", "public", "sitemap.xml");
fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`[sitemap] Generated ${STATIC_PAGES.length + blogPosts.length} URLs → ${outPath}`);
