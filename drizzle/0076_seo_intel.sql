-- 0076: Daily Market Intelligence Report (docs/market-intel-spec.md).
-- Additive: four new tables + widen seoAuditLog.action's enum (same pattern
-- 0073_seo_autopublish.sql used for its own new actions). No other changes to
-- any existing table. NOT applied anywhere — apply BY HAND per
-- drizzle/README.md's manual procedure (owner approval + verified backup first).

ALTER TABLE `seoAuditLog` MODIFY COLUMN `action` enum(
  'draft_generated','draft_discarded','approved_to_pr','pr_opened','merged_detected',
  'revert_opened','reindex_requested','tag_added','tag_removed',
  'vetoed','link_consumed','circuit_breaker_paused','circuit_breaker_resumed',
  'warmup_advanced','warmup_reset','topic_proposed',
  'market_intel_report_generated','market_intel_item_executed',
  'market_intel_item_reverted','market_intel_owner_decision_released'
) NOT NULL;--> statement-breakpoint

CREATE TABLE `seoIntelReports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `date` varchar(10) NOT NULL COMMENT 'YYYY-MM-DD, America/New_York',
  `windowKind` enum('daily','weekly') NOT NULL DEFAULT 'daily',
  `sections` json NOT NULL,
  `summary` text,
  `itemCount` int NOT NULL DEFAULT 0,
  `acceptedCount` int NOT NULL DEFAULT 0,
  `dismissedCount` int NOT NULL DEFAULT 0,
  `executedCount` int NOT NULL DEFAULT 0,
  `circuitPaused` boolean NOT NULL DEFAULT false,
  `gscStale` boolean NOT NULL DEFAULT false,
  `emailSent` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `seoIntelReports_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `seoIntelReports_date_kind_uq` ON `seoIntelReports` (`date`, `windowKind`);--> statement-breakpoint

CREATE TABLE `seoIntelItems` (
  `id` int AUTO_INCREMENT NOT NULL,
  `reportId` int NOT NULL,
  `kind` enum(
    'rising_query','unserved_query','decaying_page','cannibalization','seasonality',
    'competitor_new_offer','competitor_price_change','competitor_warranty_change',
    'competitor_new_page','competitor_service_area_change','competitor_messaging_change',
    'positioning_match','positioning_counter','our_claims_stale',
    'meta_change','internal_link_suggestion','new_post','refresh_post','new_page',
    'jessica_prompt_gap','ads_keyword_suggestion','owner_decision'
  ) NOT NULL,
  `title` varchar(255) NOT NULL,
  `evidence` json,
  `suggestion` text,
  `targetQueue` varchar(64),
  `suggestionKey` varchar(255),
  `status` enum('open','accepted','dismissed','expired') NOT NULL DEFAULT 'open',
  `dismissReason` enum('wrong','not_now','off_brand','already_done'),
  `executedBatchId` int,
  `executedPrId` varchar(64),
  `factsBlocked` boolean NOT NULL DEFAULT false,
  `ownerDecisionValue` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `seoIntelItems_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `seoIntelItems_reportId_idx` ON `seoIntelItems` (`reportId`);--> statement-breakpoint
CREATE INDEX `seoIntelItems_suggestionKey_idx` ON `seoIntelItems` (`suggestionKey`);--> statement-breakpoint
CREATE INDEX `seoIntelItems_status_idx` ON `seoIntelItems` (`status`);--> statement-breakpoint

CREATE TABLE `seoIntelCompetitorSnapshots` (
  `id` int AUTO_INCREMENT NOT NULL,
  `domain` varchar(255) NOT NULL,
  `pagePath` varchar(512) NOT NULL DEFAULT '/',
  `contentHash` varchar(64) NOT NULL,
  `title` text,
  `metaDescription` text,
  `headings` json,
  `offers` json,
  `capturedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `seoIntelCompetitorSnapshots_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `seoIntelCompetitorSnapshots_domain_page_idx` ON `seoIntelCompetitorSnapshots` (`domain`, `pagePath`, `capturedAt`);--> statement-breakpoint

-- seoQueries (server/services/seo/sync.ts) is a point-in-time table the daily
-- GSC sync fully REPLACES on every run — it has no week-over-week history.
-- Real "rising query" / "first seen this week" classification (§3a) needs a
-- day-over-day history, so the market-intel job snapshots seoQueries into
-- this table once per day before classifying.
CREATE TABLE `seoIntelQuerySnapshots` (
  `id` int AUTO_INCREMENT NOT NULL,
  `siteUrl` varchar(512) NOT NULL,
  `query` varchar(512) NOT NULL,
  `page` varchar(1024),
  `clicks` int NOT NULL DEFAULT 0,
  `impressions` int NOT NULL DEFAULT 0,
  `ctr` decimal(8,6) NOT NULL DEFAULT '0',
  `position` decimal(6,2) NOT NULL DEFAULT '0',
  `snapshotDate` varchar(10) NOT NULL COMMENT 'YYYY-MM-DD, America/New_York',
  `capturedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `seoIntelQuerySnapshots_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `seoIntelQuerySnapshots_site_query_date_uq` ON `seoIntelQuerySnapshots` (`siteUrl`, `query`, `snapshotDate`);--> statement-breakpoint
CREATE INDEX `seoIntelQuerySnapshots_date_idx` ON `seoIntelQuerySnapshots` (`snapshotDate`);
