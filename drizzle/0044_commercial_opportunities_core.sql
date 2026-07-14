-- Commercial Opportunities — Phase 1 core (ADDITIVE / REVERSIBLE).
-- Introduces a configurable pipeline table and extends `opportunities` with the
-- commercial project-record fields. The legacy 5-value `stage` enum and the QBO
-- sync path (salesDocSync.ts) are left completely intact: existing rows default
-- to recordType='qbo_residential' and keep using `stage`. Commercial records use
-- the new `stageId` -> `opportunityStages` pipeline.

CREATE TABLE `opportunityStages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineKey` varchar(48) NOT NULL DEFAULT 'commercial',
	`stageKey` varchar(48) NOT NULL,
	`name` varchar(80) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`defaultProbability` int,
	`classification` enum('open','won','lost') NOT NULL DEFAULT 'open',
	`isSystem` boolean NOT NULL DEFAULT false,
	`color` varchar(24),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunityStages_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunityStages_pipeline_stageKey_unique` UNIQUE(`pipelineKey`,`stageKey`)
);
--> statement-breakpoint
CREATE INDEX `opportunityStages_pipeline_order_idx` ON `opportunityStages` (`pipelineKey`,`sortOrder`);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `recordType` enum('qbo_residential','commercial','residential','maintenance','service_contract') DEFAULT 'qbo_residential' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `stageId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `status` enum('open','awarded','lost','on_hold','cancelled');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `opportunityNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `description` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `opportunityType` enum('commercial','residential','public_work','decarbonization','direct_replacement','new_construction','service_contract','preventive_maintenance','other');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `priority` enum('low','normal','high','urgent');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `primaryContactId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `propertyId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `estimatorId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `projectManagerId` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `estimatedCost` decimal(12,2);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `estimatedGrossMargin` decimal(12,2);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `bidDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `siteVisitAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `proposalDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `proposalSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `followUpAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `expectedCloseAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `awardedAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `lostAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `communicationPlatform` varchar(64);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `externalReference` varchar(128);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `createdBy` int;--> statement-breakpoint
CREATE INDEX `opportunities_recordType_idx` ON `opportunities` (`recordType`);--> statement-breakpoint
CREATE INDEX `opportunities_stageId_idx` ON `opportunities` (`stageId`);--> statement-breakpoint
CREATE INDEX `opportunities_opportunityNumber_idx` ON `opportunities` (`opportunityNumber`);--> statement-breakpoint
CREATE INDEX `opportunities_propertyId_idx` ON `opportunities` (`propertyId`);--> statement-breakpoint
CREATE INDEX `opportunities_assignedTo_recordType_idx` ON `opportunities` (`assignedToId`,`recordType`);
