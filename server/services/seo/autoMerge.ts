/**
 * Autopublish hold-and-veto merge gate (docs/seo-automation-addendum-autopublish.md
 * §A2). This is the ONLY place in the codebase allowed to call
 * server/services/seo/github.ts's mergePR() — every other path (human review)
 * merges through GitHub directly, outside this app.
 *
 * armHold(): called right after a batch is approved-to-PR, IF that lane is
 * warmed up (server/services/seo/warmupGate.ts) — sets holdUntil and emails
 * the SEO_ALERT_EMAIL a Veto link (signed, unauthenticated) and an Edit link
 * (CRM login + return path).
 *
 * checkAndMergeIfReady(): the poll target (see startAutoMergeScheduler at the
 * bottom — no webhook, same "no push infra decision made" reasoning as
 * bulkApprove.ts's refreshBatchStatus). Every gate must pass: hold expired,
 * lane still warmed up, circuit breaker not paused, Netlify green, no PR
 * comments. A vetoed batch is naturally excluded — vetoBatch() already moved
 * it out of "pr_open" before this ever runs.
 */
import { eq, and, isNotNull } from "drizzle-orm";
import { getDb } from "../../db";
import { seoApprovalBatches, type SeoApprovalBatchRow } from "../../../drizzle/schema";
import { laneForBatch, refreshBatchStatus, approveBatchToPR, type ApproveBatchInput, type ApproveBatchResult } from "./bulkApprove";
import { isWarmedUp, advanceWarmup } from "./warmupGate";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { getNetlifyCheckState, hasAnyPRComments, mergePR } from "./github";
import { signActionLink } from "./actionLinks";
import { logAudit } from "./auditLog";
import { sendEmail } from "../emailService";

const DEFAULT_HOLD_HOURS = 24;
const MIN_HOLD_HOURS = 6;

function holdHours(): number {
  const raw = Number(process.env.SEO_AUTOPUBLISH_HOLD_HOURS);
  if (!Number.isFinite(raw)) return DEFAULT_HOLD_HOURS;
  return Math.max(MIN_HOLD_HOURS, raw);
}

/**
 * Arm the hold on a freshly-approved batch and notify. Call only when
 * isWarmedUp(lane) is true. No-ops (leaves the batch as a normal PR with no
 * hold — a human merges it on GitHub) when SEO_AUTOPUBLISH_ENABLED isn't
 * "true": the single choke point for the addendum §A5 master switch
 * ("SEO_AUTOPUBLISH_ENABLED=false kills both lanes immediately") — every
 * caller (both jobs' auto-approve gate, both lanes' human-triggered "Approve
 * to PR" wrapper) goes through this function to arm a hold, so the flag is
 * enforced in exactly one place rather than duplicated at each call site.
 */
export async function armHold(batchId: number): Promise<void> {
  if (process.env.SEO_AUTOPUBLISH_ENABLED !== "true") return;
  const db = await getDb();
  if (!db) return;
  const holdUntil = new Date(Date.now() + holdHours() * 60 * 60 * 1000);
  await db.update(seoApprovalBatches).set({ holdUntil }).where(eq(seoApprovalBatches.id, batchId));
  await sendHoldNotification(batchId, holdUntil);
}

async function sendHoldNotification(batchId: number, holdUntil: Date): Promise<void> {
  const to = process.env.SEO_ALERT_EMAIL;
  if (!to) return;
  const db = await getDb();
  if (!db) return;
  const [batch] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
  if (!batch) return;

  const siteUrl = (process.env.PUBLIC_SITE_URL ?? "https://mechanicalenterprise.com").replace(/\/+$/, "");
  let vetoLine = "";
  try {
    const vetoToken = signActionLink(batchId, "veto");
    vetoLine = `<p><a href="${siteUrl}/api/seo/action?token=${encodeURIComponent(vetoToken)}">Veto this batch</a> (closes the PR, no merge)</p>`;
  } catch {
    // SEO_ACTION_LINK_SECRET not configured — omit the veto link rather than fail the whole notification.
  }
  const editLine = `<p><a href="${siteUrl}/seo-intelligence?batch=${batchId}">Edit in the CRM</a> (resets the hold)</p>`;

  await sendEmail({
    to,
    subject: `Auto-publish scheduled: ${batch.label} — merges ${holdUntil.toLocaleString("en-US", { timeZone: "America/New_York" })} ET unless vetoed`,
    html: `<p><b>${batch.label}</b> will auto-merge at ${holdUntil.toISOString()} if the preview is green and nobody vetoes or comments.</p>${batch.prUrl ? `<p><a href="${batch.prUrl}">View the PR</a></p>` : ""}${vetoLine}${editLine}`,
  }).catch(() => {
    // Best-effort — a notification failure must not block the hold from working.
  });
}

