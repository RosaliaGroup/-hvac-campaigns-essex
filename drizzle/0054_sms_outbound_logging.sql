-- Phase 1: SMS Inbox outbound logging.
-- ADDITIVE ONLY — no column is dropped or renamed. Idempotent: every DDL step is
-- guarded via information_schema, so a repeated or partially-applied run is safe
-- (MySQL has no IF NOT EXISTS for ADD COLUMN / CREATE INDEX). Backfills are
-- guarded by IS NULL. Target engine: MySQL 9.x (production confirmed 9.4.0).
DROP PROCEDURE IF EXISTS `__mig0054_sms_outbound`;
--> statement-breakpoint
CREATE PROCEDURE `__mig0054_sms_outbound`()
BEGIN
  DECLARE db VARCHAR(64);
  SET db = DATABASE();

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'phoneLast10') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `phoneLast10` varchar(10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'fromNumber') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `fromNumber` varchar(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'toNumber') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `toNumber` varchar(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'provider') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `provider` varchar(30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'source') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `source` varchar(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'deliveryStatus') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `deliveryStatus` enum('queued','accepted','sent','delivered','delivery_failed','rejected','carrier_filtered','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'deliveryErrorCode') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `deliveryErrorCode` varchar(16);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND COLUMN_NAME = 'sentAt') THEN
    ALTER TABLE `smsInboxMessages` ADD COLUMN `sentAt` timestamp NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND INDEX_NAME = 'smsInboxMessages_phoneLast10_idx') THEN
    CREATE INDEX `smsInboxMessages_phoneLast10_idx` ON `smsInboxMessages` (`phoneLast10`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND INDEX_NAME = 'smsInboxMessages_phone_idx') THEN
    CREATE INDEX `smsInboxMessages_phone_idx` ON `smsInboxMessages` (`phone`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'smsInboxMessages' AND INDEX_NAME = 'smsInboxMessages_textBeltId_idx') THEN
    CREATE INDEX `smsInboxMessages_textBeltId_idx` ON `smsInboxMessages` (`textBeltId`);
  END IF;
END;
--> statement-breakpoint
CALL `__mig0054_sms_outbound`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__mig0054_sms_outbound`;
--> statement-breakpoint
-- Backfill the indexed conversation key for existing rows (idempotent).
UPDATE `smsInboxMessages` SET `phoneLast10` = RIGHT(REGEXP_REPLACE(`phone`, '[^0-9]', ''), 10) WHERE `phoneLast10` IS NULL AND `phone` IS NOT NULL;--> statement-breakpoint
-- Telnyx is the sole SMS provider; label existing rows for consistency (idempotent).
UPDATE `smsInboxMessages` SET `provider` = 'telnyx' WHERE `provider` IS NULL;
