ALTER TABLE `appointments` ADD `scheduledAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` ADD `durationMinutes` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `assignedToId` int;