export type MergeCheckResult =
  | { merged: false; reason: "not_pr_open" | "no_hold" | "hold_not_expired" | "not_warmed_up" | "circuit_paused" | "netlify_not_green" | "has_comments" | "no_commit_sha" | "merge_rejected" }
  | { merged: true; sha: string | null };

/**
 * Pure decision given already-fetched signals — the actual gate logic,
 * cheaply testable without a DB/GitHub/email.
 */
export function evaluateAutoMergeReadiness(input: {
  batch: Pick<SeoApprovalBatchRow, "status" | "holdUntil" | "commitSha" | "prNumber">;
  now: Date;
  isWarmedUp: boolean;
  circuitPaused: boolean;
  netlifyState: "success" | "failure" | "pending" | "unknown";
  hasComments: boolean;
}): { ready: true } | { ready: false; reason: Exclude<MergeCheckResult, { merged: true }>["reason"] } {
  if (input.batch.status !== "pr_open") return { ready: false, reason: "not_pr_open" };
  if (!input.batch.holdUntil) return { ready: false, reason: "no_hold" };
  if (input.batch.holdUntil.getTime() > input.now.getTime()) return { ready: false, reason: "hold_not_expired" };
  if (!input.isWarmedUp) return { ready: false, reason: "not_warmed_up" };
  if (input.circuitPaused) return { ready: false, reason: "circuit_paused" };
  if (!input.batch.commitSha) return { ready: false, reason: "no_commit_sha" };
  if (input.netlifyState !== "success") return { ready: false, reason: "netlify_not_green" };
  if (input.hasComments) return { ready: false, reason: "has_comments" };
  return { ready: true };
}

/** Real I/O: fetch every signal for `batchId`, evaluate, merge if ready. */
export async function checkAndMergeIfReady(batchId: number): Promise<MergeCheckResult> {
  const db = await getDb();
  if (!db) return { merged: false, reason: "not_pr_open" };
  const [batch] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
  if (!batch) return { merged: false, reason: "not_pr_open" };

  const lane = laneForBatch(batch.branch);
  const [warmedUp, breaker, netlifyState, hasComments] = await Promise.all([
    isWarmedUp(lane),
    checkCircuitBreakerConditions(),
    batch.commitSha ? getNetlifyCheckState(batch.commitSha) : Promise.resolve("unknown" as const),
    batch.prNumber ? hasAnyPRComments(batch.prNumber) : Promise.resolve(false),
  ]);

  const readiness = evaluateAutoMergeReadiness({
    batch, now: new Date(), isWarmedUp: warmedUp, circuitPaused: breaker.shouldPause, netlifyState, hasComments,
  });
  if (!readiness.ready) return { merged: false, reason: readiness.reason };

  const result = await mergePR(batch.prNumber as number);
  if (!result.merged) return { merged: false, reason: "merge_rejected" };

  await db.update(seoApprovalBatches).set({ status: "merged", commitSha: result.sha ?? batch.commitSha }).where(eq(seoApprovalBatches.id, batchId));
  await logAudit({
    actorId: null, action: "merged_detected", batchId, pagePath: null,
    before: { status: "pr_open" }, after: { status: "merged", mergeMode: "auto" }, lintResult: null,
  });
  if (!batch.revertsBatchId) await advanceWarmup(lane, null);

  return { merged: true, sha: result.sha };
}

/** Human override: skip the hold timer + warm-up + comment gates for ONE item. Still requires a green preview. */
export async function publishNow(batchId: number, actorId: number | null): Promise<MergeCheckResult> {
  const db = await getDb();
  if (!db) return { merged: false, reason: "not_pr_open" };
  const [batch] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, batchId)).limit(1);
  if (!batch) return { merged: false, reason: "not_pr_open" };
  if (batch.status !== "pr_open") return { merged: false, reason: "not_pr_open" };
  if (!batch.commitSha) return { merged: false, reason: "no_commit_sha" };

  const netlifyState = await getNetlifyCheckState(batch.commitSha);
  if (netlifyState !== "success") return { merged: false, reason: "netlify_not_green" };

  const result = await mergePR(batch.prNumber as number);
  if (!result.merged) return { merged: false, reason: "merge_rejected" };

  await db.update(seoApprovalBatches).set({ status: "merged", commitSha: result.sha ?? batch.commitSha }).where(eq(seoApprovalBatches.id, batchId));
  await logAudit({
    actorId, action: "merged_detected", batchId, pagePath: null,
    before: { status: "pr_open" }, after: { status: "merged", mergeMode: "manual_override" }, lintResult: null,
  });
  if (!batch.revertsBatchId) await advanceWarmup(laneForBatch(batch.branch), actorId);

  return { merged: true, sha: result.sha };
}

