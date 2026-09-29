/**
 * Nightly title/meta draft job (docs/seo-automation-spec.md Part 1, extended
 * by docs/seo-automation-addendum-autopublish.md's auto-lane decision).
 * Trigger: a Railway cron / in-process scheduler at 02:00 America/New_York,
 * Mon-Sat (see startNightlyDraftScheduler() at the bottom, or SEO_NIGHTLY_DRAFTS_ENABLED=true).
 *
 * selectNightlyDraftCandidates() is the pure ranking/filtering logic — cheap
 * to unit-test exhaustively against the spec's own acceptance tests.
 *
 * Auto-lane resolution (owner decision, 2026-09-26): once SEO_AUTOPUBLISH_ENABLED
 * is "true" AND the meta lane is warmed up (server/services/seo/warmupGate.ts)
 * AND the circuit breaker is clear, this job calls approveBatchToPR itself
 * (label "auto-YYYYMMDD") for every cleanly-drafted page, which arms the
 * hold-and-veto auto-merge path (server/services/seo/autoMerge.ts). Otherwise
 * (the default, pre-trust state) it stages only — exactly the original
 * Phase-1 behavior ("the job does NOT call approveBatchToPR"). A failure in
 * the auto-approve step is caught and logged, not thrown — the drafts are
 * already staged and tagged, so a human can still approve them by hand even
 * if auto-approval itself failed (e.g. GitHub transiently down).
 */
import { getDb } from "../../db";
import { seoPages, seoAiDrafts } from "../../../drizzle/schema";
import { findLockedPages } from "../../seo/lockedPages";
import { isInPendingBatch, approveBatchToPR, yyyymmdd } from "./bulkApprove";
import { regenerateUnlockedDrafts } from "./draftManagement";
import { addTag } from "./tags";
import { logAudit } from "./auditLog";
import { sendEmail } from "../emailService";
import { msUntilNextRun, type Weekday } from "../../../shared/cronTiming";
import { isWarmedUp } from "./warmupGate";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { armHold } from "./autoMerge";
import { VERIFIED_FACTS, isPriceRangeStale } from "../../../shared/verifiedFacts";

/** docs/positioning-warranty-spec.md §9b — "asOf older than 180 days -> WARN in the nightly meta lane". A no-op today: VERIFIED_FACTS.priceRanges is empty until the owner supplies entries. */
function warnOnStalePriceRanges(now: Date): void {
  for (const range of VERIFIED_FACTS.priceRanges) {
    if (isPriceRangeStale(range, now)) {
      console.warn(`[SEO] price range for ${range.page} (${range.item}) is stale — last confirmed ${range.asOf}, more than 180 days ago.`);
    }
  }
}

export const MAX_NIGHTLY_DRAFTS = 20;
const MIN_IMPRESSIONS_90D = 20;
const REFRESH_QUERY_IMPRESSIONS = 100;
const LOW_CTR = 0.01;
const DRAFT_COOLDOWN_DAYS = 14;

export type NightlyCandidatePage = {
  pageId: number;
  pagePath: string;
  impressions: number;
  position: number;
  ctr: number;
  /** When this page's draft was last (re)generated, or null if it has never been drafted. */
  draftUpdatedAt: Date | null;
};

export type NightlySelectionContext = {
  lockedPaths: Set<string>;
  pendingBatchPaths: Set<string>;
  now: Date;
};

function rankTier(p: NightlyCandidatePage): 0 | 1 | 2 {
  if (p.impressions >= REFRESH_QUERY_IMPRESSIONS && p.position >= 8 && p.position <= 20) return 0;
  if (p.impressions >= REFRESH_QUERY_IMPRESSIONS && p.position <= 25 && p.ctr < LOW_CTR) return 1;
  return 2;
}

/**
 * Pure selection (spec Part 1 "Selection", max 20/night):
 *   1. Skip < 20 impressions (90d) entirely — insufficient data to justify drafting.
 *   2. Exclude locked pages, pages in a pr_open batch, and pages drafted < 14 days ago.
 *   3. Rank: (tier 0) impressions>=100 & position 8-20 > (tier 1) impressions>=100
 *      & position<=25 & CTR<1% > (tier 2) everything else, by impressions desc within tier.
 */
export function selectNightlyDraftCandidates(
  pages: NightlyCandidatePage[],
  ctx: NightlySelectionContext,
): NightlyCandidatePage[] {
  const cooldownCutoff = ctx.now.getTime() - DRAFT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  const eligible = pages.filter((p) => {
    if (p.impressions < MIN_IMPRESSIONS_90D) return false;
    if (ctx.lockedPaths.has(p.pagePath)) return false;
    if (ctx.pendingBatchPaths.has(p.pagePath)) return false;
    if (p.draftUpdatedAt && p.draftUpdatedAt.getTime() > cooldownCutoff) return false;
    return true;
  });

  eligible.sort((a, b) => {
    const tierDiff = rankTier(a) - rankTier(b);
    if (tierDiff !== 0) return tierDiff;
    return b.impressions - a.impressions;
  });

  return eligible.slice(0, MAX_NIGHTLY_DRAFTS);
}

export type NightlyJobSummary = {
  ready: number;
  lintBlocked: number;
  skippedLocked: number;
  totalConsidered: number;
  /** True iff the meta lane was warmed up + circuit-clear and this run auto-approved the ready drafts to a PR. False = staged only (the default, pre-trust behavior). */
  autoApproved: boolean;
  /** Set only when autoApproved is true. */
  batchId?: number;
};

