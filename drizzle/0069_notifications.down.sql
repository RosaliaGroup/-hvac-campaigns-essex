-- Rollback for 0069. The table holds only alerts; no other record depends on it.
DROP TABLE `notifications`;
