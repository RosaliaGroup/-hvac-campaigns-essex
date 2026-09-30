/**
 * Nightly title/meta draft job (docs/seo-automation-spec.md Part 1, extended
 * by docs/seo-automation-addendum-autopublish.md's auto-lane decision).
 * Trigger: a Railway cron / in-process scheduler at 02:00 America/New_York,
 * Mon-Sat (see startNightlyDraftScheduler() at the bottom, or SEO_NIGHTLY_DRAFTS_ENABLED=true).
 *
 * selectNightlyDraftCandidates() is the pure ranking/filtering logic — cheap
 * to unit-test exhaustively against the spec's own acceptance tests.
 *
 * Backlog pickup: the 14-day cooldown above only stops a page being RE-drafted,
 * so drafts that already exist, lint clean, and never reached a PR would sit
 * forever. When the auto-lane is going to approve anyway, the batch is topped
 * up (to the 20-page cap, ranked by impressions) with those existing drafts —
 * see selectCleanDraftPickups(). Every page in the batch is re-linted at its
 * diff level first, so one now-blocked draft can't sink the whole batch.
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
import { isInPendingBatch, approveBatchToPR, buildBatchDiff, yyyymmdd } from "./bulkApprove";
import { isMockProvider } from "./ai/optimizationProvider";
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

/**
 * Owner-pinned positioning pages (2026-09-29). They bypass the 20-impression
 * floor and go FIRST in every nightly batch, in this order — impressions don't
 * matter for them yet. Everything else that gates a page still applies: locked,
 * in an open batch, the 14-day re-draft cooldown, an already-approved draft,
 * mock drafts, and the linter.
 */
export const PINNED_PRIORITY_PATHS: readonly string[] = [
  "/heat-pump-installation-nj",
  "/central-ac-installation-nj",
  "/ductless-mini-split-installation-nj",
  "/vrv-vrf-installation-nj",
  "/residential",
  "/commercial",
  "/warranty",
  "/commercial/property-managers",
  "/commercial/hvac-service-contracts",
];

/** Position in PINNED_PRIORITY_PATHS (0 = first), or -1 if the page isn't pinned. Ignores a trailing slash. */
export function pinIndex(pagePath: string): number {
  const norm = pagePath.length > 1 ? pagePath.replace(/\/+$/, "") : pagePath;
  return PINNED_PRIORITY_PATHS.indexOf(norm);
}
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

/** An existing draft row joined to its page, for backlog pickup. */
export type PickupCandidate = {
  pageId: number;
  pagePath: string;
  impressions: number;
  title: string | null;
  metaDescription: string | null;
  /** seoAiDrafts.status: "draft" | "edited" | "approved". "approved" means it already went to a PR (merged, open, or vetoed) — never re-pick it. */
  draftStatus: string;
  /** seoAiDrafts.model — "mock-v1" placeholders must never ship. */
  model: string;
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
 *   0. Pinned priority pages (PINNED_PRIORITY_PATHS) bypass the impressions floor and rank first, in list order.
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
    if (p.impressions < MIN_IMPRESSIONS_90D && pinIndex(p.pagePath) < 0) return false;
    if (ctx.lockedPaths.has(p.pagePath)) return false;
    if (ctx.pendingBatchPaths.has(p.pagePath)) return false;
    if (p.draftUpdatedAt && p.draftUpdatedAt.getTime() > cooldownCutoff) return false;
    return true;
  });

  eligible.sort((a, b) => {
    const pa = pinIndex(a.pagePath), pb = pinIndex(b.pagePath);
    if (pa >= 0 || pb >= 0) return pa >= 0 && pb >= 0 ? pa - pb : pa >= 0 ? -1 : 1; // pinned first, in list order
    const tierDiff = rankTier(a) - rankTier(b);
    if (tierDiff !== 0) return tierDiff;
    return b.impressions - a.impressions;
  });

  return eligible.slice(0, MAX_NIGHTLY_DRAFTS);
}

