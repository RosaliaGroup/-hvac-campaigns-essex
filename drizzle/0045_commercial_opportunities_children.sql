-- Commercial Opportunities — Phase 1 child tables (ADDITIVE / REVERSIBLE).
-- The Opportunity is the master project record; these tables hang off it.
-- All follow existing conventions (int PK, camelCase, no DB-level FK, metadata-only
-- documents like jobAttachments). Reversibility = DROP TABLE on each.

CREATE TABLE `opportunityProjectCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`category` varchar(48) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityProjectCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `opportunityProjectCategories_opp_category_unique` UNIQUE(`opportunityId`,`category`)
);
--> statement-breakpoint
CREATE INDEX `opportunityProjectCategories_opportunityId_idx` ON `opportunityProjectCategories` (`opportunityId`);--> statement-breakpoint
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
CREATE INDEX `opportunityMembers_opportunityId_idx` ON `opportunityMembers` (`opportunityId`);--> statement-breakpoint
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
CREATE INDEX `opportunityChecklistTemplateItems_templateId_idx` ON `opportunityChecklistTemplateItems` (`templateId`);--> statement-breakpoint
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
CREATE INDEX `opportunityChecklistItems_opportunityId_idx` ON `opportunityChecklistItems` (`opportunityId`);--> statement-breakpoint
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
CREATE INDEX `opportunityComments_opportunityId_idx` ON `opportunityComments` (`opportunityId`);--> statement-breakpoint
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
CREATE INDEX `opportunityDocuments_opportunityId_idx` ON `opportunityDocuments` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityDocuments_opp_category_idx` ON `opportunityDocuments` (`opportunityId`,`category`);
