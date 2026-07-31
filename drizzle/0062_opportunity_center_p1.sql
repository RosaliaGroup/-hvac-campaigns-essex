ALTER TABLE `opportunities` MODIFY COLUMN `stage` enum('new','proposal_sent','pending','won','lost','qualified','assessment_scheduled','assessment_completed','sales_document_created','negotiating','follow_up_later') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `opportunities` ADD `priority` enum('low','medium','high','urgent');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `expectedCloseAt` date;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `expectedRevenue` decimal(12,2);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `assignedTechnicianId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `propertyId` int;--> statement-breakpoint
ALTER TABLE `opportunityEvents` ADD `actorId` int;--> statement-breakpoint
CREATE INDEX `opportunities_stage_sortOrder_idx` ON `opportunities` (`stage`,`sortOrder`);