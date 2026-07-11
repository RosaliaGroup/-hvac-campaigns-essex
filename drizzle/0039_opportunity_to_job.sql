ALTER TABLE `jobs` ADD `opportunityId` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_opportunityId_opportunities_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `opportunities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `jobs_opportunityId_idx` ON `jobs` (`opportunityId`);