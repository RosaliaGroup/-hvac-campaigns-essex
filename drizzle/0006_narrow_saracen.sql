ALTER TABLE `leads` ADD `score` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `priority` enum('hot','warm','cold') DEFAULT 'cold' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `lastInteractionAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `interactionCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `scoreBreakdown` text;