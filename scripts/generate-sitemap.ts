/**
 * Generate static sitemap.xml by auto-extracting ALL public routes from App.tsx,
 * plus dynamic pages from blogPosts.ts and directInstallIndustries.ts.
 *
 * Run: npx tsx scripts/generate-sitemap.ts
 * Called automatically during `pnpm build`.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE = "https://mechanicalenterprise.com";
const root = path.resolve(import.meta.dirname, "..");

// Minimum URLs a healthy sitemap must contain. A collapsed sitemap (empty or
// near-empty) has shipped before when the route-scraping strategy was rewritten;
// falling below this floor FAILS the build instead of silently deploying it.
const MIN_URLS = 250;

// Build date (YYYY-MM-DD), used as the lastmod fallback when git is unavailable.
const BUILD_DATE = new Date().toISOString().split("T")[0];

function readFile(rel: string): string {
  return fs.readFileSync(path.resolve(root, rel), "utf-8");
}

// Real lastmod: the date the given source file was last committed. Beats a frozen
// hardcoded date — Google re-reads a sitemap whose lastmod actually moves. Falls
// back to the build date if git isn't available (e.g. non-repo build sandbox).
const _mtimeCache = new Map<string, string>();
function lastModified(rel: string): string {
  const cached = _mtimeCache.get(rel);
  if (cached) return cached;
  let date = BUILD_DATE;
  try {
    const out = execSync(`git log -1 --format=%cs -- "${rel}"`, {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) date = out;
  } catch {
    // git missing / shallow-cloneless build — keep BUILD_DATE
  }
  _mtimeCache.set(rel, date);
  return date;
}

function toIsoDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? BUILD_DATE : d.toISOString().split("T")[0];
  } catch { return BUILD_DATE; }
}

// ── 1. Extract all Route paths from App.tsx ─────────────────────────────────

const appSrc = readFile("client/src/App.tsx");

// Match Route path={"/something"} or Route path="/something"
const routeMatches = Array.from(appSrc.matchAll(/Route\s+path=\{?"([^"]+)"\}?/g));

// Build a map of path → component text (to detect protect(), LuxuryAreaPage, etc.)
const routeLines = appSrc.split("\n");
interface RouteInfo { path: string; line: string }
const allRoutes: RouteInfo[] = routeMatches.map(m => {
  const lineIdx = appSrc.substring(0, m.index!).split("\n").length - 1;
  return { path: m[1], line: routeLines[lineIdx] ?? "" };
});

// Filter: skip protected routes, auth routes, dynamic param routes, 404
const SKIP_PATHS = new Set(["/team-login", "/accept-invite", "/reset-password", "/404"]);
const publicRoutes = allRoutes.filter(r => {
  if (r.line.includes("protect(")) return false;     // protected/admin routes
  if (SKIP_PATHS.has(r.path)) return false;           // auth/utility
  if (r.path.includes(":")) return false;             // dynamic params (expanded below)
  return true;
});

// ── 2. Read blog posts ──────────────────────────────────────────────────────

const blogSrc = readFile("client/src/data/blogPosts.ts");
const blogSlugs = Array.from(blogSrc.matchAll(/slug:\s*"([^"]+)"/g)).map(m => m[1]);
const blogDates = Array.from(blogSrc.matchAll(/date:\s*"([^"]+)"/g)).map(m => m[1]);

// ── 3. Read direct install industries ───────────────────────────────────────

const diSrc = readFile("client/src/data/directInstallIndustries.ts");
const diSlugs = Array.from(diSrc.matchAll(/slug:\s*"([^"]+)"/g)).map(m => m[1]);

// ── 4. Classify priorities ──────────────────────────────────────────────────

// SEO landing pages (repair/service intent) — keep in sync with data/seoLandingPages.ts
const SEO_LANDING_SLUGS = new Set([
  "/ac-repair-nj", "/heating-repair-nj", "/furnace-repair-nj", "/boiler-repair-nj",
  "/indoor-air-quality-nj", "/heat-pump-repair-nj", "/ductless-mini-split-repair-nj",
  "/emergency-hvac-repair-nj", "/commercial-hvac-service-nj", "/commercial-rtu-service-nj",
  "/commercial-hvac-maintenance-nj", "/restaurant-hvac-nj", "/warehouse-hvac-nj",
  "/office-building-hvac-nj", "/industrial-hvac-nj",
]);

function getPriority(p: string, line: string): string {
  if (p === "/") return "1.0";
  if (p === "/emergency-hvac-repair-nj") return "0.9";
  if (SEO_LANDING_SLUGS.has(p)) return "0.8";
  if (["/residential", "/commercial", "/rebate-calculator"].includes(p)) return "0.9";
  if (p === "/blog" || p.startsWith("/heat-pump-") || p.startsWith("/central-ac-") ||
      p.startsWith("/ductless-") || p.startsWith("/oil-to-") || p.startsWith("/commercial-") ||
      p.startsWith("/vrv-") || p.startsWith("/hvac-system-") || p.startsWith("/hvac-financing") ||
      p.startsWith("/heat-pump-rebates") || p === "/direct-install" ||
      p.startsWith("/pseg-")) return "0.8";
  if (p === "/services" || p === "/about" || p === "/contact" || p === "/rebate-guide" ||
      p === "/testimonials" || p === "/maintenance" || p === "/partnerships" ||
      p === "/careers") return "0.7";
  if (line.includes("LuxuryAreaPage")) return "0.6";
  if (p.startsWith("/lp/")) return "0.6";
  if (p.startsWith("/vs-")) return "0.5";
  if (p.startsWith("/hvac-") && p.endsWith("-nj")) return "0.7"; // city pages
  if (["/promos", "/qualify", "/assessment", "/estimating", "/courses",
       "/rebate-calc", "/privacy", "/terms"].includes(p)) return "0.5";
  return "0.6";
}

function getChangefreq(priority: string): string {
  if (parseFloat(priority) >= 0.9) return "weekly";
  if (parseFloat(priority) >= 0.7) return "monthly";
  return "monthly";
}

// ── 5. Build URL list ───────────────────────────────────────────────────────

interface SitemapEntry { loc: string; lastmod: string; changefreq: string; priority: string }
const entries: SitemapEntry[] = [];
const seen = new Set<string>();

function addUrl(urlPath: string, priority: string, changefreq: string, lastmod: string) {
  if (seen.has(urlPath)) return;
  seen.add(urlPath);
  entries.push({ loc: `${BASE}${urlPath}`, lastmod, changefreq, priority });
}

// Static routes from App.tsx
const appLastmod = lastModified("client/src/App.tsx");
for (const r of publicRoutes) {
  const priority = getPriority(r.path, r.line);
  addUrl(r.path, priority, getChangefreq(priority), appLastmod);
}

// Blog posts
for (let i = 0; i < blogSlugs.length; i++) {
  addUrl(`/blog/${blogSlugs[i]}`, "0.8", "monthly", toIsoDate(blogDates[i] ?? "April 12, 2026"));
}

// Direct install industry pages
const diLastmod = lastModified("client/src/data/directInstallIndustries.ts");
for (const slug of diSlugs) {
  addUrl(`/direct-install/${slug}`, "0.6", "monthly", diLastmod);
}

// ── 6. Sort: higher priority first, then alphabetical ───────────────────────

entries.sort((a, b) => {
  const pd = parseFloat(b.priority) - parseFloat(a.priority);
  if (pd !== 0) return pd;
  return a.loc.localeCompare(b.loc);
});

// ── 7. Generate XML ─────────────────────────────────────────────────────────

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];

for (const e of entries) {
  lines.push("  <url>");
  lines.push(`    <loc>${e.loc}</loc>`);
  lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
  lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
  lines.push(`    <priority>${e.priority}</priority>`);
  lines.push("  </url>");
}

lines.push("</urlset>");

// ── 8. Guard: refuse to ship a collapsed sitemap ────────────────────────────
// Fail the build (non-zero exit) BEFORE overwriting the last-good file on disk,
// so a broken run can't silently deploy an empty/near-empty sitemap.
if (entries.length < MIN_URLS) {
  console.error(
    `[sitemap] ABORT: generated only ${entries.length} URLs (minimum ${MIN_URLS}).\n` +
    `  This usually means route/data extraction broke — e.g. App.tsx routes were\n` +
    `  refactored away from string-literal <Route path="..."> form, or a data file\n` +
    `  moved. Not writing sitemap.xml; failing the build.`
  );
  process.exit(1);
}

const outPath = path.resolve(root, "client", "public", "sitemap.xml");
fs.writeFileSync(outPath, lines.join("\n"), "utf-8");

// Summary
const blogCount = blogSlugs.length;
const diCount = diSlugs.length;
const staticCount = entries.length - blogCount - diCount;
console.log(`[sitemap] Generated ${entries.length} URLs → ${outPath}`);
console.log(`  Static routes: ${staticCount}`);
console.log(`  Blog posts: ${blogCount}`);
console.log(`  Direct install: ${diCount}`);
