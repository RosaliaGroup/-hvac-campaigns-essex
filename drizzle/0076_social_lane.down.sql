-- Rollback for 0076_social_lane.sql. NOT applied by this change.
DROP TABLE IF EXISTS `socialLaneState`;
DROP INDEX `jobPhotos_jobId_idx` ON `jobPhotos`;
DROP TABLE IF EXISTS `jobPhotos`;

ALTER TABLE `jobs`
  DROP COLUMN `photoConsent`;

ALTER TABLE `socialPosts`
  DROP COLUMN `contentSource`,
  DROP COLUMN `holdUntil`,
  DROP COLUMN `vetoedAt`,
  DROP COLUMN `revertedAt`,
  DROP COLUMN `utmCampaign`;

-- NOTE: reverting the status enum requires no existing row to be in
-- 'held'/'vetoed'/'reverted' — verify before running, then:
ALTER TABLE `socialPosts`
  MODIFY `status` enum('draft','scheduled','posted','failed') NOT NULL DEFAULT 'draft';
