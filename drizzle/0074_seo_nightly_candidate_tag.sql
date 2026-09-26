-- 0074: adds "nightly-candidate" to seoPageTags.tag (docs/seo-automation-spec.md
-- Part 1 — clean nightly drafts are tagged so they can be filtered in the UI).
-- Additive enum widen only. Apply BY HAND per drizzle/README.md.
ALTER TABLE `seoPageTags` MODIFY COLUMN `tag` enum(
  'claims-review','locked','verified-project','illustrative','nightly-candidate'
) NOT NULL;
