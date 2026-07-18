-- Rollback for 0056_job_lifecycle (additive migration).
-- drizzle-kit does not run down migrations; this is the reviewed, tested reverse
-- used for isolated-database apply→rollback validation and emergency rollback.
-- Purely reverses the additive changes; no data in legacy tables is touched.
DROP TABLE IF EXISTS `jobLifecycleEvents`;
--> statement-breakpoint
ALTER TABLE `jobs` DROP COLUMN `lifecycleState`;
--> statement-breakpoint
ALTER TABLE `jobs` DROP COLUMN `lifecycleReason`;
--> statement-breakpoint
ALTER TABLE `jobs` DROP COLUMN `lifecycleUpdatedAt`;
