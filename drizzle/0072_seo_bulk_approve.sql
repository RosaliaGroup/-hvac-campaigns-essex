-- 0072: SEO bulk-approve workflow (docs/seo-bulk-approve-spec.md).
-- Additive: three new tables. No changes to existing tables, no backfill.
-- Apply BY HAND per drizzle/README.md.
--
-- pagePath columns are varchar(1024) but NEVER indexed directly: under
-- utf8mb4 that's 4096 bytes, over MySQL's 3072-byte max key length (this
-- was caught applying an earlier draft of this migration to production —
-- ER_TOO_LONG_KEY — and fixed the same way seoPages.pageHash already solved
-- the identical problem: seoPageTags indexes/uniques on pagePathHash
-- (sha256 of the normalized path, 64 chars) instead; seoAuditLog's pagePath
-- just isn't indexed at all, since it's never a uniqueness key there.

CREATE TABLE `seoPageTags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `pagePath` varchar(1024) NOT NULL,
  `pagePathHash` varchar(64) NOT NULL,
  `tag` enum('claims-review','locked','verified-project','illustrative') NOT NULL,
  `note` text,
  `createdById` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `seoPageTags_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `seoPageTags_page_tag_uq` ON `seoPageTags` (`pagePathHash`,`tag`);--> statement-breakpoint

CREATE TABLE `seoApprovalBatches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `label` varchar(255) NOT NULL,
  `pages` json NOT NULL,
  `diff` json NOT NULL,
  `actorId` int,
  `branch` varchar(255) NOT NULL,
  `commitSha` varchar(64),
  `prUrl` varchar(512),
  `prNumber` int,
  `status` enum('pr_open','merged','reverted','failed') NOT NULL DEFAULT 'pr_open',
  `revertsBatchId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `seoApprovalBatches_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `seoApprovalBatches_status_idx` ON `seoApprovalBatches` (`status`);--> statement-breakpoint

CREATE TABLE `seoAuditLog` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ts` timestamp NOT NULL DEFAULT (now()),
  `actorId` int,
  `action` enum('draft_generated','draft_discarded','approved_to_pr','pr_opened','merged_detected','revert_opened','reindex_requested','tag_added','tag_removed') NOT NULL,
  `batchId` int,
  `pagePath` varchar(1024),
  `before` json,
  `after` json,
  `lintResult` json,
  CONSTRAINT `seoAuditLog_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `seoAuditLog_batchId_idx` ON `seoAuditLog` (`batchId`);--> statement-breakpoint
CREATE INDEX `seoAuditLog_ts_idx` ON `seoAuditLog` (`ts`);
