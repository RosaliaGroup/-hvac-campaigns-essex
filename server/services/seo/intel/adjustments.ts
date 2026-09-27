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
import { proposeTopic } from "../contentQueue";
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

export type ItemDraft = {
  kind: string;
  title: string;
  evidence: unknown;
  suggestion: string;
  targetQueue: "meta_lane" | "content_queue" | "page_pr_backlog" | "pending_prompt_additions" | "owner_decision" | "report_only";
  factsBlocked: boolean;
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

  for (const r of input.rising) {
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
          ? `No page currently answers "${u.query}" — routed to the PR-3 backlog (never auto-built).`
          : u.reason === "intent_mismatch"
          ? `"${u.query}" looks commercial-intent but lands on ${u.page} — content-queue proposal or PR-3 backlog candidate.`
          : `"${u.query}" lands on ${u.page} at position ${u.position.toFixed(1)} (worse than 20) — content-queue proposal candidate.`,
      targetQueue: u.reason === "no_page" ? "page_pr_backlog" : "content_queue", factsBlocked: false,
    });
  }

  for (const d of input.decaying) {
    items.push({
      kind: "decaying_page", title: `Decaying page: ${d.page}`, evidence: d,
      suggestion: `${d.page} clicks down ${(d.pctDown * 100).toFixed(0)}% vs the prior window (${d.previousClicks} → ${d.clicks}) — refresh candidate in the content queue.`,
      targetQueue: "content_queue", factsBlocked: false,
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
    try {
      await proposeTopic({
        title: `Refresh: ${evidence.page}`,
        targetQuery: undefined,
        brief: `Decaying page (${(evidence.pctDown * 100).toFixed(0)}% down) — market-intel refresh candidate.`,
        refreshesSlug: evidence.page.replace(/^\//, ""),
        source: "market-intel",
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
