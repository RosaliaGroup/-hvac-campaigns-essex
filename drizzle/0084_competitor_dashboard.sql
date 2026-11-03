-- Additive only: two new tables for the Competitors dashboard (free data sources).
-- Apply manually following drizzle/README.md after a verified backup.
-- Nothing existing is altered. Rollback:
--   DROP TABLE `seoIntelCompetitorMetrics`; DROP TABLE `seoIntelCompetitors`;
CREATE TABLE `seoIntelCompetitors` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `domain` varchar(255) NOT NULL,
  `status` enum('suggested','confirmed','removed') NOT NULL DEFAULT 'suggested',
  `brandTerms` json,
  `note` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `seoIntelCompetitors_id` PRIMARY KEY(`id`),
  CONSTRAINT `seoIntelCompetitors_domain_uq` UNIQUE(`domain`)
);

CREATE TABLE `seoIntelCompetitorMetrics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `weekOf` varchar(10) NOT NULL,
  `domain` varchar(255) NOT NULL,
  `metricKey` varchar(64) NOT NULL,
  `data` json NOT NULL,
  `capturedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `seoIntelCompetitorMetrics_id` PRIMARY KEY(`id`),
  CONSTRAINT `seoIntelCompetitorMetrics_key_uq` UNIQUE(`metricKey`)
);
CREATE INDEX `seoIntelCompetitorMetrics_week_idx` ON `seoIntelCompetitorMetrics` (`weekOf`);
