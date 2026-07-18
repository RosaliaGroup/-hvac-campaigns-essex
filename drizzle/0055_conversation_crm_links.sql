-- Phase 2: SMS conversation ↔ CRM links. Additive, idempotent (CREATE TABLE
-- IF NOT EXISTS). No existing table/column is touched. MySQL 9.x.
CREATE TABLE IF NOT EXISTS `smsConversationLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phoneLast10` varchar(10) NOT NULL,
	`customerId` int,
	`leadId` int,
	`leadCaptureId` int,
	`propertyId` int,
	`linkedByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsConversationLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `smsConversationLinks_phoneLast10_uq` UNIQUE(`phoneLast10`)
);
