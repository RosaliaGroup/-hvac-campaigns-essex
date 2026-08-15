-- Rollback for 0068. Drops grouping only; every checklist item and its completion
-- state survives, because groupId is additive and never carried unique data.
DROP INDEX `opportunityChecklistItems_groupId_idx` ON `opportunityChecklistItems`;--> statement-breakpoint
ALTER TABLE `opportunityChecklistTemplateItems` DROP COLUMN `groupName`;--> statement-breakpoint
ALTER TABLE `opportunityChecklistItems` DROP COLUMN `groupId`;--> statement-breakpoint
DROP TABLE `opportunityChecklistGroups`;