/**
 * Pure backlog selection: existing drafts that are eligible to ship without
 * being re-generated. Same floor/exclusions as selectNightlyDraftCandidates
 * (>= 20 impressions unless pinned, not locked, not in an open batch) minus the cooldown,
 * plus: has both a title and a meta description, not already approved, not a
 * mock draft, and not already chosen for this batch. Ranked by impressions
 * desc after the pinned pages (which come first, in list order); NOT capped and NOT lint-checked — the caller lints at diff level and
 * takes as many as fit under the 20 cap.
 */
export function selectCleanDraftPickups(
  cands: PickupCandidate[],
  ctx: { lockedPaths: Set<string>; pendingBatchPaths: Set<string>; excludePageIds: Set<number> },
): PickupCandidate[] {
  return cands
    .filter((c) => {
      if (!c.title?.trim() || !c.metaDescription?.trim()) return false;
      if (c.draftStatus === "approved") return false;
      if (isMockProvider(c.model)) return false;
      if (c.impressions < MIN_IMPRESSIONS_90D && pinIndex(c.pagePath) < 0) return false;
      if (ctx.lockedPaths.has(c.pagePath) || ctx.pendingBatchPaths.has(c.pagePath)) return false;
      if (ctx.excludePageIds.has(c.pageId)) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = pinIndex(a.pagePath), pb = pinIndex(b.pagePath);
      if (pa >= 0 || pb >= 0) return pa >= 0 && pb >= 0 ? pa - pb : pa >= 0 ? -1 : 1; // pinned first, in list order
      return b.impressions - a.impressions;
    });
}

/** Max candidates re-linted per run while filling the batch — bounds the GitHub reads buildBatchDiff makes per page. */
const MAX_PICKUP_LINT_CHECKS = 60;

/**
 * The page ids to approve this run, in batch order: pinned pages first (this
 * run's fresh drafts, then pinned backlog), then this run's other fresh drafts,
 * then the rest of the backlog by impressions. Capped at MAX_NIGHTLY_DRAFTS and
 * every page must pass the diff-level lint that approveBatchToPR enforces
 * (which rejects the WHOLE batch on one block) — failures are dropped and the
 * next candidate takes the slot.
 */
async function assembleBatch(fresh: Array<{ pageId: number; pagePath: string }>, pool: PickupCandidate[]): Promise<{ pageIds: number[]; pickedUp: number }> {
  type Entry = { id: number; fresh: boolean };
  const byPin = (a: { pagePath: string }, b: { pagePath: string }) => pinIndex(a.pagePath) - pinIndex(b.pagePath);
  const isPinned = (x: { pagePath: string }) => pinIndex(x.pagePath) >= 0;
  const asFresh = (f: { pageId: number }): Entry => ({ id: f.pageId, fresh: true });
  const asPick = (c: { pageId: number }): Entry => ({ id: c.pageId, fresh: false });
  const ordered: Entry[] = [
    ...fresh.filter(isPinned).sort(byPin).map(asFresh),
    ...pool.filter(isPinned).sort(byPin).map(asPick),
    ...fresh.filter((f) => !isPinned(f)).map(asFresh),
    ...pool.filter((c) => !isPinned(c)).map(asPick),
  ];

  const clean = async (ids: number[]): Promise<Set<number>> => {
    if (ids.length === 0) return new Set();
    const rows = await buildBatchDiff(ids);
    return new Set(rows.filter((r) => r.lint.passes).map((r) => r.pageId));
  };

  const chosen: number[] = [];
  let pickedUp = 0;
  let idx = 0;
  const limit = Math.min(ordered.length, Math.max(MAX_PICKUP_LINT_CHECKS, fresh.length));
  while (chosen.length < MAX_NIGHTLY_DRAFTS && idx < limit) {
    const room = MAX_NIGHTLY_DRAFTS - chosen.length;
    const chunk = ordered.slice(idx, Math.min(idx + room, limit));
    idx += chunk.length;
    const ok = await clean(chunk.map((e) => e.id));
    for (const e of chunk) {
      if (!ok.has(e.id)) continue;
      chosen.push(e.id);
      if (!e.fresh) pickedUp++;
    }
  }
  return { pageIds: chosen, pickedUp };
}

