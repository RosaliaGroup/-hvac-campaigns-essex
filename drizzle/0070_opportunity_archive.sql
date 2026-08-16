-- 0070: archive an opportunity instead of deleting it.
-- Additive: three nullable columns plus an index. No backfill — every existing row is
-- live (archivedAt NULL), which is the correct starting state.
-- Apply BY HAND per drizzle/README.md.

ALTER TABLE `opportunities` ADD COLUMN `archivedAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD COLUMN `archivedById` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD COLUMN `archivedReason` varchar(500);--> statement-breakpoint
-- Every list filters on archivedAt IS NULL, so it needs to be indexed.
CREATE INDEX `opportunities_archivedAt_idx` ON `opportunities` (`archivedAt`);
