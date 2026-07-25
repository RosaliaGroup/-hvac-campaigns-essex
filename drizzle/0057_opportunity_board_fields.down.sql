-- Rollback for 0057_opportunity_board_fields (additive → fully reversible).
-- Drops the Opportunity Center board columns/index and the event actor column.
-- SAFE: these columns are new in 0057 and hold no data that predates it.
-- Order: drop the index before the columns it references.
DROP INDEX `opportunities_stage_sortOrder_idx` ON `opportunities`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `priority`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `expectedCloseAt`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `sortOrder`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `propertyId`;--> statement-breakpoint
ALTER TABLE `opportunityEvents` DROP COLUMN `actorId`;
