/**
 * Server-side SEO: dynamic sitemap + meta tag injection for crawlers.
 *
 * Why: The site is a client-side SPA. Googlebot can execute JS but is slow
 * and unreliable at it. By injecting the correct <title>, meta description,
 * og tags, and canonical into the initial HTML response, crawlers see real
 * content without waiting for React to hydrate.
 */

import type { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

// ── Blog post data (imported at build time from shared source) ──────────────
// We re-read the compiled blog data so titles/descriptions stay in sync
// with the client automatically.

interface BlogMeta {
  title: string;
  slug: string;
  date: string;
  metaDescription: string;
}

let blogCache: BlogMeta[] | null = null;

function getBlogPosts(): BlogMeta[] {
  if (blogCache) return blogCache;
  try {
    // In production the compiled client bundle isn't directly importable,
    // so we read the raw TS source and extract what we need via regex.
    const srcPath = path.resolve(import.meta.dirname, "..", "client", "src", "data", "blogPosts.ts");
    const distPath = path.resolve(import.meta.dirname, "..", "dist", "public", "blog-meta.json");

    // Prefer pre-built JSON (generated at build time)
    if (fs.existsSync(distPath)) {
      blogCache = JSON.parse(fs.readFileSync(distPath, "utf-8"));
      return blogCache!;
    }

    // Fallback: parse the TS source file
    if (fs.existsSync(srcPath)) {
      const src = fs.readFileSync(srcPath, "utf-8");
      const posts: BlogMeta[] = [];
      const slugRe = /slug:\s*"([^"]+)"/g;
      const titleRe = /title:\s*"([^"]+)"/g;
      const dateRe = /date:\s*"([^"]+)"/g;
      const metaRe = /metaDescription:\s*"([^"]+)"/g;

      const slugs = Array.from(src.matchAll(slugRe)).map(m => m[1]);
      const titles = Array.from(src.matchAll(titleRe)).map(m => m[1]);
      const dates = Array.from(src.matchAll(dateRe)).map(m => m[1]);
      const metas = Array.from(src.matchAll(metaRe)).map(m => m[1]);

      for (let i = 0; i < slugs.length; i++) {
        posts.push({
          slug: slugs[i],
          title: titles[i] ?? slugs[i],
          date: dates[i] ?? "2026-04-01",
          metaDescription: metas[i] ?? "",
        });
      }
      blogCache = posts;
      return posts;
    }

    return [];
  } catch (e) {
    console.error("[SEO] Failed to load blog posts:", e);
    return [];
  }
}

// ── Page meta definitions (non-blog) ────────────────────────────────────────

const BASE = "https://mechanicalenterprise.com";
const DEFAULT_TITLE = "Mechanical Enterprise | Expert HVAC Solutions in New Jersey";
const DEFAULT_DESC = "Licensed HVAC contractor in Newark NJ. PSE&G-approved for heat pump rebates up to $16K. Serving 15 NJ counties. Call (862) 419-1763.";

interface PageMeta {
  title: string;
  description: string;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  "/residential": { title: "Residential HVAC Services NJ | Mechanical Enterprise", description: "Residential HVAC installation, repair, and replacement in New Jersey. Heat pumps, central AC, ductless mini-splits. Up to $16K in rebates." },
  "/commercial": { title: "Commercial HVAC Services NJ | Mechanical Enterprise", description: "Commercial HVAC solutions for NJ businesses. PSE&G Direct Install covers up to 80%. VRF/VRV specialists. Free assessment." },
  "/rebate-calculator": { title: "NJ HVAC Rebate Calculator | Mechanical Enterprise", description: "Calculate your NJ heat pump rebate in 2 minutes. PSE&G rebates up to $16K. Free assessment, no obligation." },
  "/services": { title: "HVAC Services | Mechanical Enterprise NJ", description: "Full-service HVAC contractor in New Jersey. Installation, repair, maintenance. Heat pumps, AC, furnaces. WMBE certified." },
  "/about": { title: "About Mechanical Enterprise | NJ HVAC Contractor", description: "Licensed NJ HVAC contractor serving 15 counties. WMBE/SBE certified. PSE&G approved. Call (862) 419-1763." },
  "/contact": { title: "Contact Mechanical Enterprise | NJ HVAC", description: "Contact Mechanical Enterprise for HVAC service in New Jersey. Call (862) 419-1763 or request a free assessment online." },
  "/blog": { title: "HVAC Blog | Mechanical Enterprise NJ", description: "HVAC tips, NJ rebate guides, heat pump advice, and energy savings articles from Mechanical Enterprise." },
};

