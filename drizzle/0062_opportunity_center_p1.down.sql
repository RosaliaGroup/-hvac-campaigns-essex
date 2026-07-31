-- Down for 0062: Opportunity Center P1 rescope foundation.
-- The up-migration is ADDITIVE, so this is fully reversible: it drops the P1 board
-- columns/index and the event actor column, and narrows the `stage` enum back to
-- its original 5 values.
-- SAFE for the added columns — they are new in 0062 and hold no data that predates it.
-- WARNING: the `stage` MODIFY will FAIL if any opportunity currently sits in one of
-- the 6 new stages (qualified / assessment_scheduled / assessment_completed /
-- sales_document_created / negotiating / follow_up_later). Move those rows back to an
-- original stage before rolling back.
-- Order: drop the index before the columns it references.
DROP INDEX `opportunities_stage_sortOrder_idx` ON `opportunities`;--> statement-breakpoint
ALTER TABLE `opportunityEvents` DROP COLUMN `actorId`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `propertyId`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `sortOrder`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `assignedTechnicianId`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `expectedRevenue`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `expectedCloseAt`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `priority`;--> statement-breakpoint
ALTER TABLE `opportunities` MODIFY COLUMN `stage` enum('new','proposal_sent','pending','won','lost') NOT NULL DEFAULT 'new';
