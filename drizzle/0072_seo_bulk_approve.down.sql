-- Rollback for 0072. All three tables are additive and empty until the
-- workflow is used; dropping them loses no data that existed before this
-- migration.
DROP TABLE `seoAuditLog`;
DROP TABLE `seoApprovalBatches`;
DROP TABLE `seoPageTags`;
