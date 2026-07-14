-- 0043 — QBO document composite identity (realmId, docType, quickbooksId).
--
-- RECONCILED TO BE IDEMPOTENT + SELF-CORRECTING. Production already had this
-- change applied out-of-band (the single-column unique
-- `quickbooksSalesDocuments_quickbooksId_unique` was dropped and the composite
-- unique `qbSalesDocs_realm_docType_qboId_uq` was created + verified manually),
-- but that manual change left NO row in `__drizzle_migrations`. drizzle-kit
-- migrate gates on created_at timestamps, so it WILL re-encounter 0043. Raw
-- `DROP INDEX` / `ADD CONSTRAINT` would then fail (index already gone /
-- constraint already present).
--
-- The composite guard validates the EXACT definition via information_schema:
-- TABLE_SCHEMA = DATABASE(), the exact table + index name, NON_UNIQUE = 0, and
-- all three columns in the correct SEQ_IN_INDEX order. It does NOT trust the
-- index name alone: an index that merely shares the name but has the wrong
-- columns/order or is non-unique is dropped and recreated correctly (a wrong
-- index is never silently accepted). If real data then violates uniqueness, the
-- recreate fails clearly.
--
-- Statements run via the mysql2 text protocol on one connection, so
-- SET/PREPARE/EXECUTE/DEALLOCATE and @session vars are valid and persist across
-- statement-breakpoints. Do NOT hand-run the raw DROP again during deployment.

-- (1) Legacy single-column unique: drop only if it still exists.
SET @has_old_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quickbooksSalesDocuments' AND INDEX_NAME = 'quickbooksSalesDocuments_quickbooksId_unique')
--> statement-breakpoint
SET @sql_drop_old := IF(@has_old_idx > 0, 'ALTER TABLE `quickbooksSalesDocuments` DROP INDEX `quickbooksSalesDocuments_quickbooksId_unique`', 'SELECT 1')
--> statement-breakpoint
PREPARE s_drop_old FROM @sql_drop_old
--> statement-breakpoint
EXECUTE s_drop_old
--> statement-breakpoint
DEALLOCATE PREPARE s_drop_old
--> statement-breakpoint
-- (2) Composite unique: is the EXACT-correct definition already present?
--     correct = NON_UNIQUE=0 AND columns (realmId#1, docType#2, quickbooksId#3).
SET @correct_cols := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quickbooksSalesDocuments' AND INDEX_NAME = 'qbSalesDocs_realm_docType_qboId_uq' AND NON_UNIQUE = 0 AND ((SEQ_IN_INDEX = 1 AND COLUMN_NAME = 'realmId') OR (SEQ_IN_INDEX = 2 AND COLUMN_NAME = 'docType') OR (SEQ_IN_INDEX = 3 AND COLUMN_NAME = 'quickbooksId')))
--> statement-breakpoint
SET @total_cols := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quickbooksSalesDocuments' AND INDEX_NAME = 'qbSalesDocs_realm_docType_qboId_uq')
--> statement-breakpoint
SET @is_correct := (@correct_cols = 3 AND @total_cols = 3)
--> statement-breakpoint
-- (3) An index of this name exists but is NOT exactly correct → drop it so it can
--     be recreated correctly. Never silently accept a wrong index.
SET @sql_fix_drop := IF(@total_cols > 0 AND NOT @is_correct, 'ALTER TABLE `quickbooksSalesDocuments` DROP INDEX `qbSalesDocs_realm_docType_qboId_uq`', 'SELECT 1')
--> statement-breakpoint
PREPARE s_fix_drop FROM @sql_fix_drop
--> statement-breakpoint
EXECUTE s_fix_drop
--> statement-breakpoint
DEALLOCATE PREPARE s_fix_drop
--> statement-breakpoint
-- (4) Create the composite unique unless the exact-correct one is already present.
SET @sql_add := IF(@is_correct, 'SELECT 1', 'ALTER TABLE `quickbooksSalesDocuments` ADD CONSTRAINT `qbSalesDocs_realm_docType_qboId_uq` UNIQUE(`realmId`,`docType`,`quickbooksId`)')
--> statement-breakpoint
PREPARE s_add FROM @sql_add
--> statement-breakpoint
EXECUTE s_add
--> statement-breakpoint
DEALLOCATE PREPARE s_add
