/**
 * SEO bulk-approve exclusion list (docs/seo-bulk-approve-spec.md §2,
 * "Locked — manual review"). Server-enforced: approveBatch() (see
 * ../services/seo/bulkApprove.ts) calls isLocked() for every page in a batch
 * and rejects the whole request (HTTP 422) if any page is locked. The UI
 * greys these rows out too, but per the spec's own principle #0 ("Quarantined
 * pages are locked server-side. UI hiding alone is not acceptable"), the UI
 * check is cosmetic — this file is the actual gate. Editing the list
 * requires a code change (this file), not a UI action.
 */
import { isInternalRoute } from "../../client/src/lib/navigation";
import {
  NOINDEX_FOLLOW_PATHS,
  NOINDEX_NOFOLLOW_PATHS,
  CUSTOMER_FACING_SEND_TARGETS,
} from "../../shared/seoLockedRoutes";
import { getDb } from "../db";
import { seoPageTags } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/** Exact paths locked per spec §2. */
const LOCKED_EXACT_PATHS = new Set<string>([
  "/", "/commercial", "/promos", "/courses", "/partnerships", "/referral",
  "/lp/referral-partner", "/qualify", "/assessment", "/terms", "/privacy",
  "/careers", "/testimonials", "/rebate-calculator", "/rebate-guide",
]);

/** Prefix patterns locked per spec §2. */
const LOCKED_PREFIXES = ["/vs-"];

/**
 * Pages flagged in the earlier PR-1 SEO/25C audit (docs/pr1/step0-audit.md) —
 * seeded as the initial claims-review set (spec §2). `scripts/seed-claims-review-tags.ts`
 * inserts these as real `claims-review` seoPageTags rows (run by hand per
 * environment — not automatic) so they show up in the tags UI and can be
 * un-tagged (with a note) once verified. This hardcoded set is the fallback
 * so the lock is never silently lost on an environment where that seed
 * script hasn't been run yet.
 */
const SEEDED_CLAIMS_REVIEW_PATHS = new Set<string>([
  "/hvac-newark-nj",
  "/blog/hvac-tax-credits-2026-nj",
  "/blog/federal-25c-tax-credit-hvac-2026",
  "/blog/pseg-rebate-vs-federal-tax-credit",
  "/blog/inflation-reduction-act-hvac-nj",
  "/blog/pseg-heat-pump-rebates-explained",
  "/blog/nj-hvac-rebates-2026-complete-guide",
]);

export type LockReason =
  | { kind: "exact_path" }
  | { kind: "prefix_pattern"; prefix: string }
  | { kind: "noindex_follow" }
  | { kind: "noindex_nofollow" }
  | { kind: "internal_route" }
  | { kind: "claims_review"; note: string | null }
  | { kind: "customer_facing_send_target"; sentBy: string };

export type LockCheckResult =
  | { locked: false }
  | { locked: true; reason: LockReason; message: string };

function normalizePath(path: string): string {
  const clean = path.split("?")[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/**
 * Every check that doesn't need the DB — safe to call from pure/sync
 * contexts (e.g. the client's row-render, for a fast first-pass grey-out
 * before the tag-based check resolves). NOT the full gate on its own; the
 * server always also checks claims-review tags via isLocked() below.
 */
export function isStaticallyLocked(path: string): LockCheckResult {
  const clean = normalizePath(path);

  if (LOCKED_EXACT_PATHS.has(clean)) {
    return { locked: true, reason: { kind: "exact_path" }, message: `${clean} is on the fixed exclusion list — manual review only.` };
  }
  for (const prefix of LOCKED_PREFIXES) {
    if (clean.startsWith(prefix)) {
      return { locked: true, reason: { kind: "prefix_pattern", prefix }, message: `${clean} matches locked prefix "${prefix}*" (competitor comparison pages) — manual review only.` };
    }
  }
  if (NOINDEX_FOLLOW_PATHS.has(clean) || NOINDEX_NOFOLLOW_PATHS.has(clean)) {
    return {
      locked: true,
      reason: { kind: NOINDEX_FOLLOW_PATHS.has(clean) ? "noindex_follow" : "noindex_nofollow" },
      message: `${clean} is served noindex — not a bulk-approve candidate.`,
    };
  }
  if (isInternalRoute(clean)) {
    return { locked: true, reason: { kind: "internal_route" }, message: `${clean} is a CRM/internal route, not public marketing content.` };
  }
  const sendTarget = CUSTOMER_FACING_SEND_TARGETS[clean];
  if (sendTarget) {
    return { locked: true, reason: { kind: "customer_facing_send_target", sentBy: sendTarget }, message: `${clean} is a live Vapi/SMS/email destination (${sendTarget}) — locked by PR-1's route test.` };
  }
  if (SEEDED_CLAIMS_REVIEW_PATHS.has(clean)) {
    return { locked: true, reason: { kind: "claims_review", note: null }, message: `${clean} is flagged claims-review (25C/expired-incentive audit) — remove the tag (with a note) before bulk-approving.` };
  }

  return { locked: false };
}

/**
 * Full gate — static checks plus the DB-backed claims-review tag (a page can
 * be tagged claims-review at any time via the UI, independent of the seeded
 * list above). This is what server/services/seo/bulkApprove.ts must call for
 * every page in a batch; isStaticallyLocked() alone is not sufficient.
 */
export async function isLocked(path: string): Promise<LockCheckResult> {
  const staticResult = isStaticallyLocked(path);
  if (staticResult.locked) return staticResult;

  const clean = normalizePath(path);
  const db = await getDb();
  if (!db) return { locked: false };

  const [tagRow] = await db
    .select()
    .from(seoPageTags)
    .where(and(eq(seoPageTags.pagePath, clean), eq(seoPageTags.tag, "claims-review")))
    .limit(1);

  if (tagRow) {
    return {
      locked: true,
      reason: { kind: "claims_review", note: tagRow.note },
      message: `${clean} is tagged claims-review${tagRow.note ? ` (${tagRow.note})` : ""} — remove the tag (with a note) before bulk-approving.`,
    };
  }

  return { locked: false };
}

/** Batch helper: check every page, return only the locked ones with reasons. */
export async function findLockedPages(paths: string[]): Promise<Map<string, LockCheckResult>> {
  const out = new Map<string, LockCheckResult>();
  for (const p of paths) {
    const result = await isLocked(p);
    if (result.locked) out.set(normalizePath(p), result);
  }
  return out;
}
