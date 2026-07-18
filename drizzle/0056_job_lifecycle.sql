CREATE TABLE `jobLifecycleEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`fromState` varchar(32),
	`toState` varchar(32) NOT NULL,
	`source` varchar(32) NOT NULL,
	`actorId` int,
	`actorRole` varchar(32),
	`actorName` varchar(255),
	`reason` varchar(255),
	`idempotencyKey` varchar(191) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobLifecycleEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobLifecycleEvents_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `lifecycleState` enum('new','scheduled','dispatched','in_progress','on_hold','work_complete','invoiced','paid','closed','cancelled');--> statement-breakpoint
ALTER TABLE `jobs` ADD `lifecycleReason` varchar(255);--> statement-breakpoint
ALTER TABLE `jobs` ADD `lifecycleUpdatedAt` timestamp;--> statement-breakpoint
CREATE INDEX `jobLifecycleEvents_jobId_idx` ON `jobLifecycleEvents` (`jobId`);