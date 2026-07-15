CREATE TABLE `seoPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`siteUrl` varchar(512) NOT NULL,
	`page` varchar(1024) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`pageHash` varchar(64) NOT NULL,
	`clicks` int NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	`ctr` decimal(8,6) NOT NULL DEFAULT '0',
	`position` decimal(6,2) NOT NULL DEFAULT '0',
	`previousClicks` int NOT NULL DEFAULT 0,
	`previousImpressions` int NOT NULL DEFAULT 0,
	`indexStatus` enum('indexed','crawled_not_indexed','discovered_not_indexed','excluded') NOT NULL DEFAULT 'indexed',
	`lastIndexedAt` timestamp,
	`searchConsoleIssue` varchar(512),
	`title` varchar(512),
	`metaDescription` varchar(1024),
	`h1` varchar(512),
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'low',
	`category` enum('commercial','residential','blog','city_page','other') NOT NULL DEFAULT 'other',
	`issue` varchar(512),
	`status` enum('needs_review','queued','optimizing','published','waiting_for_indexing','ranking_improved') NOT NULL DEFAULT 'needs_review',
	`problems` json,
	`lastSyncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seoPages_id` PRIMARY KEY(`id`),
	CONSTRAINT `seoPages_pageHash_uq` UNIQUE(`pageHash`)
);
--> statement-breakpoint
CREATE TABLE `seoQueries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`siteUrl` varchar(512) NOT NULL,
	`query` varchar(512) NOT NULL,
	`page` varchar(1024),
	`clicks` int NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	`ctr` decimal(8,6) NOT NULL DEFAULT '0',
	`position` decimal(6,2) NOT NULL DEFAULT '0',
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seoQueries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seoSyncHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`siteUrl` varchar(512) NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`rangeStart` varchar(32),
	`rangeEnd` varchar(32),
	`pagesSynced` int NOT NULL DEFAULT 0,
	`queriesSynced` int NOT NULL DEFAULT 0,
	`trigger` varchar(32) NOT NULL DEFAULT 'manual',
	`error` text,
	CONSTRAINT `seoSyncHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `seoPages_site_idx` ON `seoPages` (`siteUrl`);--> statement-breakpoint
CREATE INDEX `seoPages_priority_idx` ON `seoPages` (`priority`);--> statement-breakpoint
CREATE INDEX `seoQueries_site_idx` ON `seoQueries` (`siteUrl`);--> statement-breakpoint
CREATE INDEX `seoSyncHistory_site_idx` ON `seoSyncHistory` (`siteUrl`);--> statement-breakpoint
CREATE INDEX `seoSyncHistory_startedAt_idx` ON `seoSyncHistory` (`startedAt`);