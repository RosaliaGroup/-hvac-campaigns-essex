-- Down for 0061: restore the NOT NULL constraint on estimates.estimateNumber.
-- WARNING: this will FAIL if any pending drafts (estimateNumber IS NULL) exist —
-- that is intentional. Assign or delete those rows before rolling back. This does
-- NOT restore the retired local "ME-EST-*" generator; that logic lived in code.
ALTER TABLE `estimates` MODIFY COLUMN `estimateNumber` varchar(32) NOT NULL;