function getMetaForPath(urlPath: string): PageMeta & { canonical: string } {
  const clean = urlPath.split("?")[0].replace(/\/+$/, "") || "/";

  // Blog post
  if (clean.startsWith("/blog/")) {
    const slug = clean.replace("/blog/", "");
    const post = getBlogPosts().find(p => p.slug === slug);
    if (post) {
      return {
        title: `${post.title} | Mechanical Enterprise`,
        description: post.metaDescription,
        canonical: `${BASE}/blog/${post.slug}`,
      };
    }
  }

  // Known static page
  const known = PAGE_META[clean];
  if (known) {
    return { ...known, canonical: `${BASE}${clean === "/" ? "" : clean}` };
  }

  // Fallback
  return { title: DEFAULT_TITLE, description: DEFAULT_DESC, canonical: `${BASE}${clean}` };
}

// ── HTML meta injection ─────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function injectMeta(html: string, urlPath: string): string {
  const meta = getMetaForPath(urlPath);
  const t = escHtml(meta.title);
  const d = escHtml(meta.description);
  const c = escHtml(meta.canonical);

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${d}" />`
  );

  // Replace og tags
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${t}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${d}" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${c}" />`
  );

  // Replace twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${t}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${d}" />`
  );

  // Inject canonical link (before </head>)
  if (!html.includes('rel="canonical"')) {
    html = html.replace("</head>", `  <link rel="canonical" href="${c}" />\n  </head>`);
  }

  return html;
}

// ── Dynamic sitemap ─────────────────────────────────────────────────────────

function toIsoDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "2026-04-01";
    return d.toISOString().split("T")[0];
  } catch {
    return "2026-04-01";
  }
}

// Static pages with priority and changefreq
const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string; lastmod: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly", lastmod: "2026-04-12" },
  { path: "/residential", priority: "0.9", changefreq: "weekly", lastmod: "2026-04-01" },
  { path: "/commercial", priority: "0.9", changefreq: "weekly", lastmod: "2026-04-01" },
  { path: "/rebate-calculator", priority: "0.9", changefreq: "weekly", lastmod: "2026-04-01" },
  { path: "/services", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/about", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/contact", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/blog", priority: "0.8", changefreq: "weekly", lastmod: "2026-04-12" },
  // Service pages
  { path: "/heat-pump-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/ductless-mini-split-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/central-ac-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/oil-to-heat-pump-conversion-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/commercial-vrf-vrv-installation-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/pseg-rebate-contractor-nj", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
  // County pages
  { path: "/hvac-newark-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-jersey-city-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-elizabeth-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-paterson-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-edison-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-woodbridge-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-toms-river-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-clifton-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-passaic-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-union-city-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-bayonne-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-east-orange-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-hackensack-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-new-brunswick-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-perth-amboy-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-west-new-york-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-plainfield-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-bloomfield-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-irvington-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-montclair-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-belleville-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-kearny-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-linden-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-garfield-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-west-orange-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-orange-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  { path: "/hvac-nutley-nj", priority: "0.7", changefreq: "monthly", lastmod: "2026-04-01" },
  // Direct Install
  { path: "/direct-install", priority: "0.8", changefreq: "monthly", lastmod: "2026-04-01" },
];

function generateSitemap(): string {
  const posts = getBlogPosts();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  // Static pages
  for (const p of STATIC_PAGES) {
    lines.push("  <url>");
    lines.push(`    <loc>${BASE}${p.path}</loc>`);
    lines.push(`    <lastmod>${p.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${p.changefreq}</changefreq>`);
    lines.push(`    <priority>${p.priority}</priority>`);
    lines.push("  </url>");
  }

  // Blog posts
  for (const post of posts) {
    const lastmod = toIsoDate(post.date);
    lines.push("  <url>");
    lines.push(`    <loc>${BASE}/blog/${post.slug}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>monthly</changefreq>`);
    lines.push(`    <priority>0.8</priority>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

// ── Register routes ─────────────────────────────────────────────────────────

export function registerSeoRoutes(app: Express) {
  // Dynamic sitemap.xml — always fresh, includes all blog posts
  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const xml = generateSitemap();
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600"); // cache 1hr
    res.send(xml);
  });
}
