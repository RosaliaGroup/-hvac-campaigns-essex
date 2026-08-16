-- Rollback for 0070. Dropping these un-archives everything rather than losing records —
-- the opportunities themselves were never deleted.
DROP INDEX `opportunities_archivedAt_idx` ON `opportunities`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `archivedReason`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `archivedById`;--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `archivedAt`;
