-- 0076: Growth system (docs/growth-system-spec.md) — speed-to-lead, follow-up
-- cadence, review engine, contact import, scoreboard.
--
-- NOT applied — for manual apply per drizzle/README.md (this repo's convention:
-- migrations are never applied by an agent, only by the owner by hand).
--
-- Additive only:
--   - `consentStatus` added to `leads` and `leadCaptures` (a bridging migration was
--     needed despite the leads/leadCaptures union staying code-level — see the
--     build report for why a DB view alone could not carry a new writable column
--     on both source tables).
--   - `leadCaptures.formVersion` added: web leads only get `consentStatus='opt_in'`
--     when the submitting form's version matches shared/leadFormVersion.ts's
--     TCPA_FORM_VERSION (i.e. it shipped the TCPA disclosure line) — computed in
--     server/routers.ts's leadCaptures.create, NOT by this column's DB default.
--     `leads` keeps its unconditional 'opt_in' default: that table has no form/UI
--     of its own (phone/manual/CRM-side entries only), so no form-version gate
--     applies there.
--   - 6 new tables: growthCadences, growthCadenceTasks, growthTouches,
--     reviewRequests, contactImportBatches, importedContacts.
-- No existing table is dropped, renamed, or has a column removed. No backfill.

ALTER TABLE `leads` ADD `consentStatus` enum('customer','opt_in','unknown') NOT NULL DEFAULT 'opt_in';--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `consentStatus` enum('customer','opt_in','unknown') NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `leadCaptures` ADD `formVersion` varchar(32);--> statement-breakpoint

CREATE TABLE `growthCadences` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadTable` enum('leads','leadCaptures','imported') NOT NULL,
  `leadId` int NOT NULL,
  `contactPhone` varchar(50),
  `contactEmail` varchar(320),
  `firstName` varchar(255),
  `need` varchar(30) NOT NULL DEFAULT 'general',
  `consentStatus` enum('customer','opt_in','unknown') NOT NULL,
  `campaignType` varchar(50) NOT NULL DEFAULT 'lead_cadence',
  `status` enum('active','replied','booked','stopped','nurture') NOT NULL DEFAULT 'active',
  `currentStep` int NOT NULL DEFAULT 0,
  `stoppedReason` varchar(255),
  `b2b` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `growthCadences_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `growthCadences_lead_idx` ON `growthCadences` (`leadTable`,`leadId`);--> statement-breakpoint
CREATE INDEX `growthCadences_phone_idx` ON `growthCadences` (`contactPhone`);--> statement-breakpoint
CREATE INDEX `growthCadences_status_idx` ON `growthCadences` (`status`);--> statement-breakpoint

CREATE TABLE `growthCadenceTasks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `cadenceId` int NOT NULL,
  `step` int NOT NULL,
  `channel` enum('sms','call','email') NOT NULL,
  `dueAt` timestamp NOT NULL,
  `status` enum('open','gated','held','done','cancelled','failed') NOT NULL DEFAULT 'open',
  `body` text,
  `dispatchedAt` timestamp NULL,
  `lastError` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `growthCadenceTasks_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `growthCadenceTasks_cadenceId_idx` ON `growthCadenceTasks` (`cadenceId`);--> statement-breakpoint
CREATE INDEX `growthCadenceTasks_due_idx` ON `growthCadenceTasks` (`status`,`dueAt`);--> statement-breakpoint

CREATE TABLE `growthTouches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `channel` enum('sms','call','email') NOT NULL,
  `contactPhone` varchar(50),
  `contactEmail` varchar(320),
  `leadTable` enum('leads','leadCaptures','imported','customer'),
  `leadId` int,
  `campaignType` varchar(50) NOT NULL,
  `cadenceId` int,
  `step` int,
  `status` enum('sent','failed','blocked','held') NOT NULL,
  `blockedReason` varchar(60),
  `subject` varchar(255),
  `body` text,
  `providerMessageId` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `growthTouches_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `growthTouches_contactCampaign_idx` ON `growthTouches` (`contactPhone`,`campaignType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `growthTouches_emailCampaign_idx` ON `growthTouches` (`contactEmail`,`campaignType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `growthTouches_channel_idx` ON `growthTouches` (`channel`,`createdAt`);--> statement-breakpoint

CREATE TABLE `reviewRequests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `jobId` int,
  `appointmentId` int,
  `customerId` int,
  `phone` varchar(50) NOT NULL,
  `status` enum('pending','sent','responded','reminded','done') NOT NULL DEFAULT 'pending',
  `sentAt` timestamp NULL,
  `score` int,
  `respondedAt` timestamp NULL,
  `reminderSentAt` timestamp NULL,
  `ownerFollowupTaskCreatedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `reviewRequests_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `reviewRequests_jobId_uq` ON `reviewRequests` (`jobId`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviewRequests_appointmentId_uq` ON `reviewRequests` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `reviewRequests_phone_idx` ON `reviewRequests` (`phone`);--> statement-breakpoint
CREATE INDEX `reviewRequests_status_idx` ON `reviewRequests` (`status`);--> statement-breakpoint

CREATE TABLE `contactImportBatches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `filename` varchar(255) NOT NULL,
  `importedById` int,
  `rowCount` int NOT NULL DEFAULT 0,
  `status` enum('pending_review','released','rolled_back') NOT NULL DEFAULT 'pending_review',
  `releaseAt` timestamp NOT NULL,
  `releasedAt` timestamp NULL,
  `rolledBackAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `contactImportBatches_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

CREATE TABLE `importedContacts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `batchId` int NOT NULL,
  `name` varchar(255),
  `phone` varchar(50),
  `email` varchar(320),
  `company` varchar(255),
  `address` varchar(500),
  `type` enum('residential','commercial','pm','gc') NOT NULL DEFAULT 'residential',
  `lastJobDate` date,
  `notes` text,
  `consent` enum('customer','opt_in','unknown') NOT NULL DEFAULT 'unknown',
  `status` enum('pending_review','active','removed','rolled_back') NOT NULL DEFAULT 'pending_review',
  `mergedCustomerId` int,
  `cadenceId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `importedContacts_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `importedContacts_batchId_idx` ON `importedContacts` (`batchId`);--> statement-breakpoint
CREATE INDEX `importedContacts_phone_idx` ON `importedContacts` (`phone`);--> statement-breakpoint
CREATE INDEX `importedContacts_email_idx` ON `importedContacts` (`email`);
