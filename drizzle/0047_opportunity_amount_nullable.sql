-- Make opportunities.amount NULLABLE (ADDITIVE / REVERSIBLE widening).
--
-- Commercial opportunities may be created before a value is known. Previously
-- `amount` was NOT NULL DEFAULT '0.00', so "unknown" was stored as 0 and shown
-- as a misleading $0. Allow NULL = "not yet estimated"; the default stays '0.00'
-- so legacy QBO sync/insert behavior is unchanged (those paths always write a
-- value). Existing rows keep their current amounts. Reversibility: re-add NOT
-- NULL after backfilling any NULLs to 0.

ALTER TABLE `opportunities` MODIFY COLUMN `amount` decimal(12,2) DEFAULT '0.00';
