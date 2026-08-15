-- 0067: Trello-style board columns for the commercial opportunity checklist.
-- Additive and non-destructive: one enum column with a safe default, a backfill
-- from the existing isComplete flag, and a covering index for board reads.
-- Apply BY HAND per drizzle/README.md — never drizzle-kit migrate against prod.

ALTER TABLE `opportunityChecklistItems` ADD COLUMN `boardStatus` enum('todo','doing','done') DEFAULT 'todo' NOT NULL;--> statement-breakpoint
-- Existing completed items land in the Done column so the board matches reality.
UPDATE `opportunityChecklistItems` SET `boardStatus` = 'done' WHERE `isComplete` = 1;--> statement-breakpoint
CREATE INDEX `opportunityChecklistItems_board_idx` ON `opportunityChecklistItems` (`opportunityId`,`boardStatus`,`sortOrder`);
