-- Phase 2: SMS conversation ↔ CRM links. ADDITIVE, fully idempotent — the whole
-- table plus all keys are created atomically via CREATE TABLE IF NOT EXISTS
-- (indexes are INLINE, so a re-run is a clean no-op; a separate CREATE INDEX is
-- NOT idempotent in MySQL). No existing table/column is touched. MySQL 9.x.
-- phoneLast10 is the conversation identity (UNIQUE); CRM records are referenced
-- by stable id. No DB-level FKs (repo convention) → no cascade onto conversation
-- history. Rollback: DROP TABLE `smsConversationLinks` (loses only link rows,
-- never messages).
CREATE TABLE IF NOT EXISTS `smsConversationLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phoneLast10` varchar(10) NOT NULL,
	`customerId` int,
	`leadId` int,
	`leadCaptureId` int,
	`propertyId` int,
	`createdBy` varchar(255),
	`updatedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsConversationLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `smsConversationLinks_phoneLast10_uq` UNIQUE(`phoneLast10`),
	KEY `smsConversationLinks_customerId_idx` (`customerId`),
	KEY `smsConversationLinks_leadId_idx` (`leadId`),
	KEY `smsConversationLinks_leadCaptureId_idx` (`leadCaptureId`),
	KEY `smsConversationLinks_propertyId_idx` (`propertyId`)
);
