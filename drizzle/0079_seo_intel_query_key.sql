-- 0079: fix seoIntelQuerySnapshots' unique key (0078_seo_intel.sql shipped a
-- composite UNIQUE INDEX(siteUrl, query, snapshotDate) that exceeds MySQL's
-- 3072-byte max key length under utf8mb4 given siteUrl/query's varchar(512) —
-- it failed with ER_TOO_LONG_KEY on every attempt, in every environment; see
-- drizzle/README.md's "0078_seo_intel" incident note. That statement never
-- successfully ran anywhere, so there is nothing to drop here.
--
-- Fix: add a derived snapshotKey = sha256(siteUrl + "\n" + query + "\n" +
-- snapshotDate) and put the UNIQUE index on that single compact column
-- instead. Preserves full-length siteUrl/query (no truncation) and true
-- full-value uniqueness (not a prefix). App code
-- (server/services/seo/intel/searchDemand.ts's snapshotTodaysQueries)
-- computes and writes snapshotKey on every insert; onDuplicateKeyUpdate's
-- idempotency now keys off this instead of the composite.
--
-- Additive only: seoIntelQuerySnapshots has zero rows in production (created
-- moments ago by 0078, never populated), so no backfill is needed.

ALTER TABLE `seoIntelQuerySnapshots` ADD `snapshotKey` varchar(64) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `seoIntelQuerySnapshots_key_uq` ON `seoIntelQuerySnapshots` (`snapshotKey`);
