CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'quickbooks',
	`stage` enum('new','proposal_sent','pending','won','lost') NOT NULL DEFAULT 'new',
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`nextAction` varchar(255),
	`nextActionDueAt` timestamp,
	`quickbooksSalesDocumentId` int,
	`assignedToId` int,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`message` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opportunityEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunityTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`customerId` int,
	`type` enum('call','email','text') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`dueAt` timestamp NOT NULL,
	`status` enum('open','done','cancelled','snoozed','gated') NOT NULL DEFAULT 'open',
	`assignedToId` int,
	`loopStep` int NOT NULL DEFAULT 0,
	`dispatchedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunityTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quickbooksSalesDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`realmId` varchar(64),
	`quickbooksId` varchar(64) NOT NULL,
	`docType` enum('estimate','invoice') NOT NULL DEFAULT 'estimate',
	`docNumber` varchar(64),
	`quickbooksCustomerId` varchar(64),
	`customerId` int,
	`opportunityId` int,
	`status` enum('pending','accepted','closed','rejected','expired') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`txnDate` timestamp,
	`sentAt` timestamp,
	`expiresAt` timestamp,
	`documentLink` text,
	`quickbooksUpdatedAt` timestamp,
	`raw` json,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quickbooksSalesDocuments_id` PRIMARY KEY(`id`),
	CONSTRAINT `quickbooksSalesDocuments_quickbooksId_unique` UNIQUE(`quickbooksId`)
);
--> statement-breakpoint
ALTER TABLE `quickbooksConnections` ADD `salesDocCursor` timestamp;--> statement-breakpoint
ALTER TABLE `quickbooksConnections` ADD `salesDocLastSyncAt` timestamp;--> statement-breakpoint
CREATE INDEX `opportunities_customerId_idx` ON `opportunities` (`customerId`);--> statement-breakpoint
CREATE INDEX `opportunities_stage_idx` ON `opportunities` (`stage`);--> statement-breakpoint
CREATE INDEX `opportunityEvents_opportunityId_idx` ON `opportunityEvents` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityTasks_opportunityId_idx` ON `opportunityTasks` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `opportunityTasks_status_dueAt_idx` ON `opportunityTasks` (`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `qbSalesDocs_qbCustomerId_idx` ON `quickbooksSalesDocuments` (`quickbooksCustomerId`);--> statement-breakpoint
CREATE INDEX `qbSalesDocs_status_idx` ON `quickbooksSalesDocuments` (`status`);--> statement-breakpoint
CREATE INDEX `qbSalesDocs_customerId_idx` ON `quickbooksSalesDocuments` (`customerId`);--> statement-breakpoint
CREATE INDEX `qbSalesDocs_opportunityId_idx` ON `quickbooksSalesDocuments` (`opportunityId`);