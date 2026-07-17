CREATE TABLE `customerDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`category` enum('proposal','invoice','permit','warranty','contract','report','photo','other') NOT NULL DEFAULT 'other',
	`title` varchar(255) NOT NULL,
	`fileName` varchar(255),
	`url` varchar(1024),
	`storageKey` varchar(512),
	`mimeType` varchar(127),
	`sizeBytes` int,
	`uploadedBy` enum('customer','staff') NOT NULL DEFAULT 'staff',
	`visibleToCustomer` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerEquipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`propertyId` int,
	`category` varchar(100),
	`make` varchar(120),
	`model` varchar(120),
	`serialNumber` varchar(120),
	`location` varchar(255),
	`installedAt` timestamp,
	`status` enum('active','retired') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerEquipment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `equipmentWarranties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`equipmentId` int,
	`type` enum('manufacturer','labor','extended','parts','home') NOT NULL DEFAULT 'manufacturer',
	`provider` varchar(255),
	`policyNumber` varchar(120),
	`coverage` text,
	`startsAt` timestamp,
	`expiresAt` timestamp,
	`status` enum('active','expired','void') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipmentWarranties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceAgreements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`planName` varchar(255) NOT NULL,
	`tier` varchar(100),
	`status` enum('active','pending','expired','cancelled') NOT NULL DEFAULT 'active',
	`billingFrequency` enum('monthly','quarterly','annual','one_time') NOT NULL DEFAULT 'annual',
	`price` decimal(12,2),
	`visitsPerYear` int,
	`startsAt` timestamp,
	`renewsAt` timestamp,
	`nextServiceAt` timestamp,
	`coverage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceAgreements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portalAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255),
	`name` varchar(255),
	`status` enum('invited','active','suspended') NOT NULL DEFAULT 'active',
	`loginToken` varchar(128),
	`loginTokenExpiresAt` timestamp,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portalAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `portalAccounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `portalMessageThreads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`customerUnread` int NOT NULL DEFAULT 0,
	`staffUnread` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portalMessageThreads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portalMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` int NOT NULL,
	`customerId` int NOT NULL,
	`sender` enum('customer','staff') NOT NULL,
	`authorId` int,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portalMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portalPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`invoiceId` int,
	`invoiceNumber` varchar(64),
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`method` enum('card','ach','cash','check','other') NOT NULL DEFAULT 'card',
	`status` enum('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripeSessionId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portalPayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `customerDocuments_customerId_idx` ON `customerDocuments` (`customerId`);--> statement-breakpoint
CREATE INDEX `customerDocuments_category_idx` ON `customerDocuments` (`category`);--> statement-breakpoint
CREATE INDEX `customerEquipment_customerId_idx` ON `customerEquipment` (`customerId`);--> statement-breakpoint
CREATE INDEX `customerEquipment_propertyId_idx` ON `customerEquipment` (`propertyId`);--> statement-breakpoint
CREATE INDEX `equipmentWarranties_customerId_idx` ON `equipmentWarranties` (`customerId`);--> statement-breakpoint
CREATE INDEX `equipmentWarranties_equipmentId_idx` ON `equipmentWarranties` (`equipmentId`);--> statement-breakpoint
CREATE INDEX `maintenanceAgreements_customerId_idx` ON `maintenanceAgreements` (`customerId`);--> statement-breakpoint
CREATE INDEX `portalAccounts_customerId_idx` ON `portalAccounts` (`customerId`);--> statement-breakpoint
CREATE INDEX `portalAccounts_loginToken_idx` ON `portalAccounts` (`loginToken`);--> statement-breakpoint
CREATE INDEX `portalMessageThreads_customerId_idx` ON `portalMessageThreads` (`customerId`);--> statement-breakpoint
CREATE INDEX `portalMessageThreads_lastMessageAt_idx` ON `portalMessageThreads` (`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `portalMessages_threadId_idx` ON `portalMessages` (`threadId`);--> statement-breakpoint
CREATE INDEX `portalMessages_customerId_idx` ON `portalMessages` (`customerId`);--> statement-breakpoint
CREATE INDEX `portalPayments_customerId_idx` ON `portalPayments` (`customerId`);--> statement-breakpoint
CREATE INDEX `portalPayments_invoiceId_idx` ON `portalPayments` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `portalPayments_stripeSessionId_idx` ON `portalPayments` (`stripeSessionId`);