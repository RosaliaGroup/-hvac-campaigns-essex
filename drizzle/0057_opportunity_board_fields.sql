ALTER TABLE `opportunities` ADD `priority` enum('low','medium','high','urgent');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `expectedCloseAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `propertyId` int;--> statement-breakpoint
ALTER TABLE `opportunityEvents` ADD `actorId` int;--> statement-breakpoint
CREATE INDEX `opportunities_stage_sortOrder_idx` ON `opportunities` (`stage`,`sortOrder`);