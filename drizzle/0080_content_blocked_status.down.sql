-- Rollback for 0080_content_blocked_status.sql. NOT applied by this change.
-- Will fail if any row already uses the new enum value — reassign those rows
-- first (e.g. seoContentQueue.status='blocked' back to 'in_review', delete or
-- re-map seoAuditLog rows with action='draft_blocked') before running this.

ALTER TABLE `seoAuditLog`
  MODIFY `action` enum('draft_generated','draft_discarded','approved_to_pr','pr_opened','merged_detected','revert_opened','reindex_requested','tag_added','tag_removed','vetoed','link_consumed','circuit_breaker_paused','circuit_breaker_resumed','warmup_advanced','warmup_reset','topic_proposed','market_intel_report_generated','market_intel_item_executed','market_intel_item_reverted','market_intel_owner_decision_released') NOT NULL;--> statement-breakpoint

ALTER TABLE `seoContentQueue`
  MODIFY `status` enum('queued','proposed','drafted','in_review','pr_open','published','refresh_due') NOT NULL DEFAULT 'queued';
