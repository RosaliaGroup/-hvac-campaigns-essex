/**
 * Coverage guard for the build-time sitemap generator.
 *
 * Runs the real generator end-to-end and asserts every public route, blog post,
 * and direct-install page it is supposed to emit actually lands in sitemap.xml.
 * This is the regression net for the two ways the sitemap has silently shrunk
 * before: a route-scrape that stops matching (the ~2026-04 city-page drop) and a
 * wholesale collapse (the empty sitemap shipped in fd68e9f). The generator's own
 * MIN_URLS guard covers the floor; these tests additionally pin *which* URLs.
 *
 * The generator writes client/public/sitemap.xml as a side effect; we snapshot
 * and restore it so running the test leaves no working-tree change.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const BASE = "https://mechanicalenterprise.com";
const MIN_URLS = 250;
const root = path.resolve(import.meta.dirname, "..");
const sitemapPath = path.resolve(root, "client", "public", "sitemap.xml");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(root, rel), "utf-8");
}
function slugsIn(rel: string): string[] {
  return Array.from(read(rel).matchAll(/slug:\s*"([^"]+)"/g)).map((m) => m[1]);
}

let locs: Set<string>;
let originalSitemap: string | null;

beforeAll(() => {
  originalSitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, "utf-8") : null;
  // Runs the actual build step. Throws (failing the suite) if the generator's
  // own <250-URL guard trips — which is exactly the collapse we want to catch.
  execSync("npx tsx scripts/generate-sitemap.ts", { cwd: root, stdio: "pipe" });
  const xml = fs.readFileSync(sitemapPath, "utf-8");
  locs = new Set(Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]));
});

afterAll(() => {
  if (originalSitemap === null) fs.rmSync(sitemapPath, { force: true });
  else fs.writeFileSync(sitemapPath, originalSitemap, "utf-8");
});

describe("generate-sitemap — coverage", () => {
  it(`emits at least ${MIN_URLS} URLs`, () => {
    expect(locs.size).toBeGreaterThanOrEqual(MIN_URLS);
  });

  it("includes core landing pages that must never fall out of the index", () => {
    for (const p of ["/", "/residential", "/commercial", "/blog", "/direct-install", "/rebate-calculator"]) {
      expect(locs.has(`${BASE}${p}`)).toBe(true);
    }
  });

  it("includes every blog post from blogPosts.ts", () => {
    const slugs = slugsIn("client/src/data/blogPosts.ts");
    expect(slugs.length).toBeGreaterThan(0);
    const missing = slugs.filter((s) => !locs.has(`${BASE}/blog/${s}`));
    expect(missing).toEqual([]);
  });

  it("includes every industry from directInstallIndustries.ts", () => {
    const slugs = slugsIn("client/src/data/directInstallIndustries.ts");
    expect(slugs.length).toBeGreaterThan(0);
    const missing = slugs.filter((s) => !locs.has(`${BASE}/direct-install/${s}`));
    expect(missing).toEqual([]);
  });

  it("includes every public /hvac-*-nj city route declared in App.tsx", () => {
    // Directly targets the failure mode where a route refactor drops city pages.
    const cityRoutes = Array.from(
      read("client/src/App.tsx").matchAll(/Route\s+path=\{?"(\/hvac-[a-z-]+-nj)"\}?/g),
    ).map((m) => m[1]);
    expect(cityRoutes.length).toBeGreaterThan(50); // ~150 today
    const missing = cityRoutes.filter((p) => !locs.has(`${BASE}${p}`));
    expect(missing).toEqual([]);
  });

  it("emits valid, non-duplicated <loc> entries", () => {
    for (const loc of locs) expect(loc.startsWith(`${BASE}/`)).toBe(true);
    // Set size already dedupes; assert the raw XML had no dupes either.
    const xml = fs.readFileSync(sitemapPath, "utf-8");
    const all = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    expect(all.length).toBe(new Set(all).size);
  });
});
