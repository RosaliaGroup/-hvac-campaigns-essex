CREATE TABLE `seoAiDrafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`siteUrl` varchar(512) NOT NULL,
	`generatedTitle` text,
	`generatedMetaDescription` text,
	`generatedH1` text,
	`faq` json,
	`internalLinks` json,
	`schema` json,
	`contentExpansion` text,
	`model` varchar(64) NOT NULL DEFAULT 'mock-v1',
	`status` enum('draft','edited','approved') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seoAiDrafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `seoAiDrafts_pageId_uq` UNIQUE(`pageId`)
);
--> statement-breakpoint
ALTER TABLE `seoPages` MODIFY COLUMN `status` enum('needs_review','queued','optimizing','waiting_review','approved','published','waiting_for_indexing','ranking_improved') NOT NULL DEFAULT 'needs_review';--> statement-breakpoint
CREATE INDEX `seoAiDrafts_site_idx` ON `seoAiDrafts` (`siteUrl`);