-- 0080: weekly AI-visibility observations (market-intel addition; see shared/aiVisibility.ts).
-- Additive: one new table, no existing table touched. obsKey (sha256 hex) carries the UNIQUE index — a composite
-- index over varchar(512) query would hit ER_TOO_LONG_KEY under utf8mb4 (the 0078/0079 incident).

CREATE TABLE `seoIntelAiVisibility` (
  `id` int AUTO_INCREMENT NOT NULL,
  `weekOf` varchar(10) NOT NULL COMMENT 'Monday of the America/New_York week, YYYY-MM-DD',
  `engine` enum('perplexity','openai','google_ai_overview') NOT NULL,
  `query` varchar(512) NOT NULL,
  `obsKey` varchar(64) NOT NULL,
  `status` enum('ok','no_overview','error') NOT NULL DEFAULT 'ok',
  `named` boolean NOT NULL DEFAULT false,
  `citedUs` boolean NOT NULL DEFAULT false,
  `namedAs` varchar(255),
  `competitors` json,
  `otherCompanies` json,
  `citedDomains` json,
  `citations` json,
  `excerpt` text,
  `error` varchar(255),
  `capturedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `seoIntelAiVisibility_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `seoIntelAiVisibility_key_uq` ON `seoIntelAiVisibility` (`obsKey`);--> statement-breakpoint
CREATE INDEX `seoIntelAiVisibility_week_engine_idx` ON `seoIntelAiVisibility` (`weekOf`, `engine`);
