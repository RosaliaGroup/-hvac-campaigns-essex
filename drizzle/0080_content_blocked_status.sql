-- 0080: content-queue "blocked" status + seoAuditLog "draft_blocked" action.
-- NOT APPLIED anywhere by this change — apply BY HAND per drizzle/README.md.
--
-- Supports the content pipeline's regenerate-once-then-advance fix
-- (server/services/seo/contentPipeline.ts): a draft still blocked by lint or
-- critic findings after one feedback-fed retry is marked
-- seoContentQueue.status='blocked' (distinct from every existing status —
-- nothing else sets 'blocked') and logged as
-- seoAuditLog.action='draft_blocked', instead of returning "drafted" with
-- passes=false and silently stalling the queue behind it.
--
-- Additive only (enum widen, both notNull with no default change). No
-- existing row's value changes.

ALTER TABLE `seoContentQueue`
  MODIFY `status` enum('queued','proposed','drafted','in_review','pr_open','published','refresh_due','blocked') NOT NULL DEFAULT 'queued';--> statement-breakpoint

ALTER TABLE `seoAuditLog`
  MODIFY `action` enum('draft_generated','draft_discarded','approved_to_pr','pr_opened','merged_detected','revert_opened','reindex_requested','tag_added','tag_removed','vetoed','link_consumed','circuit_breaker_paused','circuit_breaker_resumed','warmup_advanced','warmup_reset','topic_proposed','market_intel_report_generated','market_intel_item_executed','market_intel_item_reverted','market_intel_owner_decision_released','draft_blocked') NOT NULL;
