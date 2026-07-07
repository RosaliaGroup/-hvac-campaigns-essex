CREATE TABLE `appointmentAttendees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`teamMemberId` int,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`role` enum('organizer','team_member','customer','guest') NOT NULL,
	`inviteStatus` enum('pending','sent','accepted','declined','tentative','failed') NOT NULL DEFAULT 'pending',
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointmentAttendees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `googleCalendarConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`googleAccountEmail` varchar(320) NOT NULL,
	`googleCalendarId` varchar(320) NOT NULL DEFAULT 'primary',
	`accessTokenEncrypted` text NOT NULL,
	`refreshTokenEncrypted` text NOT NULL,
	`scope` text,
	`expiresAt` timestamp NOT NULL,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`lastRefreshAt` timestamp,
	`lastSyncAt` timestamp,
	`status` enum('connected','expired','revoked','error') NOT NULL DEFAULT 'connected',
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleCalendarConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleCalendarConnections_googleAccountEmail_unique` UNIQUE(`googleAccountEmail`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `googleCalendarEventId` varchar(1024);--> statement-breakpoint
ALTER TABLE `appointments` ADD `googleCalendarId` varchar(320);--> statement-breakpoint
ALTER TABLE `appointments` ADD `googleSyncStatus` enum('not_synced','synced','error') DEFAULT 'not_synced' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `googleSyncError` varchar(500);--> statement-breakpoint
ALTER TABLE `appointments` ADD `inviteStatus` enum('none','pending','sent','partial','failed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE INDEX `appointmentAttendees_appointmentId_idx` ON `appointmentAttendees` (`appointmentId`);