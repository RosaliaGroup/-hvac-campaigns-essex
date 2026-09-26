-- 0076: Social Lane (docs/social-lane-spec.md). Additive only.
-- NOT APPLIED anywhere by this change — apply BY HAND per drizzle/README.md,
-- after owner approval + a verified backup, same as every other prod migration.

-- §7 hold/veto/revert + §2 content rotation + §3 UTM tagging: extend the
-- existing socialPosts.status enum and add nullable tracking columns. The
-- existing publisher's idempotency (status='posted' + postId) is untouched;
-- these are purely additive states around it.
ALTER TABLE `socialPosts`
  MODIFY `status` enum('draft','scheduled','posted','failed','held','vetoed','reverted') NOT NULL DEFAULT 'draft';

ALTER TABLE `socialPosts`
  ADD `contentSource` varchar(50),
  ADD `holdUntil` timestamp,
  ADD `vetoedAt` timestamp,
  ADD `revertedAt` timestamp,
  ADD `utmCampaign` varchar(255);

-- §2.3 / §9: job-photo content source gate. Defaults false — no existing job
-- opts in to photo use until explicitly set.
ALTER TABLE `jobs`
  ADD `photoConsent` boolean NOT NULL DEFAULT false;

-- §2.3: minimal before/after photo source table. No jobPhotos table exists on
-- main today (the field-notes-photos branch that would have added one is
-- unmerged) — this adds just enough to back the social lane's job-photo
-- rotation type. No customer/address fields by design.
CREATE TABLE `jobPhotos` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `jobId` int NOT NULL,
  `url` varchar(1024) NOT NULL,
  `category` enum('before','after') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);
CREATE INDEX `jobPhotos_jobId_idx` ON `jobPhotos` (`jobId`);

-- §7 circuit breaker: singleton state row, same pattern as seoAutopublishState.
CREATE TABLE `socialLaneState` (
  `id` int PRIMARY KEY,
  `circuitBreakerPaused` boolean NOT NULL DEFAULT false,
  `circuitBreakerReason` text,
  `circuitBreakerPausedAt` timestamp,
  `updatedAt` timestamp NOT NULL DEFAULT (now())
);
INSERT INTO `socialLaneState` (`id`, `circuitBreakerPaused`) VALUES (1, false);
