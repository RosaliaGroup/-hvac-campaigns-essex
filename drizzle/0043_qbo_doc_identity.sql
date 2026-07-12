-- 0043 — QBO document composite identity (realmId, docType, quickbooksId).
--
-- RECONCILED TO BE IDEMPOTENT. Production already had this change applied
-- out-of-band (the single-column unique `quickbooksSalesDocuments_quickbooksId_unique`
-- was dropped and the composite unique `qbSalesDocs_realm_docType_qboId_uq` was
-- created + verified manually), but that manual change left NO row in
-- `__drizzle_migrations`. drizzle-kit migrate gates on created_at timestamps, so
-- it WILL re-encounter 0043 on production. A raw `DROP INDEX` / `ADD CONSTRAINT`
-- would then fail (index already gone / constraint already present).
--
-- These guards make each step a no-op when the target state is already in place,
-- while still applying cleanly on fresh environments (dev / CI / staging) so the
-- schema stays consistent with schema.ts and the snapshot. Statements run via the
-- mysql2 text protocol on one connection, so SET/PREPARE/EXECUTE/DEALLOCATE and
-- @session vars are valid and persist across statement-breakpoints.
--
-- Do NOT hand-run the raw DROP again during deployment; running migrate is safe.
SET @has_old_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE table_schema = DATABASE() AND table_name = 'quickbooksSalesDocuments' AND index_name = 'quickbooksSalesDocuments_quickbooksId_unique')
--> statement-breakpoint
SET @sql_drop := IF(@has_old_idx > 0, 'ALTER TABLE `quickbooksSalesDocuments` DROP INDEX `quickbooksSalesDocuments_quickbooksId_unique`', 'SELECT 1')
--> statement-breakpoint
PREPARE stmt_drop_old FROM @sql_drop
--> statement-breakpoint
EXECUTE stmt_drop_old
--> statement-breakpoint
DEALLOCATE PREPARE stmt_drop_old
--> statement-breakpoint
SET @has_new_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE table_schema = DATABASE() AND table_name = 'quickbooksSalesDocuments' AND index_name = 'qbSalesDocs_realm_docType_qboId_uq')
--> statement-breakpoint
SET @sql_add := IF(@has_new_idx = 0, 'ALTER TABLE `quickbooksSalesDocuments` ADD CONSTRAINT `qbSalesDocs_realm_docType_qboId_uq` UNIQUE(`realmId`,`docType`,`quickbooksId`)', 'SELECT 1')
--> statement-breakpoint
PREPARE stmt_add_new FROM @sql_add
--> statement-breakpoint
EXECUTE stmt_add_new
--> statement-breakpoint
DEALLOCATE PREPARE stmt_add_new
