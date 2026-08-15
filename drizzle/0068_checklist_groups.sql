-- 0068: named checklist groups on commercial opportunities (Trello-style card checklists).
-- Additive: one new table, two nullable columns, and a backfill that files every
-- existing item under a default group so nothing is orphaned.
-- Apply BY HAND per drizzle/README.md — never drizzle-kit migrate against prod.

CREATE TABLE `opportunityChecklistGroups` (
  `id` int AUTO_INCREMENT NOT NULL,
  `opportunityId` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `opportunityChecklistGroups_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `opportunityChecklistGroups_opportunityId_idx` ON `opportunityChecklistGroups` (`opportunityId`);--> statement-breakpoint
ALTER TABLE `opportunityChecklistItems` ADD COLUMN `groupId` int;--> statement-breakpoint
ALTER TABLE `opportunityChecklistTemplateItems` ADD COLUMN `groupName` varchar(120);--> statement-breakpoint
-- One default group per opportunity that already has items.
INSERT INTO `opportunityChecklistGroups` (`opportunityId`, `name`, `sortOrder`)
  SELECT DISTINCT `opportunityId`, 'QA CHECKLIST', 0 FROM `opportunityChecklistItems`;--> statement-breakpoint
-- File every existing item under its opportunity's default group.
UPDATE `opportunityChecklistItems` i
  JOIN `opportunityChecklistGroups` g ON g.`opportunityId` = i.`opportunityId`
  SET i.`groupId` = g.`id`
  WHERE i.`groupId` IS NULL;--> statement-breakpoint
CREATE INDEX `opportunityChecklistItems_groupId_idx` ON `opportunityChecklistItems` (`groupId`,`sortOrder`);
