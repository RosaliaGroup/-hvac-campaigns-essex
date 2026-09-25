/**
 * Route-level noindex/customer-facing registries — single source of truth,
 * shared between netlify/edge-functions/inject-meta.ts (which enforces them
 * on the live site) and server/seo/lockedPages.ts (which enforces the SAME
 * facts as a bulk-approve exclusion, per docs/seo-bulk-approve-spec.md §2:
 * "Any route currently served with noindex... read from the same registry
 * PR-1 introduced" and "Any customer-facing SMS/Vapi destination locked in by
 * PR-1's route test"). Extracted here (PR seo-bulk-approve) instead of
 * duplicated so the two can never drift apart. Framework-free — no imports.
 */

// PR-1 item E: paid-only landing pages — indexable by nobody, but crawlable
// (so Google understands the destination when it does see a link/ad-slug).
export const NOINDEX_FOLLOW_PATHS = new Set<string>([
  "/lp/fb-commercial",
  "/lp/fb-residential",
  "/lp/referral-partner",
]);

// PR-1 items C/K/L: real, working, registered pages that are simply not
// marketing content — noindex, and no crawl budget wasted following them out.
export const NOINDEX_NOFOLLOW_PATHS = new Set<string>([
  "/courses",
  "/estimating",
  "/presentation-2026",
]);

/**
 * Every URL a Vapi tool, SMS template, or transactional email sends directly
 * to a real customer today — locked in by netlify/tests/inject-meta.test.ts's
 * "customer-facing send-target" test (PR-1 hotfix). Keyed by path, value is
 * the reason/source, reused as the bulk-approve lock reason and as the test's
 * own fixture so the two can never silently diverge.
 */
export const CUSTOMER_FACING_SEND_TARGETS: Record<string, string> = {
  "/referral": "Vapi sendReferralLink SMS (server/services/referralSms.ts CUSTOMER_REFERRAL_LINK) + netlify/functions/sendReferralEmails.js referral-program mention",
  "/qualify": "Vapi sendForm tool (server/services/vapiSendForm.ts) + netlify/functions/sendReferralEmails.js BOOKING_URL",
  "/assessment": "same Qualify.tsx component as /qualify; LiveChatWidget.tsx ASSESSMENT_URL",
  "/rebate-calculator": "rebate calculator client confirmation email (server/routers/rebateCalculator.ts, '#assessment' anchor — hash is not part of route matching)",
  "/pseg-rebate-contractor-nj": "PSE&G rebate checklist customer email (server/routers.ts)",
  "/promos": "kept registered and indexable per PR-1 item C; verified live in Step 2",
};
