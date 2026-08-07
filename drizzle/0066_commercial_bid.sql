-- 0066: commercial-bid additions, split out of the ALREADY-APPLIED 0065.
-- 0065 is restored byte-identical to what is applied in prod; every statement the
-- other session folded into 0065 lives here instead. Idempotent + guarded where prod
-- has already drifted. Verified read-only against prod 2026-08-03:
--   • priorityScore ALREADY EXISTS (out-of-band 0062-era apply) -> guarded no-op.
--   • opportunityNumber: 0 non-null values, 0 duplicates, 47 NULLs -> the UNIQUE index
--     applies cleanly (MySQL permits multiple NULLs).
-- Apply BY HAND per drizzle/README.md -- never drizzle-kit migrate against prod.

-- Commercial-bid numbering sequence (ME-BID). Seed 2158 = Trello max 2157 + 1.
CREATE TABLE `numberSequences` (
	`key` varchar(48) NOT NULL,
	`nextValue` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `numberSequences_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
INSERT INTO `numberSequences` (`key`,`nextValue`) VALUES ('commercial_bid', 2158) ON DUPLICATE KEY UPDATE `key`=`key`;--> statement-breakpoint
-- Add 'declined' to the stage classification + opportunity status enums.
ALTER TABLE `opportunityStages` MODIFY COLUMN `classification` enum('open','won','lost','parked','declined') NOT NULL DEFAULT 'open';--> statement-breakpoint
ALTER TABLE `opportunities` MODIFY COLUMN `status` enum('open','awarded','lost','on_hold','cancelled','declined');--> statement-breakpoint
-- opportunityDocuments: allow storageKey-only uploads (url nullable) + add storageKey.
ALTER TABLE `opportunityDocuments` MODIFY COLUMN `url` varchar(1024);--> statement-breakpoint
ALTER TABLE `opportunityDocuments` ADD `storageKey` varchar(512);--> statement-breakpoint
-- Commercial-bid flags.
ALTER TABLE `opportunities` ADD `isBid` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `isStrategicLead` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `isStrategicProject` boolean NOT NULL DEFAULT false;--> statement-breakpoint
-- priorityScore ALREADY EXISTS in prod (out-of-band). Guard so this is a no-op there
-- but still adds the column on fresh / non-prod databases.
DROP PROCEDURE IF EXISTS `_mig0066_add_priorityscore`;--> statement-breakpoint
CREATE PROCEDURE `_mig0066_add_priorityscore`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND COLUMN_NAME='priorityScore') THEN
    ALTER TABLE `opportunities` ADD `priorityScore` tinyint unsigned;
  END IF;
END;--> statement-breakpoint
CALL `_mig0066_add_priorityscore`();--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_mig0066_add_priorityscore`;--> statement-breakpoint
-- opportunityNumber uniqueness: swap the non-unique 0065 index for a UNIQUE one.
-- Guarded/idempotent (MySQL has no DROP INDEX IF EXISTS).
DROP PROCEDURE IF EXISTS `_mig0066_uniq_oppnum`;--> statement-breakpoint
CREATE PROCEDURE `_mig0066_uniq_oppnum`()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND INDEX_NAME='opportunities_opportunityNumber_idx') THEN
    DROP INDEX `opportunities_opportunityNumber_idx` ON `opportunities`;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND INDEX_NAME='opportunities_opportunityNumber_uq') THEN
    CREATE UNIQUE INDEX `opportunities_opportunityNumber_uq` ON `opportunities` (`opportunityNumber`);
  END IF;
END;--> statement-breakpoint
CALL `_mig0066_uniq_oppnum`();--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_mig0066_uniq_oppnum`;--> statement-breakpoint
-- Seed the 17th commercial stage (Declined to Bid). Idempotent.
INSERT INTO `opportunityStages` (`pipelineKey`,`stageKey`,`name`,`sortOrder`,`isActive`,`defaultProbability`,`classification`,`isSystem`) VALUES
 ('commercial','declined_to_bid','Declined to Bid',17,true,0,'declined',true)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`sortOrder`=VALUES(`sortOrder`),`classification`=VALUES(`classification`),`isSystem`=VALUES(`isSystem`);
