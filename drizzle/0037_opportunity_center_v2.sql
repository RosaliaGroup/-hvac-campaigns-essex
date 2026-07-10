CREATE TABLE `customerSyncConflicts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`quickbooksCustomerId` varchar(64),
	`fieldName` varchar(64) NOT NULL,
	`conflictType` enum('missing','different','overwrite_prevented') NOT NULL,
	`crmValue` text,
	`qboValue` text,
	`status` enum('open','resolved','ignored') NOT NULL DEFAULT 'open',
	`resolution` enum('keep_crm','use_qbo','merged'),
	`notes` text,
	`resolvedById` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerSyncConflicts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `quickbooksCustomerUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `hasQboConflicts` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `billingLine1` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `billingLine2` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `billingCity` varchar(120);--> statement-breakpoint
ALTER TABLE `customers` ADD `billingState` varchar(10);--> statement-breakpoint
ALTER TABLE `customers` ADD `billingZip` varchar(20);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `probability` int;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `amountOverridden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `stageOverridden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `workCategory` enum('residential','commercial','change_order');--> statement-breakpoint
ALTER TABLE `opportunities` ADD `closeReason` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `lossReason` text;--> statement-breakpoint
CREATE INDEX `customerSyncConflicts_customerId_idx` ON `customerSyncConflicts` (`customerId`);--> statement-breakpoint
CREATE INDEX `customerSyncConflicts_status_idx` ON `customerSyncConflicts` (`status`);--> statement-breakpoint
CREATE INDEX `customerSyncConflicts_customer_field_status_idx` ON `customerSyncConflicts` (`customerId`,`fieldName`,`status`);