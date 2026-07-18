CREATE TABLE `jobWorkStatusEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`fromStatus` varchar(32),
	`toStatus` varchar(32) NOT NULL,
	`changedById` int,
	`changedByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobWorkStatusEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `technicianWorkStatus` enum('assigned','accepted','en_route','arrived','working','waiting_parts','completed') DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
CREATE INDEX `jobWorkStatusEvents_jobId_idx` ON `jobWorkStatusEvents` (`jobId`);