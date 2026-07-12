-- Commercial QA seed race guard (ADDITIVE / REVERSIBLE).
--
-- The system QA checklist template was seeded with a check-then-insert on a
-- NON-unique `name`, so two concurrent first-time seeds could each insert a
-- template (observed on staging: 12 concurrent requests -> 2 duplicate rows).
--
-- Fix: give system-seeded templates a stable, UNIQUE `systemKey` (NULL for
-- user-created templates, and MySQL allows many NULLs, so those stay
-- unconstrained). Also make template items unique per (template, slot) so a
-- repeated or concurrent seed upserts each item in place instead of duplicating
-- the checklist. The seed initializer converges on these keys via ON DUPLICATE
-- KEY UPDATE. Reversibility = DROP the two constraints and the column.

ALTER TABLE `opportunityChecklistTemplates` ADD `systemKey` varchar(48);--> statement-breakpoint
ALTER TABLE `opportunityChecklistTemplates` ADD CONSTRAINT `opportunityChecklistTemplates_systemKey_unique` UNIQUE(`systemKey`);--> statement-breakpoint
ALTER TABLE `opportunityChecklistTemplateItems` ADD CONSTRAINT `opportunityChecklistTemplateItems_template_sort_unique` UNIQUE(`templateId`,`sortOrder`);--> statement-breakpoint
UPDATE `opportunityChecklistTemplates` SET `systemKey` = 'commercial_qa' WHERE `name` = 'Commercial Opportunity QA' AND `systemKey` IS NULL;
