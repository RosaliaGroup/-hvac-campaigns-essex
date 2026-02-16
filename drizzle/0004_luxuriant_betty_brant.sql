CREATE TABLE `dripCampaignSchedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadCaptureId` int NOT NULL,
	`templateId` int NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dripCampaignSchedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dripCampaignTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`dayNumber` int NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dripCampaignTemplates_id` PRIMARY KEY(`id`)
);
