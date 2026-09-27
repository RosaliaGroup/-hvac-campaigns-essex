-- Rollback for 0079_seo_intel_query_key.sql.
DROP INDEX `seoIntelQuerySnapshots_key_uq` ON `seoIntelQuerySnapshots`;
ALTER TABLE `seoIntelQuerySnapshots` DROP COLUMN `snapshotKey`;
