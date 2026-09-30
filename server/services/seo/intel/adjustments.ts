/**
 * §3d "Adjustments made" pipeline (docs/market-intel-spec.md). Turns the
 * classified §3a/§3b/§3c findings into seoIntelItems rows and, where the
 * spec's own mapping names a lane and the guardrails (§4) allow it, executes
 * them through the three sanctioned lane entry points ONLY:
 *   - meta lane:    approveBatchToPR (server/services/seo/bulkApprove.ts)
 *   - content lane: proposeTopic (server/services/seo/contentQueue.ts) — queues
 *                    into the SAME human-gated queue the existing weekly
 *                    content job already drains; this module never drafts or
 *                    publishes a post itself (see file-level note below).
 *   - page-PR lane: openPagePR (./pagePr.ts) — genuinely new lane, see that
 *                    file's header.
 * This module NEVER imports server/services/seo/github.ts, client/src/data/
 * blogPosts.ts, client/src/data/pageProposals.ts, shared/verifiedFacts.ts's
 * write side (it has none), or client/src/pages/AIAssistantPrompts.tsx (the
 * Vapi prompt module) — see server/services/seo/intel/importGraph.test.ts.
 *
 * Content-lane scope decision: unlike the meta and page-PR lanes, a "new
 * post"/"refresh" adjustment does NOT call approveContentToPR itself — it
 * calls proposeTopic(), which creates a status:"proposed" row the EXISTING
 * weekly content job (contentPipeline.ts) still requires a human to promote
 * to "queued" before drafting (contentQueue.ts's own rule: "the model may
 * propose topics but cannot self-select them"). Market-intel is also a model,
 * so it respects that same rule rather than bypassing it — these items are
 * marked "staged" (not "executed") in the report; see §7 report note.
 *
 * "New page" scope decision: §3a's own unserved-query bullet says a new-page
 * suggestion is "routed to the PR-3 backlog, never auto-built", while §3d's
 * generic "new site page" bullet describes an auto-mergeable flow. Given that
 * direct conflict, this module NEVER calls openPagePR automatically — every
 * `new_page` item is report/backlog-only; the CRM's "Propose page PR" button
 * (server/routers/marketIntel.ts's proposePagePr mutation) calls openPagePR
 * on an explicit owner click instead. openPagePR itself is fully real and
 * tested (server/services/seo/intel/pagePr.test.ts) — only its automatic
 * invocation from this daily job is withheld, per the safer reading of the
 * spec's own internal tension.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoPages } from "../../../../drizzle/schema";
import { regenerateUnlockedDrafts } from "../draftManagement";
import { approveBatchToPR, yyyymmdd } from "../bulkApprove";
import { proposeTopic, hasExistingProposal } from "../contentQueue";
import {
  DAILY_CAPS,
  withinDailyCaps,
  recordExecution,
  emptyExecutionCounts,
  suggestionKeyFor,
  isSuppressed,
  laneReadyForAutoExecution,
  type ExecutionCounts,
  type ExecutionKind,
} from "./guardrails";
import type {
  RisingQueryFinding,
  UnservedQueryFinding,
  DecayingPageFinding,
  CannibalizationFinding,
  SeasonalityFinding,
  CompetitorDiffFinding,
} from "../../../../shared/marketIntelTypes";
import type { DifferentiatorMatch, OurStaleClaim } from "./positioning";

/**
 * §3a significance floor + section cap, on top of (not instead of) each
 * classifier's own spec-defined threshold in searchDemand.ts. A page or
 * query that clears the classifier's bar (25% decline; 20/10-impression
 * rising floor) can still be too low-volume to be worth a person's
 * attention individually — this trims the report to what's actually
 * actionable, rather than flooding it with noise from a long tail of
 * single-digit-click pages / borderline queries.
 */
const DECAY_SIGNIFICANCE_MIN_CLICKS = 10;
const SECTION_ITEM_CAP = 15;

export type ItemDraft = {
  kind: string;
  title: string;
  evidence: unknown;
  suggestion: string;
  targetQueue: "meta_lane" | "content_queue" | "page_pr_backlog" | "pending_prompt_additions" | "owner_decision" | "report_only";
  factsBlocked: boolean;
  /**
   * A synthetic rollup item ("N low-traffic pages... not individually
   * actionable") standing in for everything a section's significance floor
   * excluded — never a real finding, never executable. Must short-circuit
   * executionKindFor() regardless of `kind`, since e.g. `kind: "decaying_page"`
   * is normally auto-executable and its evidence here has no real `page`.
   */
  aggregate?: boolean;
};

