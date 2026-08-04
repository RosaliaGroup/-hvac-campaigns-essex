-- Down for 0065: Opportunity Center P2 (commercial pipeline + normalized stages +
-- commercial-bid additions).
-- The up-migration is ADDITIVE (new tables + new `opportunities` columns/indexes +
-- idempotent seeds), so this is fully reversible. IDEMPOTENT / guarded (mirrors the
-- guarded up) — every drop only fires if the object exists, so it is safe to run on a
-- partially-applied state.
-- SAFE: every column and table dropped here is new in 0065 and holds no data that
-- predates it. Residential/QBO opportunities keep using the `stage` enum, which this
-- migration never touched, so rolling back 0065 does not affect them.
-- NOTE: this drops the normalized `opportunityStages` model, the commercial child
-- tables, and `numberSequences` (introduced by 0065 for commercial-bid numbering). If a
-- reviewer intends `numberSequences` to survive a P2 rollback, remove its DROP below.
DROP PROCEDURE IF EXISTS `__mig0065_opportunity_center_p2_down`;
--> statement-breakpoint
CREATE PROCEDURE `__mig0065_opportunity_center_p2_down`()
BEGIN
  DECLARE db VARCHAR(64);
  SET db = DATABASE();

  -- 1. Drop the opportunities indexes before the columns they reference.
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND INDEX_NAME = 'opportunities_recordType_stageId_sortOrder_idx') THEN
    DROP INDEX `opportunities_recordType_stageId_sortOrder_idx` ON `opportunities`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND INDEX_NAME = 'opportunities_opportunityNumber_idx') THEN
    DROP INDEX `opportunities_opportunityNumber_idx` ON `opportunities`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND INDEX_NAME = 'opportunities_stageId_idx') THEN
    DROP INDEX `opportunities_stageId_idx` ON `opportunities`;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND INDEX_NAME = 'opportunities_recordType_idx') THEN
    DROP INDEX `opportunities_recordType_idx` ON `opportunities`;
  END IF;

  -- 2. Drop the columns 0065 added to `opportunities` (each guarded).
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'priorityScore') THEN ALTER TABLE `opportunities` DROP COLUMN `priorityScore`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'isStrategicProject') THEN ALTER TABLE `opportunities` DROP COLUMN `isStrategicProject`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'isStrategicLead') THEN ALTER TABLE `opportunities` DROP COLUMN `isStrategicLead`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'isBid') THEN ALTER TABLE `opportunities` DROP COLUMN `isBid`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'externalReference') THEN ALTER TABLE `opportunities` DROP COLUMN `externalReference`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'communicationPlatform') THEN ALTER TABLE `opportunities` DROP COLUMN `communicationPlatform`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'lostAt') THEN ALTER TABLE `opportunities` DROP COLUMN `lostAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'awardedAt') THEN ALTER TABLE `opportunities` DROP COLUMN `awardedAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'followUpAt') THEN ALTER TABLE `opportunities` DROP COLUMN `followUpAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'proposalSentAt') THEN ALTER TABLE `opportunities` DROP COLUMN `proposalSentAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'proposalDueAt') THEN ALTER TABLE `opportunities` DROP COLUMN `proposalDueAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'siteVisitAt') THEN ALTER TABLE `opportunities` DROP COLUMN `siteVisitAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'bidDueAt') THEN ALTER TABLE `opportunities` DROP COLUMN `bidDueAt`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'createdBy') THEN ALTER TABLE `opportunities` DROP COLUMN `createdBy`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'primaryContactId') THEN ALTER TABLE `opportunities` DROP COLUMN `primaryContactId`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'estimatedGrossMargin') THEN ALTER TABLE `opportunities` DROP COLUMN `estimatedGrossMargin`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'estimatedCost') THEN ALTER TABLE `opportunities` DROP COLUMN `estimatedCost`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'projectManagerId') THEN ALTER TABLE `opportunities` DROP COLUMN `projectManagerId`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'estimatorId') THEN ALTER TABLE `opportunities` DROP COLUMN `estimatorId`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'opportunityNumber') THEN ALTER TABLE `opportunities` DROP COLUMN `opportunityNumber`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'opportunityType') THEN ALTER TABLE `opportunities` DROP COLUMN `opportunityType`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'status') THEN ALTER TABLE `opportunities` DROP COLUMN `status`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'recordType') THEN ALTER TABLE `opportunities` DROP COLUMN `recordType`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'description') THEN ALTER TABLE `opportunities` DROP COLUMN `description`; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'stageId') THEN ALTER TABLE `opportunities` DROP COLUMN `stageId`; END IF;

  -- 3. Drop the tables 0065 created. Soft references only (no hard FKs); dropped
  --    children-first for clarity. DROP TABLE IF EXISTS is self-guarding.
  DROP TABLE IF EXISTS `opportunityChecklistItems`;
  DROP TABLE IF EXISTS `opportunityChecklistTemplateItems`;
  DROP TABLE IF EXISTS `opportunityChecklistTemplates`;
  DROP TABLE IF EXISTS `opportunityComments`;
  DROP TABLE IF EXISTS `opportunityDocuments`;
  DROP TABLE IF EXISTS `opportunityMembers`;
  DROP TABLE IF EXISTS `opportunityProjectCategories`;
  DROP TABLE IF EXISTS `opportunityStages`;
  DROP TABLE IF EXISTS `numberSequences`;
END;
--> statement-breakpoint
CALL `__mig0065_opportunity_center_p2_down`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__mig0065_opportunity_center_p2_down`;
