-- Rollback for 0067. Drops board state only; isComplete is untouched and remains
-- the authoritative completion signal, so no checklist data is lost.
DROP INDEX `opportunityChecklistItems_board_idx` ON `opportunityChecklistItems`;--> statement-breakpoint
ALTER TABLE `opportunityChecklistItems` DROP COLUMN `boardStatus`;