/** Pure — build the full set of candidate items from every classified finding, before suppression/caps/execution. */
export function buildItemDrafts(input: {
  rising: RisingQueryFinding[];
  unserved: UnservedQueryFinding[];
  decaying: DecayingPageFinding[];
  cannibalization: CannibalizationFinding[];
  seasonality: SeasonalityFinding[];
  competitorDiffs: CompetitorDiffFinding[];
  differentiatorMatches: DifferentiatorMatch[];
  staleClaims: OurStaleClaim[];
}): ItemDraft[] {
  const items: ItemDraft[] = [];

  // Rising queries already clear searchDemand.ts's own impressions floor
  // (>=20 established / >=10 new, per spec) before reaching here — nothing
  // below that floor exists in `input.rising` to aggregate. Only the section
  // cap applies: top SECTION_ITEM_CAP by prior-window volume (impressions).
  const rankedRising = [...input.rising].sort((a, b) => b.impressions - a.impressions).slice(0, SECTION_ITEM_CAP);
  for (const r of rankedRising) {
    items.push({
      kind: "rising_query", title: `Rising query: "${r.query}"`, evidence: r,
      suggestion: r.hasAnsweringPage
        ? `Impressions ${r.isNew ? "are new this week" : `up ${((r.impressionsPctChange ?? 0) * 100).toFixed(0)}%`} for "${r.query}", currently landing on ${r.page} at position ${r.position.toFixed(1)}.`
        : `"${r.query}" is rising and we have no page currently receiving it.`,
      targetQueue: "report_only", factsBlocked: false,
    });
    items.push({
      kind: "ads_keyword_suggestion", title: `Ads keyword candidate: "${r.query}"`, evidence: r,
      suggestion: `Consider a paused keyword for "${r.query}" (rising demand) once Ads API write access exists.`,
      targetQueue: "report_only", factsBlocked: false,
    });
  }

  for (const u of input.unserved) {
    items.push({
      kind: "unserved_query", title: `Unserved query: "${u.query}"`, evidence: u,
      suggestion:
        u.reason === "no_page"
          ? u.clusterTown
            ? `${(u.clusterQueries ?? []).length} "{service} ${u.clusterTown}" queries (${u.impressions} impressions, top: "${u.query}") have no city page — routed to the PR-3 backlog (never auto-built).`
            : `No page currently answers "${u.query}" — routed to the PR-3 backlog (never auto-built).`
          : u.reason === "intent_mismatch"
          ? `"${u.query}" looks commercial-intent but lands on ${u.page} — content-queue proposal or PR-3 backlog candidate.`
          : u.clusterQueries && u.clusterQueries.length > 1
          ? `${u.clusterQueries.length} "{service} ${u.clusterTown}" queries (${u.impressions} impressions, top: "${u.query}") cluster onto ${u.page}, which ranks worse than 30 for all of them — content-queue proposal candidate.`
          : `"${u.query}" lands on ${u.page} at position ${u.position.toFixed(1)} (worse than 30) — content-queue proposal candidate.`,
      targetQueue: u.reason === "no_page" ? "page_pr_backlog" : "content_queue", factsBlocked: false,
    });
  }

  const significantDecaying = input.decaying.filter(
    (d) => d.previousClicks >= DECAY_SIGNIFICANCE_MIN_CLICKS, // impressions alone never qualify (searchDemand.ts enforces the same floor upstream)
  );
  const belowFloorDecayingCount = input.decaying.length - significantDecaying.length;
  const rankedDecaying = [...significantDecaying]
    .sort((a, b) => b.previousClicks - a.previousClicks || b.previousImpressions - a.previousImpressions)
    .slice(0, SECTION_ITEM_CAP);
  for (const d of rankedDecaying) {
    items.push({
      kind: "decaying_page", title: `Decaying page: ${d.page}`, evidence: d,
      suggestion: `${d.page} clicks down ${(d.pctDown * 100).toFixed(0)}% vs the prior window (${d.previousClicks} → ${d.clicks}) — refresh candidate in the content queue.`,
      targetQueue: "content_queue", factsBlocked: false,
    });
  }
  if (belowFloorDecayingCount > 0) {
    items.push({
      kind: "decaying_page",
      title: `${belowFloorDecayingCount} low-traffic pages with fewer than ${DECAY_SIGNIFICANCE_MIN_CLICKS} prior clicks — not individually actionable`,
      evidence: { belowFloorCount: belowFloorDecayingCount, minClicks: DECAY_SIGNIFICANCE_MIN_CLICKS },
      suggestion: `${belowFloorDecayingCount} page(s) declined ≥25% but stayed under the ${DECAY_SIGNIFICANCE_MIN_CLICKS}-prior-click significance floor — too low-volume to prioritize individually. No refresh queued for any of them.`,
      targetQueue: "report_only", factsBlocked: false, aggregate: true,
    });
  }

  for (const c of input.cannibalization) {
    items.push({
      kind: "cannibalization", title: `Cannibalization: "${c.query}"`, evidence: c,
      suggestion: `${c.pages.join(" and ")} are alternating for "${c.query}" — consolidation review item.`,
      targetQueue: "report_only", factsBlocked: false,
    });
  }

  for (const s of input.seasonality) {
    items.push({
      kind: "seasonality", title: `Seasonality: "${s.query}"`, evidence: s,
      suggestion: s.note, targetQueue: "report_only", factsBlocked: false,
    });
  }

  for (const diff of input.competitorDiffs) {
    const isMatch = input.differentiatorMatches.some((m) => m.evidence === diff.after);
    if (isMatch) {
      items.push({
        kind: "positioning_match", title: `${diff.competitor} now claims a differentiator we rely on`, evidence: diff,
        suggestion: `${diff.competitor}'s ${diff.pagePath} now reads: "${diff.after}". Owner decision: confirm our positioning still differentiates, or add a new differentiator.`,
        targetQueue: "owner_decision", factsBlocked: true,
      });
    } else if (diff.kind === "price_change" || diff.kind === "warranty_change") {
      items.push({
        kind: diff.kind === "price_change" ? "competitor_price_change" : "competitor_warranty_change",
        title: `${diff.competitor} changed ${diff.field} on ${diff.pagePath}`, evidence: diff,
        suggestion: `${diff.before ?? "—"} → ${diff.after ?? "—"}. Counter: consider a content topic or meta emphasis (this is a facts-adjacent claim — routes through the owner-decision/meta lane, never auto-published).`,
        targetQueue: "owner_decision", factsBlocked: true,
      });
    } else {
      const kindMap: Record<string, string> = {
        new_offer: "competitor_new_offer", new_page: "competitor_new_page",
        service_area_change: "competitor_service_area_change", messaging_change: "competitor_messaging_change",
      };
      items.push({
        kind: kindMap[diff.kind] ?? "competitor_messaging_change",
        title: `${diff.competitor}: ${diff.kind.replace(/_/g, " ")} on ${diff.pagePath}`, evidence: diff,
        suggestion: `${diff.before ?? "—"} → ${diff.after ?? "—"} (watch — no action).`,
        targetQueue: "report_only", factsBlocked: false,
      });
    }
  }

  for (const claim of input.staleClaims) {
    items.push({
      kind: "our_claims_stale", title: `Stale claim on ${claim.page}`, evidence: claim,
      suggestion: `${claim.issue} Suggestion: meta lane or refresh lane.`,
      targetQueue: "meta_lane", factsBlocked: false,
    });
  }

  return items;
}

