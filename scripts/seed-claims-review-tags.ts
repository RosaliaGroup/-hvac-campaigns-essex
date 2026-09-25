/**
 * One-off seed: insert `claims-review` seoPageTags rows for the pages flagged
 * in the PR-1 SEO/25C audit (docs/pr1/step0-audit.md), so they show up in the
 * SeoIntelligence tags UI and can be un-tagged (with a note) once verified,
 * instead of only existing as the hardcoded fallback in
 * server/seo/lockedPages.ts's SEEDED_CLAIMS_REVIEW_PATHS.
 *
 * Idempotent — safe to re-run (onDuplicateKeyUpdate against the
 * seoPageTags_page_tag_uq unique index on (pagePathHash, tag)).
 *
 * Run: npx tsx scripts/seed-claims-review-tags.ts
 * (Point DATABASE_URL at the target environment first — this does not run
 * automatically as part of any migration or deploy.)
 */
import { getDb } from "../server/db";
import { seoPageTags } from "../drizzle/schema";
import { hashPagePath } from "../server/seo/lockedPages";

const PATHS = [
  "/hvac-newark-nj",
  "/blog/hvac-tax-credits-2026-nj",
  "/blog/federal-25c-tax-credit-hvac-2026",
  "/blog/pseg-rebate-vs-federal-tax-credit",
  "/blog/inflation-reduction-act-hvac-nj",
  "/blog/pseg-heat-pump-rebates-explained",
  "/blog/nj-hvac-rebates-2026-complete-guide",
];

const NOTE = "Seeded from the PR-1 SEO/25C audit (docs/pr1/step0-audit.md) — verify the page no longer claims the expired federal 25C credit before removing this tag.";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("[seed-claims-review-tags] No DB connection — check DATABASE_URL.");
    process.exit(1);
  }
  for (const pagePath of PATHS) {
    await db
      .insert(seoPageTags)
      .values({ pagePath, pagePathHash: hashPagePath(pagePath), tag: "claims-review", note: NOTE })
      .onDuplicateKeyUpdate({ set: { note: NOTE } });
    console.log(`[seed-claims-review-tags] tagged ${pagePath}`);
  }
  console.log(`[seed-claims-review-tags] done — ${PATHS.length} pages tagged claims-review.`);
}

main();
