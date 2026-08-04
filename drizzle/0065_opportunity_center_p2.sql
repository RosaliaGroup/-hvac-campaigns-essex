CREATE TABLE `opportunityChecklistItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`templateItemId` int,
	`label` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isComplete` boolean NOT NULL DEFAULT false,
	`requiredForConversion` boolean NOT NULL DEFAULT false,
	`assigneeId` int,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`completedById` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunityChecklistItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityChecklistTemplateItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`requiredForConversion` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityChecklistTemplateItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityChecklistTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunityChecklistTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`authorId` int,
	`body` text NOT NULL,
	`editedAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`category` enum('photos','drone_photos','videos','drawings','plans','scope','proposal','estimate','contract','permit','equipment','specifications','submittals','rfis','change_orders','closeout','warranty','miscellaneous') NOT NULL DEFAULT 'miscellaneous',
	`kind` enum('file','link') NOT NULL DEFAULT 'file',
	`fileName` varchar(255),
	`url` varchar(1024) NOT NULL,
	`mimeType` varchar(128),
	`sizeBytes` int,
	`uploadedById` int,
	`notes` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`teamMemberId` int NOT NULL,
	`role` varchar(48) NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunityMembers_opp_member_role_unique` UNIQUE(`opportunityId`,`teamMemberId`,`role`)
);
--> statement-breakpoint
CREATE TABLE `opportunityProjectCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`category` varchar(48) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityProjectCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunityProjectCategories_opp_category_unique` UNIQUE(`opportunityId`,`category`)
);
--> statement-breakpoint
CREATE TABLE `opportunityStages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineKey` varchar(48) NOT NULL DEFAULT 'commercial',
	`stageKey` varchar(48) NOT NULL,
	`name` varchar(80) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`defaultProbability` int,
	`classification` enum('open','won','lost','parked') NOT NULL DEFAULT 'open',
	`isSystem` boolean NOT NULL DEFAULT false,
	`color` varchar(24),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunityStages_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunityStages_pipeline_stageKey_unique` UNIQUE(`pipelineKey`,`stageKey`)
);
--> statement-breakpoint
ALTER TABLE `opportunities` ADD `stageId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `description` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `recordType` enum('qbo_residential','commercial','residential','maintenance','service_contract') DEFAULT 'qbo_residential' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `status` enum('open','awarded','lost','on_hold','cancelled');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `opportunityType` enum('commercial','residential','public_work','decarbonization','direct_replacement','new_construction','service_contract','preventive_maintenance','other');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `opportunityNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `estimatorId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `projectManagerId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `estimatedCost` decimal(12,2);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `estimatedGrossMargin` decimal(12,2);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `primaryContactId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `bidDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `siteVisitAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `proposalDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `proposalSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `followUpAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `awardedAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `lostAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `communicationPlatform` varchar(64);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `externalReference` varchar(128);--> statement-breakpoint
CREATE INDEX `opportunityChecklistItems_opportunityId_idx` ON `opportunityChecklistItems` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityChecklistTemplateItems_templateId_idx` ON `opportunityChecklistTemplateItems` (`templateId`);--> statement-breakpoint
CREATE INDEX `opportunityComments_opportunityId_idx` ON `opportunityComments` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityDocuments_opp_category_idx` ON `opportunityDocuments` (`opportunityId`,`category`);--> statement-breakpoint
CREATE INDEX `opportunityMembers_opportunityId_idx` ON `opportunityMembers` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityProjectCategories_opportunityId_idx` ON `opportunityProjectCategories` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityStages_pipeline_order_idx` ON `opportunityStages` (`pipelineKey`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `opportunities_recordType_idx` ON `opportunities` (`recordType`);--> statement-breakpoint
CREATE INDEX `opportunities_stageId_idx` ON `opportunities` (`stageId`);--> statement-breakpoint
CREATE INDEX `opportunities_opportunityNumber_idx` ON `opportunities` (`opportunityNumber`);--> statement-breakpoint
CREATE INDEX `opportunities_recordType_stageId_sortOrder_idx` ON `opportunities` (`recordType`,`stageId`,`sortOrder`);--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written DML (drizzle-kit generate emits DDL only). Seed both pipelines,
-- backfill every existing opportunity onto the residential pipeline by its stage
-- enum, derive status, and HARD-ASSERT no row is left with a NULL stageId.
-- Idempotent: stage seeds upsert on (pipelineKey,stageKey); backfills only fill NULLs.
-- NOTE: opportunities.stageId stays NULLABLE by design — QBO sync inserts rows with
-- only the `stage` enum (coexistence), so a NOT NULL column would break QBO inserts.
-- recordType is already 'qbo_residential' for existing rows via the ADD ... DEFAULT above.
-- ─────────────────────────────────────────────────────────────────────────────
-- Seed COMMERCIAL pipeline (16 system stages) — mirrors COMMERCIAL_STAGE_SEEDS.
INSERT INTO `opportunityStages` (`pipelineKey`,`stageKey`,`name`,`sortOrder`,`isActive`,`defaultProbability`,`classification`,`isSystem`) VALUES
 ('commercial','new_lead','New Lead',1,true,5,'open',true),
 ('commercial','contacted','Contacted',2,true,10,'open',true),
 ('commercial','qualified','Qualified',3,true,20,'open',true),
 ('commercial','site_visit_scheduled','Site Visit Scheduled',4,true,25,'open',true),
 ('commercial','site_visit_complete','Site Visit Complete',5,true,30,'open',true),
 ('commercial','estimating','Estimating',6,true,40,'open',true),
 ('commercial','internal_review','Internal Review',7,true,45,'open',true),
 ('commercial','proposal_sent','Proposal Sent',8,true,55,'open',true),
 ('commercial','follow_up','Follow-up',9,true,60,'open',true),
 ('commercial','negotiation','Negotiation',10,true,70,'open',true),
 ('commercial','awarded','Awarded',11,true,100,'won',true),
 ('commercial','contract_signed','Contract Signed',12,true,100,'won',true),
 ('commercial','deposit_received','Deposit Received',13,true,100,'won',true),
 ('commercial','ready_for_scheduling','Ready for Scheduling',14,true,100,'won',true),
 ('commercial','converted_to_job','Converted to Job',15,true,100,'won',true),
 ('commercial','lost','Lost',16,true,0,'lost',true)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`sortOrder`=VALUES(`sortOrder`),`defaultProbability`=VALUES(`defaultProbability`),`classification`=VALUES(`classification`),`isSystem`=VALUES(`isSystem`);--> statement-breakpoint
-- Seed RESIDENTIAL pipeline = the 11 existing `stage` enum values, classified to
-- match A2's stageMeta (follow_up_later = parked). This is the backfill target.
INSERT INTO `opportunityStages` (`pipelineKey`,`stageKey`,`name`,`sortOrder`,`isActive`,`defaultProbability`,`classification`,`isSystem`) VALUES
 ('residential','new','New',10,true,NULL,'open',true),
 ('residential','qualified','Qualified',20,true,NULL,'open',true),
 ('residential','assessment_scheduled','Assessment Scheduled',30,true,NULL,'open',true),
 ('residential','assessment_completed','Assessment Completed',40,true,NULL,'open',true),
 ('residential','sales_document_created','Sales Doc Created',50,true,NULL,'open',true),
 ('residential','proposal_sent','Proposal Sent',60,true,NULL,'open',true),
 ('residential','pending','Pending',70,true,NULL,'open',true),
 ('residential','negotiating','Negotiating',80,true,NULL,'open',true),
 ('residential','won','Won',90,true,NULL,'won',true),
 ('residential','lost','Lost',100,true,NULL,'lost',true),
 ('residential','follow_up_later','Follow Up Later',110,true,NULL,'parked',true)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`sortOrder`=VALUES(`sortOrder`),`classification`=VALUES(`classification`),`isSystem`=VALUES(`isSystem`);--> statement-breakpoint
-- Backfill stageId: every existing NON-COMMERCIAL row → residential stage matching
-- its enum. NULL-only + recordType guard so a re-run can NEVER overwrite a commercial
-- row's directly-owned stageId (commercial rows set stageId from their own pipeline).
UPDATE `opportunities` o
JOIN `opportunityStages` s ON s.`pipelineKey`='residential' AND s.`stageKey`=o.`stage`
SET o.`stageId`=s.`id`
WHERE o.`stageId` IS NULL AND o.`recordType` <> 'commercial';--> statement-breakpoint
-- Backfill status from the stage's classification (won→awarded, lost→lost, else open).
-- NULL-only + recordType guard (commercial rows own their status). NOTE: the ELSE
-- mapping is pending review of the real prod `stage` distribution (parked/dead states
-- must NOT become 'open'); this statement is provisional.
UPDATE `opportunities`
SET `status` = CASE WHEN `stage`='won' THEN 'awarded' WHEN `stage`='lost' THEN 'lost' ELSE 'open' END
WHERE `status` IS NULL AND `recordType` <> 'commercial';--> statement-breakpoint
-- HARD ASSERTION: abort the migration if any opportunity is left with a NULL stageId.
DROP PROCEDURE IF EXISTS `_assert_0065_stage_backfill`;--> statement-breakpoint
CREATE PROCEDURE `_assert_0065_stage_backfill`()
BEGIN
  DECLARE unmapped INT DEFAULT 0;
  SELECT COUNT(*) INTO unmapped FROM `opportunities` WHERE `stageId` IS NULL;
  IF unmapped > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Migration 0065 aborted: opportunities rows with NULL stageId remain after backfill';
  END IF;
END;--> statement-breakpoint
CALL `_assert_0065_stage_backfill`();--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_assert_0065_stage_backfill`;