/** Real I/O: fetch pages + locks + pending batches, select, draft, tag, log, summarize; auto-approve to PR if the meta lane is warmed up and the circuit is clear (see file header), else stage only. */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function runNightlyDraftJob(now: Date = new Date()): Promise<NightlyJobSummary> {
  warnOnStalePriceRanges(now);

  const db = await getDb();
  if (!db) return { ready: 0, lintBlocked: 0, skippedLocked: 0, totalConsidered: 0, autoApproved: false };

  const pages = await db.select().from(seoPages);
  const drafts = await db.select().from(seoAiDrafts);
  const draftByPageId = new Map(drafts.map((d) => [d.pageId, d]));

  const candidates: NightlyCandidatePage[] = pages.map((p) => ({
    pageId: p.id,
    pagePath: p.page,
    impressions: p.impressions,
    position: Number(p.position),
    ctr: Number(p.ctr),
    draftUpdatedAt: draftByPageId.get(p.id)?.updatedAt ?? null,
  }));

  const lockedMap = await findLockedPages(candidates.map((c) => c.pagePath));
  const pendingBatchPaths = new Set<string>();
  for (const c of candidates) {
    if (await isInPendingBatch(c.pagePath)) pendingBatchPaths.add(c.pagePath);
  }

  const selected = selectNightlyDraftCandidates(candidates, {
    lockedPaths: new Set(lockedMap.keys()),
    pendingBatchPaths,
    now,
  });

  if (selected.length === 0) {
    return { ready: 0, lintBlocked: 0, skippedLocked: 0, totalConsidered: candidates.length, autoApproved: false };
  }

  const { results, skippedLocked } = await regenerateUnlockedDrafts(selected.map((s) => s.pageId));
  let ready = 0;
  let lintBlocked = 0;
  const readyPageIds: number[] = [];

  for (const r of results) {
    const page = selected.find((s) => s.pageId === r.pageId);
    if (r.ok) {
      ready++;
      readyPageIds.push(r.pageId);
      if (page) {
        await addTag({ pagePath: page.pagePath, tag: "nightly-candidate", note: null, actorId: null }).catch(() => {
          // Best-effort — a tagging failure shouldn't drop an otherwise-good draft.
        });
      }
    } else {
      lintBlocked++;
    }
    await logAudit({
      actorId: null,
      action: "draft_generated",
      batchId: null,
      pagePath: page?.pagePath ?? null,
      before: null,
      after: { lane: "meta", source: "nightly", ok: r.ok },
      lintResult: null,
    });
  }

  await sendNightlySummaryEmail({ ready, lintBlocked: lintBlocked, skippedLocked: skippedLocked.length });

  let autoApproved = false;
  let batchId: number | undefined;
  if (readyPageIds.length > 0 && process.env.SEO_AUTOPUBLISH_ENABLED === "true") {
    const [warmedUp, breaker] = await Promise.all([isWarmedUp("meta"), checkCircuitBreakerConditions()]);
    if (warmedUp && !breaker.shouldPause) {
      try {
        const approved = await approveBatchToPR({ pageIds: readyPageIds, label: `auto-${yyyymmdd(now)}`, actorId: null });
        await armHold(approved.batch.id);
        autoApproved = true;
        batchId = approved.batch.id;
      } catch (err) {
        // The drafts are already staged/tagged — a human can still approve
        // them by hand even if auto-approval itself failed.
        console.error("[SEO] nightly auto-approve failed (drafts remain staged for manual approval):", (err as Error).message);
      }
    }
  }

  return { ready, lintBlocked, skippedLocked: skippedLocked.length, totalConsidered: candidates.length, autoApproved, ...(batchId !== undefined ? { batchId } : {}) };
}

async function sendNightlySummaryEmail(counts: { ready: number; lintBlocked: number; skippedLocked: number }): Promise<void> {
  const to = process.env.SEO_ALERT_EMAIL;
  if (!to) return;
  await sendEmail({
    to,
    subject: `Nightly SEO drafts: ${counts.ready} ready, ${counts.lintBlocked} lint-blocked, ${counts.skippedLocked} skipped (locked)`,
    html: `<p>Nightly SEO drafts: <b>${counts.ready}</b> ready, <b>${counts.lintBlocked}</b> lint-blocked, <b>${counts.skippedLocked}</b> skipped (locked).</p><p><a href="${process.env.PUBLIC_SITE_URL ?? "https://mechanicalenterprise.com"}/seo-intelligence">Review in the CRM</a></p>`,
  }).catch(() => {
    // Best-effort — a notification failure must not fail the job (drafts already exist).
  });
}

/** In-process scheduler — mirrors server/services/seo/routes.ts's daily sync scheduler pattern. */
export function startNightlyDraftScheduler(): void {
  if (process.env.SEO_NIGHTLY_DRAFTS_ENABLED !== "true") {
    console.log("[SEO] Nightly draft job disabled (set SEO_NIGHTLY_DRAFTS_ENABLED=true to enable)");
    return;
  }
  const MON_TO_SAT: Weekday[] = [1, 2, 3, 4, 5, 6];
  const arm = () => {
    const delay = msUntilNextRun({ hour: 2, minute: 0, timeZone: "America/New_York", weekdays: MON_TO_SAT });
    setTimeout(() => {
      runNightlyDraftJob()
        .then((s) => console.log(`[SEO] nightly draft job: ${s.ready} ready, ${s.lintBlocked} lint-blocked, ${s.skippedLocked} skipped (locked), ${s.totalConsidered} considered${s.autoApproved ? `, auto-approved to batch #${s.batchId}` : ""}`))
        .catch((err) => console.error("[SEO] nightly draft job error:", err))
        .finally(arm);
    }, delay);
  };
  console.log("[SEO] Nightly draft job scheduled — 02:00 America/New_York, Mon-Sat");
  arm();
}
