-- Task 8A: Tiered estimates (Good/Better/Best) + QuickBooks push on approval.
-- ADDITIVE, fully idempotent — each table plus its keys is created atomically via
-- CREATE TABLE IF NOT EXISTS (indexes are INLINE, so a re-run is a clean no-op).
-- No existing table/column is touched; `quickbooksSalesDocuments` (mirror-in only)
-- is intentionally NOT modified. No DB-level FKs (repo convention). MySQL 9.x.
-- Rollback: DROP TABLE `estimateLineItems`, `estimateOptions`, `estimates` (in that
-- order); loses only CRM-authored estimate rows, never QuickBooks data.
--
-- NUMBERING: migrations 0057–0059 are RESERVED for in-flight branches
--   (0057 = PR #71 feature/dispatch-assign-m2; 0058–0059 = opportunities follow-up),
--   so this feature claims 0060 to avoid collision.
-- APPLY BY HAND per drizzle/README.md — do NOT run db:push / drizzle-kit migrate
-- against production (prod ledger is applied manually).
CREATE TABLE IF NOT EXISTS `estimates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int NOT NULL,
	`estimateNumber` varchar(32) NOT NULL,
	`status` enum('draft','sent','viewed','approved','declined') NOT NULL DEFAULT 'draft',
	`approvedOptionId` int,
	`approvedAt` timestamp,
	`approvedSnapshot` json,
	`declineReason` text,
	`quickbooksEstimateId` varchar(64),
	`qbSyncStatus` enum('not_pushed','pushed','failed') NOT NULL DEFAULT 'not_pushed',
	`qbSyncError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimates_id` PRIMARY KEY(`id`),
	CONSTRAINT `estimates_estimateNumber_uq` UNIQUE(`estimateNumber`),
	KEY `estimates_opportunityId_idx` (`opportunityId`),
	KEY `estimates_status_idx` (`status`)
);

CREATE TABLE IF NOT EXISTS `estimateOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`estimateId` int NOT NULL,
	`tier` enum('good','better','best') NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`rebateAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`warrantyTerms` text,
	`maintenancePlan` text,
	`isApproved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimateOptions_id` PRIMARY KEY(`id`),
	KEY `estimateOptions_estimateId_idx` (`estimateId`)
);

CREATE TABLE IF NOT EXISTS `estimateLineItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`optionId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`itemType` enum('labor','part','service','equipment','other') NOT NULL DEFAULT 'service',
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimateLineItems_id` PRIMARY KEY(`id`),
	KEY `estimateLineItems_optionId_idx` (`optionId`)
);
