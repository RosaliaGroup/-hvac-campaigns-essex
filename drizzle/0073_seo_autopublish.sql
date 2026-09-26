-- 0073: SEO autopublish (docs/seo-automation-addendum-autopublish.md).
-- Additive: two new tables + widen seoAuditLog.action's enum. No changes to
-- any other existing table. Apply BY HAND per drizzle/README.md.
--
-- NOTE: `npx drizzle-kit generate` was tried first and rejected — its diff
-- re-emitted seoAuditLog/seoApprovalBatches/seoPageTags (already created by
-- 0072) as fresh CREATE TABLEs and bundled in unrelated pending drift
-- (notifications, pushSubscriptions, opportunities archive columns) that
-- belongs to other, already-numbered migrations. The snapshot lineage this
-- repo's journal points to does not reflect 0072, confirming the README's
-- own warning ("diff the live production schema before assuming the journal
-- reflects reality"). This file is hand-scoped to ONLY the 0073 delta.

ALTER TABLE `seoAuditLog` MODIFY COLUMN `action` enum(
  'draft_generated','draft_discarded','approved_to_pr','pr_opened','merged_detected',
  'revert_opened','reindex_requested','tag_added','tag_removed',
  'vetoed','link_consumed','circuit_breaker_paused','circuit_breaker_resumed',
  'warmup_advanced','warmup_reset','topic_proposed'
) NOT NULL;--> statement-breakpoint

CREATE TABLE `seoContentQueue` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL,
  `targetQuery` varchar(255),
  `audience` varchar(255),
  `brief` text,
  `status` enum('queued','proposed','drafted','in_review','pr_open','published','refresh_due') NOT NULL DEFAULT 'queued',
  `source` varchar(32) NOT NULL DEFAULT 'seed',
  `contentBatchId` int,
  `refreshesSlug` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `seoContentQueue_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `seoContentQueue_status_idx` ON `seoContentQueue` (`status`);--> statement-breakpoint

CREATE TABLE `seoAutopublishState` (
  `id` int NOT NULL,
  `metaWarmupRemaining` int NOT NULL DEFAULT 2,
  `contentWarmupRemaining` int NOT NULL DEFAULT 8,
  `circuitBreakerPaused` boolean NOT NULL DEFAULT false,
  `circuitBreakerReason` text,
  `circuitBreakerPausedAt` timestamp,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `seoAutopublishState_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
INSERT INTO `seoAutopublishState` (`id`) VALUES (1);
