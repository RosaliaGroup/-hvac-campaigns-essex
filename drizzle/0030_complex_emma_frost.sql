CREATE TABLE `jobLineItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`type` enum('labor','part','service','equipment','other') NOT NULL DEFAULT 'labor',
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobLineItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobNumber` varchar(32) NOT NULL DEFAULT '',
	`customerId` int NOT NULL,
	`propertyId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`jobType` enum('service_call','diagnostic','repair','maintenance','installation','replacement','estimate','commercial_hvac','residential_hvac','boiler','furnace','ac','heat_pump','mini_split','rooftop_unit','refrigeration','other'),
	`priority` enum('normal','urgent','emergency') NOT NULL DEFAULT 'normal',
	`status` enum('new','scheduled','in_progress','waiting_parts','estimate_sent','approved','completed','invoice_sent','paid','closed','cancelled') NOT NULL DEFAULT 'new',
	`assignedToId` int,
	`equipmentServiced` text,
	`internalNotes` text,
	`completedAt` timestamp,
	`quickbooksEstimateId` varchar(64),
	`quickbooksInvoiceId` varchar(64),
	`quickbooksSyncStatus` enum('not_synced','pending','synced','error') NOT NULL DEFAULT 'not_synced',
	`quickbooksSyncedAt` timestamp,
	`quickbooksSyncError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `jobId` int;--> statement-breakpoint
CREATE INDEX `jobLineItems_jobId_idx` ON `jobLineItems` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobs_customerId_idx` ON `jobs` (`customerId`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_jobNumber_idx` ON `jobs` (`jobNumber`);