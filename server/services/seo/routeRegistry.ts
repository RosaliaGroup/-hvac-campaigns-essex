/**
 * Route registry: seeds seoPages with the site's own public routes
 * (netlify/edge-functions/routes-manifest.json) so a page can be drafted and
 * batched BEFORE Search Console reports it. Until now seoPages only contained
 * pages GSC had returned, so /warranty, /commercial/property-managers and
 * /commercial/hvac-service-contracts (pinned positioning pages with zero
 * impressions) did not exist as rows and could never be drafted.
 *
 * Insert-only and idempotent: a route that already has a row (same pageHash as
 * the GSC sync uses) is left completely untouched — metrics, status and
 * problems are owned by the sync/team — and a later GSC sync simply takes the
 * zero-impression row over through its own upsert. Registering a page does NOT
 * unlock it: the lock list (server/seo/lockedPages.ts) still gates drafting and
 * batching, so /commercial stays locked.
 */
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { seoPages } from "../../../drizzle/schema";
import { getSeoSiteUrl, getSiteOrigin } from "../../integrations/searchConsole";
import { deriveCategory } from "../../../shared/seo";
import { NOINDEX_FOLLOW_PATHS, NOINDEX_NOFOLLOW_PATHS } from "../../../shared/seoLockedRoutes";
import { pageHash } from "./sync";

/** Real routes that are app/auth surfaces, not marketing pages — never registered as SEO pages. */
export const NON_MARKETING_ROUTES: ReadonlySet<string> = new Set(["/accept-invite", "/reset-password", "/team-login", "/portal"]);

const MANIFEST_REL = "netlify/edge-functions/routes-manifest.json";

/**
 * A repo-relative file's location under BOTH layouts this server runs in:
 *  - dev / tsx / tests run the source (server/services/seo/*.ts), so the repo root is three directories up;
 *  - production runs the esbuild bundle (dist/index.js; see the "build" script), where import.meta.dirname is
 *    <repo>/dist, so "../../.." points OUTSIDE the repo (server/_core/vite.ts serves dist/public from the same
 *    assumption). The app is started from the repo root, so process.cwd() finds it there.
 * First candidate that exists wins; if none does, the first is returned so the ENOENT names a sensible path.
 * Before this, the registry resolved only the source layout: in production it threw ENOENT every night (caught and
 * logged by runNightlyDraftJob) and never registered a new route.
 */
export function resolveRepoFile(rel: string, dirname: string = import.meta.dirname, cwd: string = process.cwd(), exists: (p: string) => boolean = fs.existsSync): string {
  const candidates = [path.resolve(dirname, "../../..", rel), path.resolve(cwd, rel)];
  return candidates.find((c) => exists(c)) ?? candidates[0];
}

export function manifestPath(): string {
  return resolveRepoFile(MANIFEST_REL);
}

export function loadRoutesManifest(file: string = manifestPath()): string[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
  if (!Array.isArray(parsed)) throw new Error("routes-manifest.json is not an array of paths");
  return parsed.filter((p): p is string => typeof p === "string");
}

/** Normalized, de-duplicated marketing routes: drop non-paths, params/wildcards, query strings, noindex pages and app/auth surfaces. */
export function registrableRoutes(manifest: string[]): string[] {
  const out = new Set<string>();
  for (const raw of manifest) {
    if (!raw.startsWith("/") || /[:*?#]/.test(raw)) continue;
    const p = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
    if (NON_MARKETING_ROUTES.has(p) || NOINDEX_FOLLOW_PATHS.has(p) || NOINDEX_NOFOLLOW_PATHS.has(p)) continue;
    out.add(p);
  }
  return Array.from(out).sort();
}

export type RegisterResult = { manifest: number; registrable: number; inserted: number; existing: number };

/** Insert a zero-impression seoPages row for every registrable manifest route that has none. Never updates an existing row. */
export async function registerManifestRoutes(manifest: string[] = loadRoutesManifest()): Promise<RegisterResult> {
  const routes = registrableRoutes(manifest);
  const db = await getDb();
  if (!db) return { manifest: manifest.length, registrable: routes.length, inserted: 0, existing: 0 };

  const siteUrl = getSeoSiteUrl();
  const origin = getSiteOrigin();
  const have = new Set((await db.select({ hash: seoPages.pageHash }).from(seoPages)).map((r) => r.hash));

  let inserted = 0;
  for (const route of routes) {
    const hash = pageHash(siteUrl, route);
    if (have.has(hash)) continue;
    await db
      .insert(seoPages)
      .values({
        siteUrl,
        page: route,
        url: `${origin}${route}`,
        pageHash: hash,
        category: deriveCategory(route),
        status: "needs_review",
      })
      // A concurrent GSC sync may have inserted it since the read above — never overwrite it.
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    inserted++;
  }
  return { manifest: manifest.length, registrable: routes.length, inserted, existing: routes.length - inserted };
}
