CREATE TABLE `companySettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requireCompletionSignature` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companySettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobCompletions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`completedById` int,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`noteMode` enum('note','no_note') NOT NULL DEFAULT 'note',
	`hadSignature` boolean NOT NULL DEFAULT false,
	`travelMs` int NOT NULL DEFAULT 0,
	`laborMs` int NOT NULL DEFAULT 0,
	`pauseMs` int NOT NULL DEFAULT 0,
	`elapsedMs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobCompletions_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobCompletions_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `jobFieldParts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`partNumber` varchar(120),
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit` varchar(32),
	`notes` varchar(500),
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobFieldParts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobSignatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`data` mediumtext NOT NULL,
	`technicianId` int,
	`signedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobSignatures_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobSignatures_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `jobTimeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`eventType` enum('travel_start','arrived','work_start','pause','resume','work_finish') NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobTimeEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `jobCompletions_jobId_idx` ON `jobCompletions` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobFieldParts_jobId_idx` ON `jobFieldParts` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobSignatures_jobId_idx` ON `jobSignatures` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobTimeEvents_jobId_idx` ON `jobTimeEvents` (`jobId`);