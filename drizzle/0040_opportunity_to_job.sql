ALTER TABLE `jobs` ADD `opportunityId` int;--> statement-breakpoint
CREATE INDEX `jobs_opportunityId_idx` ON `jobs` (`opportunityId`);