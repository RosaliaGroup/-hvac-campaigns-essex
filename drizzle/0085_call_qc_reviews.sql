-- Additive only: one new table for per-call quality control (shared/callQc.ts,
-- server/services/callQc.ts). Apply manually following drizzle/README.md after a
-- verified backup, BEFORE merging/deploying the code that uses it.
-- Nothing existing is altered. Rollback:
--   DROP TABLE `callQcReviews`;
CREATE TABLE `callQcReviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `callLogId` int NOT NULL,
  `agentTeamMemberId` int,
  `status` enum('pending','done','skipped','failed') NOT NULL DEFAULT 'pending',
  `score` int,
  `verdict` varchar(20),
  `outcome` varchar(40),
  `review` json,
  `transcript` mediumtext,
  `model` varchar(64),
  `error` text,
  `attempts` int NOT NULL DEFAULT 0,
  `emailedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `callQcReviews_id` PRIMARY KEY(`id`),
  CONSTRAINT `callQcReviews_callLog_uq` UNIQUE(`callLogId`)
);
CREATE INDEX `callQcReviews_agent_idx` ON `callQcReviews` (`agentTeamMemberId`, `createdAt`);
