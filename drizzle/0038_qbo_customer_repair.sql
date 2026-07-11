CREATE TABLE `qboRepairAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(64) NOT NULL,
	`kind` varchar(24) NOT NULL,
	`actor` varchar(128),
	`parserVersion` varchar(32),
	`manifestHash` varchar(128),
	`customerId` int NOT NULL,
	`quickbooksCustomerId` varchar(64),
	`fieldName` varchar(64) NOT NULL,
	`beforeValue` text,
	`afterValue` text,
	`createdPropertyId` int,
	`opportunityId` int,
	`result` varchar(24) NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qboRepairAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `quickbooksCustomerCheckedAt` timestamp;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `projectReference` varchar(64);--> statement-breakpoint
CREATE INDEX `qboRepairAuditLog_runId_idx` ON `qboRepairAuditLog` (`runId`);--> statement-breakpoint
CREATE INDEX `qboRepairAuditLog_customerId_idx` ON `qboRepairAuditLog` (`customerId`);--> statement-breakpoint
CREATE INDEX `opportunities_projectReference_idx` ON `opportunities` (`projectReference`);