-- Opportunity Center P1 rescope foundation. Renumbered from 0062 (Dispatch M2 shipped
-- 0063 first; this applies AFTER it — snapshot chains 0061→0063→0064).
-- ADDITIVE ONLY. IDEMPOTENT: every DDL step is guarded via information_schema, so it
-- applies cleanly to a FRESH DB *and* to the diverged PRODUCTION where the stage-enum
-- widening + `assignedTechnicianId` + `propertyId` were hand-applied out-of-band
-- (pre-rule era) — those three were parity-verified 2026-07-31 to match this
-- migration's intent EXACTLY (type, nullability, enum member list). MySQL has no
-- IF NOT EXISTS for ADD COLUMN / CREATE INDEX, hence the procedure. Target: MySQL 9.x
-- (prod 9.4.0).
DROP PROCEDURE IF EXISTS `__mig0064_opportunity_center`;
--> statement-breakpoint
CREATE PROCEDURE `__mig0064_opportunity_center`()
BEGIN
  DECLARE db VARCHAR(64);
  SET db = DATABASE();

  -- Widen opportunities.stage (append 6 values) only if not already widened.
  IF (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'stage') NOT LIKE '%follow_up_later%' THEN
    ALTER TABLE `opportunities` MODIFY COLUMN `stage` enum('new','proposal_sent','pending','won','lost','qualified','assessment_scheduled','assessment_completed','sales_document_created','negotiating','follow_up_later') NOT NULL DEFAULT 'new';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'priority') THEN
    ALTER TABLE `opportunities` ADD COLUMN `priority` enum('low','medium','high','urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'expectedCloseAt') THEN
    ALTER TABLE `opportunities` ADD COLUMN `expectedCloseAt` date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'expectedRevenue') THEN
    ALTER TABLE `opportunities` ADD COLUMN `expectedRevenue` decimal(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'assignedTechnicianId') THEN
    ALTER TABLE `opportunities` ADD COLUMN `assignedTechnicianId` int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'sortOrder') THEN
    ALTER TABLE `opportunities` ADD COLUMN `sortOrder` int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'propertyId') THEN
    ALTER TABLE `opportunities` ADD COLUMN `propertyId` int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunityEvents' AND COLUMN_NAME = 'actorId') THEN
    ALTER TABLE `opportunityEvents` ADD COLUMN `actorId` int;
  END IF;

  -- (stage, sortOrder) index — sortOrder is guaranteed present by the step above.
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND INDEX_NAME = 'opportunities_stage_sortOrder_idx') THEN
    CREATE INDEX `opportunities_stage_sortOrder_idx` ON `opportunities` (`stage`,`sortOrder`);
  END IF;
END;
--> statement-breakpoint
CALL `__mig0064_opportunity_center`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__mig0064_opportunity_center`;
