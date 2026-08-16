-- 0071: web-push device subscriptions, so alerts can reach a phone with the app closed.
-- Additive: one new table. No changes to existing tables, no backfill.
-- Apply BY HAND per drizzle/README.md.

CREATE TABLE `pushSubscriptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `teamMemberId` int NOT NULL,
  `endpoint` varchar(512) NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `userAgent` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `pushSubscriptions_id` PRIMARY KEY(`id`),
  CONSTRAINT `pushSubscriptions_endpoint_unique` UNIQUE(`endpoint`)
);--> statement-breakpoint
CREATE INDEX `pushSubscriptions_teamMemberId_idx` ON `pushSubscriptions` (`teamMemberId`);