/* ── Execution (real writes, through the sanctioned lanes only) ─────────── */

export type ExecutedResult = { status: "executed"; batchId: number; prUrl?: string; prNumber?: number } | { status: "staged"; reason: string } | { status: "not_executable" };

function executionKindFor(item: ItemDraft): ExecutionKind | null {
  if (item.aggregate) return null;
  if (item.targetQueue === "meta_lane") return "meta_change";
  if (item.kind === "decaying_page") return "refresh_post";
  return null;
}

async function pageIdForPath(pagePath: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(seoPages).where(eq(seoPages.page, pagePath)).limit(1);
  return row?.id ?? null;
}

/**
 * Attempt to execute one item through its sanctioned lane, respecting §4's
 * caps/warm-up/circuit-breaker (already-evaluated `ctx`). Returns "staged"
 * (not executed, but a valid, non-error outcome) far more often than
 * "executed" — this mirrors nightlyDraftJob.ts's own auto-approve gate.
 */
export async function executeItem(
  item: ItemDraft,
  ctx: { counts: ExecutionCounts; metaWarmedUp: boolean; circuitClear: boolean; now?: Date },
): Promise<{ result: ExecutedResult; counts: ExecutionCounts }> {
  const kind = executionKindFor(item);
  if (!kind) return { result: { status: "not_executable" }, counts: ctx.counts };

  // Fact firewall (§4/§7): a facts-blocked (owner-decision) item never executes
  // through a lane on its own — defensive here even though today's mapping
  // never routes a factsBlocked item to "meta_lane"/"decaying_page" execution;
  // see server/services/seo/intel/ownerDecision.ts for the canonical gate.
  if (item.factsBlocked) return { result: { status: "staged", reason: "owner-decision item — needs your number" }, counts: ctx.counts };

  if (!ctx.circuitClear) return { result: { status: "staged", reason: "circuit breaker is open" }, counts: ctx.counts };
  if (!withinDailyCaps(ctx.counts, kind)) return { result: { status: "staged", reason: "daily execution cap reached" }, counts: ctx.counts };

  if (item.targetQueue === "meta_lane") {
    if (!ctx.metaWarmedUp) return { result: { status: "staged", reason: "meta lane not warmed up — staged, approve to run" }, counts: ctx.counts };
    const evidence = item.evidence as { page?: string };
    const pagePath = evidence.page;
    if (!pagePath) return { result: { status: "not_executable" }, counts: ctx.counts };
    const pageId = await pageIdForPath(pagePath);
    if (pageId === null) return { result: { status: "staged", reason: `no seoPages row for ${pagePath}` }, counts: ctx.counts };
    try {
      const { results } = await regenerateUnlockedDrafts([pageId]);
      if (!results.some((r) => r.ok)) return { result: { status: "staged", reason: "draft generation failed or was lint-blocked" }, counts: ctx.counts };
      const approved = await approveBatchToPR({ pageIds: [pageId], label: `intel-${yyyymmdd(ctx.now)}`, actorId: null });
      return { result: { status: "executed", batchId: approved.batch.id, prUrl: approved.prUrl, prNumber: approved.prNumber }, counts: recordExecution(ctx.counts, kind) };
    } catch (err) {
      return { result: { status: "staged", reason: `meta lane execution failed: ${(err as Error).message}` }, counts: ctx.counts };
    }
  }

  if (item.kind === "decaying_page") {
    const evidence = item.evidence as DecayingPageFinding;
    const refreshesSlug = evidence.page.replace(/^\//, "");
    const source = "market-intel:decaying_page"; // encodes (page, kind) — see hasExistingProposal's doc
    try {
      // The intel job re-finds the SAME decaying page on every run until it's
      // actually refreshed — without this check, a page proposed once when
      // "Optimize Everything" caps 30 pages runs, then found decaying again
      // tomorrow, gets re-proposed forever, piling up duplicate seoContentQueue
      // rows for the exact same (page, kind) that a human has to de-dup by hand.
      if (await hasExistingProposal(refreshesSlug, source)) {
        return { result: { status: "staged", reason: `already proposed for ${evidence.page} — not re-queued` }, counts: recordExecution(ctx.counts, kind) };
      }
      await proposeTopic({
        title: `Refresh: ${evidence.page}`,
        targetQuery: undefined,
        brief: `Decaying page (${(evidence.pctDown * 100).toFixed(0)}% down) — market-intel refresh candidate.`,
        refreshesSlug,
        source,
      });
      // Queued, not published — see file header. Counted against the refresh cap either way (§4 caps intent).
      return { result: { status: "staged", reason: "queued to the content lane (proposed) — requires promotion to \"queued\" before drafting" }, counts: recordExecution(ctx.counts, kind) };
    } catch (err) {
      return { result: { status: "staged", reason: `queueing failed: ${(err as Error).message}` }, counts: ctx.counts };
    }
  }

  return { result: { status: "not_executable" }, counts: ctx.counts };
}

export { emptyExecutionCounts, suggestionKeyFor, isSuppressed, laneReadyForAutoExecution, DAILY_CAPS };
