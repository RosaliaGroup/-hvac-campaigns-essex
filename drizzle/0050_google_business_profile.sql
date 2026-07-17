CREATE TABLE `gbpDailyMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationName` varchar(256) NOT NULL,
	`date` varchar(10) NOT NULL,
	`metricHash` varchar(64) NOT NULL,
	`callClicks` int NOT NULL DEFAULT 0,
	`directionRequests` int NOT NULL DEFAULT 0,
	`websiteClicks` int NOT NULL DEFAULT 0,
	`searchViews` int NOT NULL DEFAULT 0,
	`mapsViews` int NOT NULL DEFAULT 0,
	`rating` decimal(3,2) NOT NULL DEFAULT '0',
	`reviewCount` int NOT NULL DEFAULT 0,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gbpDailyMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `gbpDailyMetrics_metricHash_uq` UNIQUE(`metricHash`)
);
--> statement-breakpoint
CREATE TABLE `gbpLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(128) NOT NULL,
	`locationId` varchar(128) NOT NULL,
	`locationName` varchar(256) NOT NULL,
	`title` varchar(512),
	`storefrontAddress` varchar(512),
	`primaryPhone` varchar(64),
	`websiteUrl` varchar(512),
	`rating` decimal(3,2) NOT NULL DEFAULT '0',
	`totalReviews` int NOT NULL DEFAULT 0,
	`totalPhotos` int NOT NULL DEFAULT 0,
	`totalPosts` int NOT NULL DEFAULT 0,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gbpLocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `gbpLocations_locationName_unique` UNIQUE(`locationName`)
);
--> statement-breakpoint
CREATE TABLE `gbpPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationName` varchar(256) NOT NULL,
	`mediaName` text NOT NULL,
	`mediaHash` varchar(64) NOT NULL,
	`category` varchar(64),
	`googleUrl` text,
	`viewCount` int NOT NULL DEFAULT 0,
	`createTime` timestamp,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gbpPhotos_id` PRIMARY KEY(`id`),
	CONSTRAINT `gbpPhotos_mediaHash_uq` UNIQUE(`mediaHash`)
);
--> statement-breakpoint
CREATE TABLE `gbpPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationName` varchar(256) NOT NULL,
	`postName` text NOT NULL,
	`postHash` varchar(64) NOT NULL,
	`summary` text,
	`topicType` varchar(64),
	`state` varchar(64),
	`searchUrl` text,
	`createTime` timestamp,
	`updateTime` timestamp,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gbpPosts_id` PRIMARY KEY(`id`),
	CONSTRAINT `gbpPosts_postHash_uq` UNIQUE(`postHash`)
);
--> statement-breakpoint
CREATE TABLE `gbpReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationName` varchar(256) NOT NULL,
	`reviewName` text NOT NULL,
	`reviewHash` varchar(64) NOT NULL,
	`reviewerName` varchar(256),
	`starRating` int NOT NULL DEFAULT 0,
	`comment` text,
	`createTime` timestamp,
	`updateTime` timestamp,
	`replyComment` text,
	`replyTime` timestamp,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gbpReviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `gbpReviews_reviewHash_uq` UNIQUE(`reviewHash`)
);
--> statement-breakpoint
CREATE TABLE `gbpSyncHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationName` varchar(256) NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`rangeStart` varchar(32),
	`rangeEnd` varchar(32),
	`reviewsSynced` int NOT NULL DEFAULT 0,
	`metricsSynced` int NOT NULL DEFAULT 0,
	`photosSynced` int NOT NULL DEFAULT 0,
	`postsSynced` int NOT NULL DEFAULT 0,
	`trigger` varchar(32) NOT NULL DEFAULT 'manual',
	`error` text,
	CONSTRAINT `gbpSyncHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `gbpDailyMetrics_loc_idx` ON `gbpDailyMetrics` (`locationName`);--> statement-breakpoint
CREATE INDEX `gbpDailyMetrics_date_idx` ON `gbpDailyMetrics` (`date`);--> statement-breakpoint
CREATE INDEX `gbpPhotos_loc_idx` ON `gbpPhotos` (`locationName`);--> statement-breakpoint
CREATE INDEX `gbpPosts_loc_idx` ON `gbpPosts` (`locationName`);--> statement-breakpoint
CREATE INDEX `gbpReviews_loc_idx` ON `gbpReviews` (`locationName`);--> statement-breakpoint
CREATE INDEX `gbpReviews_createTime_idx` ON `gbpReviews` (`createTime`);--> statement-breakpoint
CREATE INDEX `gbpSyncHistory_loc_idx` ON `gbpSyncHistory` (`locationName`);--> statement-breakpoint
CREATE INDEX `gbpSyncHistory_startedAt_idx` ON `gbpSyncHistory` (`startedAt`);