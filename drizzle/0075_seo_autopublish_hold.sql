-- 0075: adds seoApprovalBatches.holdUntil (docs/seo-automation-addendum-autopublish.md
-- §A2 hold-and-veto). Null = normal human-reviewed batch, untouched by
-- server/services/seo/autoMerge.ts. Additive only. Apply BY HAND per drizzle/README.md.
ALTER TABLE `seoApprovalBatches` ADD `holdUntil` timestamp;
