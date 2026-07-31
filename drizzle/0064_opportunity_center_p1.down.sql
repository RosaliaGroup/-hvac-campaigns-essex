-- Down for 0064: Opportunity Center P1 rescope foundation.
-- The up-migration is ADDITIVE, so this is fully reversible: it drops the P1 board
-- columns/index and the event actor column, and narrows the `stage` enum back to its
-- original 5 values. IDEMPOTENT / guarded (mirrors the guarded up) — safe to run on a
-- partially-applied state; each drop only fires if the object exists.
-- SAFE for the added columns — they are new in 0064 and hold no data that predates it.
-- WARNING: the `stage` MODIFY will FAIL if any opportunity currently sits in one of the
-- 6 new stages (qualified / assessment_scheduled / assessment_completed /
-- sales_document_created / negotiating / follow_up_later). Move those rows back to an
-- original stage before rolling back.
DROP PROCEDURE IF EXISTS `__mig0064_opportunity_center_down`;
--> statement-breakpoint
CREATE PROCEDURE `__mig0064_opportunity_center_down`()
BEGIN
  DECLARE db VARCHAR(64);
  SET db = DATABASE();

  -- Drop the index before the columns it references.
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND INDEX_NAME = 'opportunities_stage_sortOrder_idx') THEN
    DROP INDEX `opportunities_stage_sortOrder_idx` ON `opportunities`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunityEvents' AND COLUMN_NAME = 'actorId') THEN
    ALTER TABLE `opportunityEvents` DROP COLUMN `actorId`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'propertyId') THEN
    ALTER TABLE `opportunities` DROP COLUMN `propertyId`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'sortOrder') THEN
    ALTER TABLE `opportunities` DROP COLUMN `sortOrder`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'assignedTechnicianId') THEN
    ALTER TABLE `opportunities` DROP COLUMN `assignedTechnicianId`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'expectedRevenue') THEN
    ALTER TABLE `opportunities` DROP COLUMN `expectedRevenue`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'expectedCloseAt') THEN
    ALTER TABLE `opportunities` DROP COLUMN `expectedCloseAt`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'priority') THEN
    ALTER TABLE `opportunities` DROP COLUMN `priority`;
  END IF;

  -- Narrow the stage enum back to its original 5 values only if currently widened.
  IF (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'stage') LIKE '%follow_up_later%' THEN
    ALTER TABLE `opportunities` MODIFY COLUMN `stage` enum('new','proposal_sent','pending','won','lost') NOT NULL DEFAULT 'new';
  END IF;
END;
--> statement-breakpoint
CALL `__mig0064_opportunity_center_down`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__mig0064_opportunity_center_down`;
