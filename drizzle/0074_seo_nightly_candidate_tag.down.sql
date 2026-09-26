-- Rollback for 0074. Safe as long as no seoPageTags row already uses
-- 'nightly-candidate' (check before running this once the nightly job has run).
ALTER TABLE `seoPageTags` MODIFY COLUMN `tag` enum(
  'claims-review','locked','verified-project','illustrative'
) NOT NULL;
