-- 0069: in-app alerts (notification centre).
-- Purely additive: one new table, no changes to existing tables, no backfill.
-- Apply BY HAND per drizzle/README.md.

CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `teamMemberId` int NOT NULL,
  `type` varchar(48) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text,
  `entityType` varchar(32),
  `entityId` int,
  `link` varchar(255),
  `readAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `notifications_inbox_idx` ON `notifications` (`teamMemberId`,`readAt`,`createdAt`);
