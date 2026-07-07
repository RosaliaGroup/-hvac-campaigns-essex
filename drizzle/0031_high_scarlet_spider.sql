CREATE TABLE `quickbooksConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`realmId` varchar(64) NOT NULL,
	`companyName` varchar(255),
	`accessTokenEncrypted` text NOT NULL,
	`refreshTokenEncrypted` text NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`refreshExpiresAt` timestamp,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`lastRefreshAt` timestamp,
	`lastSyncAt` timestamp,
	`status` enum('connected','expired','revoked','error') NOT NULL DEFAULT 'connected',
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quickbooksConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `quickbooksConnections_realmId_unique` UNIQUE(`realmId`)
);
--> statement-breakpoint
CREATE TABLE `quickbooksSyncLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('customer','estimate','invoice','payment') NOT NULL,
	`entityId` int,
	`direction` enum('push','pull') NOT NULL,
	`realmId` varchar(64),
	`success` boolean NOT NULL,
	`durationMs` int,
	`qbId` varchar(64),
	`errorCode` varchar(64),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quickbooksSyncLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `quickbooksSyncLogs_entity_idx` ON `quickbooksSyncLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `quickbooksSyncLogs_createdAt_idx` ON `quickbooksSyncLogs` (`createdAt`);