export type NightlyJobSummary = {
  ready: number;
  lintBlocked: number;
  skippedLocked: number;
  totalConsidered: number;
  /** True iff the meta lane was warmed up + circuit-clear and this run auto-approved the ready drafts to a PR. False = staged only (the default, pre-trust behavior). */
  autoApproved: boolean;
  /** Existing clean, unbatched drafts added to this run's batch (backlog pickup). 0 unless autoApproved. */
  pickedUp: number;
  /** Set only when autoApproved is true. */
  batchId?: number;
};

/** Real I/O: fetch pages + locks + pending batches, select, draft, tag, log, summarize; auto-approve to PR if the meta lane is warmed up and the circuit is clear (see file header), else stage only. */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function runNightlyDraftJob(now: Date = new Date()): Promise<NightlyJobSummary> {
  warnOnStalePriceRanges(now);

  const db = await getDb();
  if (!db) return { ready: 0, lintBlocked: 0, skippedLocked: 0, totalConsidered: 0, autoApproved: false, pickedUp: 0 };

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

  // Nothing new to draft is no longer "nothing to do": the backlog pickup below may still have clean drafts to ship.
  const { results, skippedLocked } = selected.length > 0
    ? await regenerateUnlockedDrafts(selected.map((s) => s.pageId))
    : { results: [], skippedLocked: [] as string[] };
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

  if (selected.length > 0) await sendNightlySummaryEmail({ ready, lintBlocked: lintBlocked, skippedLocked: skippedLocked.length });

  let autoApproved = false;
  let batchId: number | undefined;
  let pickedUp = 0;
  if (process.env.SEO_AUTOPUBLISH_ENABLED === "true") {
    const [warmedUp, breaker] = await Promise.all([isWarmedUp("meta"), checkCircuitBreakerConditions()]);
    if (warmedUp && !breaker.shouldPause) {
      try {
        const pickupPool = selectCleanDraftPickups(
          pages.map((p) => {
            const d = draftByPageId.get(p.id);
            return { pageId: p.id, pagePath: p.page, impressions: p.impressions, title: d?.generatedTitle ?? null, metaDescription: d?.generatedMetaDescription ?? null, draftStatus: d?.status ?? "draft", model: d?.model ?? "mock-v1" };
          }),
          { lockedPaths: new Set(lockedMap.keys()), pendingBatchPaths, excludePageIds: new Set(readyPageIds) },
        );
        const batch = await assembleBatch(selected.filter((s) => readyPageIds.includes(s.pageId)), pickupPool);
        if (batch.pageIds.length > 0) {
          const approved = await approveBatchToPR({ pageIds: batch.pageIds, label: `auto-${yyyymmdd(now)}`, actorId: null });
          await armHold(approved.batch.id);
          autoApproved = true;
          batchId = approved.batch.id;
          pickedUp = batch.pickedUp;
        }
      } catch (err) {
        // The drafts are already staged/tagged — a human can still approve
        // them by hand even if auto-approval itself failed.
        console.error("[SEO] nightly auto-approve failed (drafts remain staged for manual approval):", (err as Error).message);
      }
    }
  }

  return { ready, lintBlocked, skippedLocked: skippedLocked.length, totalConsidered: candidates.length, autoApproved, pickedUp, ...(batchId !== undefined ? { batchId } : {}) };
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
        .then((s) => console.log(`[SEO] nightly draft job: ${s.ready} ready, ${s.lintBlocked} lint-blocked, ${s.skippedLocked} skipped (locked), ${s.totalConsidered} considered${s.autoApproved ? `, auto-approved to batch #${s.batchId} (${s.pickedUp} picked up from backlog)` : ""}`))
        .catch((err) => console.error("[SEO] nightly draft job error:", err))
        .finally(arm);
    }, delay);
  };
  console.log("[SEO] Nightly draft job scheduled — 02:00 America/New_York, Mon-Sat");
  arm();
}
