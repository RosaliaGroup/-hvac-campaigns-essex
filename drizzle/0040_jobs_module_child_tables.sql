CREATE TABLE `jobAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`kind` enum('photo','document','other') NOT NULL DEFAULT 'photo',
	`fileName` varchar(255) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`mimeType` varchar(128),
	`sizeBytes` int,
	`uploadedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobLaborEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`technicianId` int,
	`workDate` timestamp,
	`startTime` timestamp,
	`endTime` timestamp,
	`durationMinutes` int,
	`description` varchar(500) NOT NULL,
	`billable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobLaborEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`body` text NOT NULL,
	`visibility` enum('internal','customer') NOT NULL DEFAULT 'internal',
	`authorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobPartsItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`description` varchar(500),
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit` varchar(32),
	`unitCost` decimal(10,2) NOT NULL DEFAULT '0',
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`billable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobPartsItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobStatusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`fromStatus` varchar(32),
	`toStatus` varchar(32) NOT NULL,
	`note` varchar(500),
	`changedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobStatusHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobTechnicians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`technicianId` int NOT NULL,
	`role` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobTechnicians_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `customerVisibleNotes` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `warrantyStatus` enum('none','manufacturer','labor','extended','warranty_call');--> statement-breakpoint
ALTER TABLE `jobs` ADD `completionSummary` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `originatingAppointmentId` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `createdById` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `scheduledStartAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `scheduledEndAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `actualArrivalAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `actualCompletionAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `archivedAt` timestamp;--> statement-breakpoint
CREATE INDEX `jobAttachments_jobId_idx` ON `jobAttachments` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobLaborEntries_jobId_idx` ON `jobLaborEntries` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobNotes_jobId_idx` ON `jobNotes` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobPartsItems_jobId_idx` ON `jobPartsItems` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobStatusHistory_jobId_idx` ON `jobStatusHistory` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobTechnicians_jobId_idx` ON `jobTechnicians` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobTechnicians_job_tech_unique` ON `jobTechnicians` (`jobId`,`technicianId`);--> statement-breakpoint
CREATE INDEX `jobs_archivedAt_idx` ON `jobs` (`archivedAt`);