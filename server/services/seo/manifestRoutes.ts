/**
 * Register public routes from the routes manifest into seoPages BEFORE Search
 * Console has reported them.
 *
 * Why: seoPages is populated only by the daily GSC sync, so a brand-new page
 * (2026-09-30: /warranty, /commercial/property-managers,
 * /commercial/hvac-service-contracts) has no row until Google reports
 * impressions for it — and the meta lane can only draft a page that has a row.
 * Those are exactly the pinned positioning pages (PINNED_PRIORITY_PATHS in
 * nightlyDraftJob.ts) that most need drafting.
 *
 * The routes manifest (netlify/edge-functions/routes-manifest.json, generated
 * by scripts/generate-sitemap.ts from the App.tsx route registry) is the exact
 * set of resolvable public URLs. It is NOT the same as "indexable": it also
 * lists real-but-not-marketing pages (/accept-invite, /reset-password,
 * /team-login, /portal…). The site's own "index this" list is client/public/
 * sitemap.xml (the generator's SITEMAP_EXCLUDE removes those pages from it), so
 * a route is registered only if it is in the manifest AND the sitemap, is not
 * internal or noindex, and is not already in seoPages. If the sitemap can't be
 * read, NOTHING is registered (fail closed — never guess a page is indexable).
 *
 * Safety properties (all pinned by tests):
 *   - INSERT-ONLY: an existing row (GSC-populated, locked, mid-workflow) is
 *     never touched. Registration cannot unlock, re-status or overwrite anything.
 *   - Same identity as the sync: siteUrl + pageHash(siteUrl, path), so when
 *     Search Console does report the page, the daily sync's upsert updates THIS
 *     row (metrics, index status) and preserves its workflow state.
 *   - Honest zeros: no metrics, indexStatus "discovered_not_indexed" (we know the
 *     URL exists, not that Google has indexed it), status "needs_review".
 *   - Lock rules are path-based (server/seo/lockedPages.ts), so a registered
 *     path that is locked stays locked — /commercial (already a row, static-
 *     locked) is deliberately left exactly as it is.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../../db";
import { pageHash as seoPageHash } from "./sync";
import { seoPages } from "../../../drizzle/schema";
import { getSeoSiteUrl, getSiteOrigin } from "../../integrations/searchConsole";
import { deriveCategory } from "../../../shared/seo";
import { isInternalRoute } from "../../../client/src/lib/navigation";
import { NOINDEX_FOLLOW_PATHS, NOINDEX_NOFOLLOW_PATHS } from "../../../shared/seoLockedRoutes";

function normalizePath(p: string): string {
  const clean = p.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/**
 * Pure: which manifest routes need a seoPages row. In the manifest AND the
 * sitemap (the site's own "indexable" list), not internal/noindex, de-duplicated,
 * minus anything already registered. Order follows the manifest.
 */
export function selectRoutesToRegister(
  manifest: readonly unknown[],
  existingPaths: ReadonlySet<string>,
  indexablePaths: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of manifest) {
    if (typeof raw !== "string" || !raw.startsWith("/")) continue;
    const p = normalizePath(raw);
    if (seen.has(p)) continue;
    seen.add(p);
    if (existingPaths.has(p)) continue;
    if (!indexablePaths.has(p)) continue; // real page, but the site deliberately keeps it out of the sitemap
    if (isInternalRoute(p)) continue; // CRM/internal prefixes
    if (NOINDEX_FOLLOW_PATHS.has(p) || NOINDEX_NOFOLLOW_PATHS.has(p)) continue; // real pages that must not be indexed
    if (/[:*]/.test(p)) continue; // dynamic route patterns are not concrete URLs
    out.push(p);
  }
  return out;
}

/** dev/tsx runs from the source layout; prod runs the bundled dist/index.js from the repo root — try both. */
function repoFileCandidates(rel: string): string[] {
  return [path.resolve(import.meta.dirname, "../../..", rel), path.resolve(process.cwd(), rel)];
}

function readFirst(rel: string): string | null {
  for (const file of repoFileCandidates(rel)) {
    try {
      return fs.readFileSync(file, "utf-8");
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** The manifest as a string[], or [] (with a warning) if it can't be read — registration is best-effort and must never block boot. */
export function readRoutesManifest(): string[] {
  const text = readFirst("netlify/edge-functions/routes-manifest.json");
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (Array.isArray(parsed)) return parsed.filter((r): r is string => typeof r === "string");
  } catch {
    // fall through to the warning
  }
  console.warn("[SEO] routes manifest not found/readable — skipping route registration");
  return [];
}

/** Paths listed in client/public/sitemap.xml — the site's own "indexable" set. Empty (with a warning) if unreadable. */
export function readSitemapPaths(xml: string | null = readFirst("client/public/sitemap.xml")): Set<string> {
  const out = new Set<string>();
  for (const m of Array.from((xml ?? "").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g))) {
    try {
      out.add(normalizePath(new URL(m[1]).pathname));
    } catch {
      // ignore a malformed <loc>
    }
  }
  if (out.size === 0) console.warn("[SEO] sitemap.xml not found/readable — skipping route registration (fail closed)");
  return out;
}

export type RegisterResult = { registered: string[]; skippedExisting: number; manifestSize: number };

/**
 * Insert a seoPages row for every public, indexable manifest route that has
 * none. Idempotent and safe to run concurrently on several instances (the
 * unique pageHash makes a racing duplicate insert a no-op).
 */
export async function registerManifestRoutes(
  manifest: readonly unknown[] = readRoutesManifest(),
  indexable: ReadonlySet<string> = readSitemapPaths(),
): Promise<RegisterResult> {
  const db = await getDb();
  if (!db || manifest.length === 0 || indexable.size === 0) return { registered: [], skippedExisting: 0, manifestSize: manifest.length };

  const siteUrl = getSeoSiteUrl();
  const origin = getSiteOrigin();
  const existing = await db.select({ page: seoPages.page }).from(seoPages);
  const existingPaths = new Set(existing.map((r) => normalizePath(r.page)));

  const toRegister = selectRoutesToRegister(manifest, existingPaths, indexable);
  const registered: string[] = [];
  for (const p of toRegister) {
    await db
      .insert(seoPages)
      .values({
        siteUrl,
        page: p.slice(0, 1024),
        url: `${origin}${p}`,
        pageHash: seoPageHash(siteUrl, p),
        category: deriveCategory(p),
        priority: "low",
        status: "needs_review",
        indexStatus: "discovered_not_indexed",
        searchConsoleIssue: "Registered from the routes manifest — Search Console hasn't reported this page yet.",
        problems: [],
      })
      // A concurrent registration (or the sync) got there first: leave THEIR row untouched.
      .onDuplicateKeyUpdate({ set: { pageHash: seoPageHash(siteUrl, p) } });
    registered.push(p);
  }
  if (registered.length > 0) console.log(`[SEO] registered ${registered.length} route(s) from the routes manifest: ${registered.slice(0, 12).join(", ")}${registered.length > 12 ? ", …" : ""}`);
  return { registered, skippedExisting: existingPaths.size, manifestSize: manifest.length };
}
