CREATE TABLE `ga4DailyMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` varchar(32) NOT NULL,
	`date` varchar(10) NOT NULL,
	`source` varchar(255) NOT NULL DEFAULT '',
	`medium` varchar(255) NOT NULL DEFAULT '',
	`campaign` varchar(512) NOT NULL DEFAULT '',
	`landingPage` varchar(1024) NOT NULL DEFAULT '',
	`channelGroup` varchar(64) NOT NULL DEFAULT '',
	`trafficType` enum('organic','paid','other') NOT NULL DEFAULT 'other',
	`pageViews` int NOT NULL DEFAULT 0,
	`sessions` int NOT NULL DEFAULT 0,
	`users` int NOT NULL DEFAULT 0,
	`conversions` decimal(18,4) NOT NULL DEFAULT '0',
	`events` int NOT NULL DEFAULT 0,
	`rowHash` varchar(64) NOT NULL,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ga4DailyMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `ga4DailyMetrics_rowHash_uq` UNIQUE(`rowHash`)
);
--> statement-breakpoint
CREATE TABLE `ga4SyncHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` varchar(32) NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`rangeStart` varchar(32),
	`rangeEnd` varchar(32),
	`rowsSynced` int NOT NULL DEFAULT 0,
	`trigger` varchar(32) NOT NULL DEFAULT 'manual',
	`error` text,
	CONSTRAINT `ga4SyncHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ga4DailyMetrics_property_date_idx` ON `ga4DailyMetrics` (`propertyId`,`date`);--> statement-breakpoint
CREATE INDEX `ga4DailyMetrics_date_idx` ON `ga4DailyMetrics` (`date`);--> statement-breakpoint
CREATE INDEX `ga4DailyMetrics_campaign_idx` ON `ga4DailyMetrics` (`campaign`);--> statement-breakpoint
CREATE INDEX `ga4DailyMetrics_medium_idx` ON `ga4DailyMetrics` (`medium`);--> statement-breakpoint
CREATE INDEX `ga4SyncHistory_property_idx` ON `ga4SyncHistory` (`propertyId`);--> statement-breakpoint
CREATE INDEX `ga4SyncHistory_startedAt_idx` ON `ga4SyncHistory` (`startedAt`);