/**
 * Approve-to-PR wrapper (meta lane) that additionally arms the autopublish
 * hold when the lane is warmed up. bulkApprove.ts stays free of any
 * dependency on this file (avoids a circular import — this file already
 * depends on it) — callers (the tRPC router) use this wrapper instead of the
 * raw approve function so warm-up is checked in exactly one place. A lane
 * that ISN'T warmed up behaves identically to before this file existed: a
 * normal PR with no hold, merged by a human on GitHub.
 *
 * The content-lane equivalent (approveContentToPRWithAutopublish) lives in
 * contentPipeline.ts itself, NOT here — this file already depends on
 * contentPipeline.ts's sibling module bulkApprove.ts is fine (one-way), but
 * contentPipeline.ts ALSO needs to call armHold() (below) for its own
 * job-triggered auto-approve path (see runWeeklyContentJob), which would
 * make this file depend on contentPipeline.ts AND vice versa — a real cycle.
 * Keeping the content wrapper in contentPipeline.ts (which already has
 * approveContentToPR in scope) avoids that entirely.
 */
export async function approveMetaBatchWithAutopublish(input: ApproveBatchInput): Promise<ApproveBatchResult> {
  const result = await approveBatchToPR(input);
  if (await isWarmedUp("meta")) await armHold(result.batch.id);
  return result;
}

export const AUTO_MERGE_POLL_MS = 15 * 60 * 1000;

let tickRunning = false;

/**
 * One poll of the auto-merge gate: every pr_open batch that has a hold gets
 * refreshed and, if every gate passes, merged. Logs a line per tick AND per
 * batch (with the gate that blocked it), so a batch that is sitting unmerged is
 * explainable from the logs — before this, only a successful merge logged
 * anything and PR #141's silent has_comments block took a human to notice.
 * Overlapping ticks are skipped rather than stacked.
 */
export async function runAutoMergeTick(): Promise<{ checked: number; merged: number; skipped?: true }> {
  if (tickRunning) {
    console.log("[SEO] auto-merge tick skipped — previous tick still running");
    return { checked: 0, merged: 0, skipped: true };
  }
  tickRunning = true;
  const startedAt = Date.now();
  let checked = 0;
  let merged = 0;
  try {
    const db = await getDb();
    if (!db) {
      console.log("[SEO] auto-merge tick: database unavailable");
      return { checked, merged };
    }
    const dueBatches = await db.select().from(seoApprovalBatches).where(and(eq(seoApprovalBatches.status, "pr_open"), isNotNull(seoApprovalBatches.holdUntil)));
    console.log(`[SEO] auto-merge tick: ${dueBatches.length} open batch(es) with a hold`);
    for (const batch of dueBatches) {
      checked++;
      try {
        // refreshBatchStatus first so a batch someone already merged by hand on
        // GitHub is reflected before we'd otherwise try (and fail) to merge it again.
        await refreshBatchStatus(batch.id);
        const result = await checkAndMergeIfReady(batch.id);
        if (result.merged) {
          merged++;
          console.log(`[SEO] auto-merged batch ${batch.id} (${batch.label})`);
        } else {
          console.log(`[SEO] auto-merge batch ${batch.id} (${batch.label}) not merged: ${result.reason}${batch.holdUntil ? ` (hold until ${batch.holdUntil.toISOString()})` : ""}`);
        }
      } catch (err) {
        console.error(`[SEO] auto-merge check failed for batch ${batch.id}:`, (err as Error).message);
      }
    }
    return { checked, merged };
  } finally {
    tickRunning = false;
    console.log(`[SEO] auto-merge tick done: checked ${checked}, merged ${merged}, ${Date.now() - startedAt}ms`);
  }
}

/** In-process poller, every 15 minutes. Mirrors the other SEO schedulers' pattern. */
export function startAutoMergeScheduler(): void {
  if (process.env.SEO_AUTOPUBLISH_ENABLED !== "true") {
    console.log("[SEO] Autopublish auto-merge scheduler disabled (set SEO_AUTOPUBLISH_ENABLED=true to enable)");
    return;
  }
  console.log("[SEO] Autopublish auto-merge scheduler started — polling every 15 minutes");
  setInterval(() => {
    runAutoMergeTick().catch((err) => console.error("[SEO] auto-merge tick failed:", err));
  }, AUTO_MERGE_POLL_MS);
  runAutoMergeTick().catch((err) => console.error("[SEO] auto-merge scheduler initial run failed:", err));
}
