-- Rollback for 0073. Both new tables are additive and empty until the
-- autopublish jobs run; dropping them loses no data that existed before this
-- migration. Reverting the enum widen is safe as long as no row has already
-- been written with one of the new action values (check `seoAuditLog` before
-- running this in an environment where the jobs have already run).
DROP TABLE `seoAutopublishState`;
DROP TABLE `seoContentQueue`;
ALTER TABLE `seoAuditLog` MODIFY COLUMN `action` enum(
  'draft_generated','draft_discarded','approved_to_pr','pr_opened','merged_detected',
  'revert_opened','reindex_requested','tag_added','tag_removed'
) NOT NULL;
