CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('residential','commercial') NOT NULL DEFAULT 'residential',
	`firstName` varchar(255),
	`lastName` varchar(255),
	`companyName` varchar(255),
	`displayName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`altPhone` varchar(50),
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`source` varchar(255),
	`notes` text,
	`assignedToId` int,
	`quickbooksCustomerId` varchar(64),
	`quickbooksSyncStatus` enum('not_synced','pending','synced','error') NOT NULL DEFAULT 'not_synced',
	`quickbooksSyncedAt` timestamp,
	`quickbooksSyncError` text,
	`convertedFromLeadId` int,
	`convertedFromCaptureId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_quickbooksCustomerId_unique` UNIQUE(`quickbooksCustomerId`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`label` varchar(255),
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`city` varchar(120),
	`state` varchar(10) DEFAULT 'NJ',
	`zip` varchar(20),
	`propertyType` enum('residential','commercial') NOT NULL DEFAULT 'residential',
	`squareFeet` int,
	`existingSystem` varchar(255),
	`systemNotes` text,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leadCaptures` MODIFY COLUMN `captureType` enum('exit_popup','inline_form','newsletter','download_gate','quick_quote','qualify_form','scroll_popup_residential','scroll_popup_commercial','exit_popup_residential','exit_popup_commercial','lp_heat_pump','lp_commercial_vrv','lp_emergency','lp_fb_residential','lp_fb_commercial','lp_rebate_guide','lp_maintenance','lp_referral_partner','lp_maintenance_subscription','career_application','partnership_inquiry','pseg_checklist_download','meta_lead_ad') NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `propertyId` int;--> statement-breakpoint
ALTER TABLE `callLogs` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `convertedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `convertedAt` timestamp;--> statement-breakpoint
ALTER TABLE `rebateCalculations` ADD `customerId` int;--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE INDEX `customers_displayName_idx` ON `customers` (`displayName`);--> statement-breakpoint
CREATE INDEX `properties_customerId_idx` ON `properties` (`customerId`);