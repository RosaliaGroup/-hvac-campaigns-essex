/**
 * Weekly B2B content pipeline orchestration (docs/seo-automation-spec.md
 * Part 2, extended by docs/seo-automation-addendum-autopublish.md's auto-lane
 * decision). runWeeklyContentJob() drafts ONE post from the queue, lints it
 * (title/meta + the extended body linter + the critic pass), and stores the
 * result. approveContentToPR() is the separate publish step, reusing the
 * SAME seoApprovalBatches table and GitHub-PR machinery the meta lane uses
 * (laneForBatch() already tells them apart by branch prefix), so
 * veto/revert/refresh-status/warm-up all work uniformly across both lanes
 * with no additional code.
 *
 * Auto-lane resolution (owner decision, 2026-09-26): once SEO_AUTOPUBLISH_ENABLED
 * is "true" AND the content lane is warmed up AND the circuit breaker is
 * clear, runWeeklyContentJob calls approveContentToPR itself (label
 * "auto-YYYYMMDD" — matching the meta lane's nightly job and, importantly,
 * circuitBreaker.ts's lastTwoAutoLaneNetlifyStates(), which identifies
 * "auto-lane" batches by that label prefix) and arms the hold. Otherwise it
 * stages only — the original Part-2 behavior.
 *
 * The draft itself is stored as a seoAuditLog `draft_generated` row's `after`
 * JSON (lane: "content") rather than a new column — findLatestContentDraft()
 * reads it back. Keeps the schema minimal; the audit log is already the
 * durable, queryable record this needs.
 */
import fs from "fs";
import path from "path";
import { getDb } from "../../db";
import { seoApprovalBatches, type SeoContentQueueRow } from "../../../drizzle/schema";
import { VERIFIED_FACTS, isFactsConfigured, isPriceRangeStale, type VerifiedFacts } from "../../../shared/verifiedFacts";
import { lintPageMeta, type LintResult } from "../../../shared/seoLinter";
import { lintContent, isResidentialOrRebateTopic, type ContentLintResult } from "../../../shared/contentLinter";
import { countPostStructure, renderPostPlainText, extractInternalLinkPaths, extractExistingTitles, insertBlogPostIntoSource } from "../../../shared/blogPostRendering";
import type { BlogPostData } from "../../../client/src/data/blogPosts";
import { nextTopicToProcess, updateQueueStatus } from "./contentQueue";
import { draftContentPost, ContentDraftParseError } from "./contentDrafting";
import { runCriticPass, type CriticVerdict } from "./criticPass";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { logAudit, listAuditLog } from "./auditLog";
import { isGithubConfigured, GithubNotConfiguredError, ensureBranch, getFileContent, putFileContent, openOrGetPR } from "./github";
import { yyyymmdd } from "./bulkApprove";
import { uniqueBranchFor, findOpenBatchWithPrefix, CONTENT_BRANCH_PREFIX } from "./batchBranches";
import { isWarmedUp } from "./warmupGate";
import { armHold } from "./autoMerge";
import { msUntilNextRun, parseCronToSchedule, type ScheduleSpec } from "../../../shared/cronTiming";

const DEFAULT_CONTENT_SCHEDULE: ScheduleSpec = { hour: 6, minute: 0, timeZone: "America/New_York", weekdays: [3] };

const BLOG_POSTS_PATH = "client/src/data/blogPosts.ts";

function localBlogPostsSourcePath(): string {
  return path.resolve(import.meta.dirname, "../../../client/src/data/blogPosts.ts");
}

/** Existing post titles/H1s for the duplicate-topic check — read from the LOCAL checkout (this server's own deployed copy), not GitHub, since drafting/linting doesn't need the PAT. */
function readLocalExistingTitles(): string[] {
  try {
    return extractExistingTitles(fs.readFileSync(localBlogPostsSourcePath(), "utf-8"));
  } catch {
    return [];
  }
}

export type ContentDraftOutcome =
  | { status: "no_topic" }
  | { status: "circuit_paused"; reason: string | null }
  | { status: "facts_not_configured" }
  /** The lane would auto-publish but a content PR is still open: drafting waits, so two PRs never edit the same blogPosts.ts anchor and conflict. */
  | { status: "open_pr"; batchId: number; prNumber: number | null }
  | { status: "refused_residential_rebate"; topicId: number }
  | {
      status: "drafted";
      topicId: number;
      passes: boolean;
      post: BlogPostData;
      metaLint: LintResult;
      contentLint: ContentLintResult;
      critic: CriticVerdict;
      /** Draft attempts used for this topic (1 = first draft, up to 1 + MAX_CONTENT_RETRIES). */
      attempts: number;
      /** Topics that failed every retry earlier in THIS run and were set aside (they stay status "drafted" so the queue skips them; their audit row carries blocked: true). */
      blockedTopicIds: number[];
      /** True iff the content lane was warmed up + circuit-clear and this run auto-approved the draft to a PR. False = staged only. */
      autoApproved: boolean;
      batchId?: number;
    };

/** docs/positioning-warranty-spec.md §9b — "reminder in the weekly summary". A no-op today: facts.priceRanges is empty until the owner supplies entries. */
function warnOnStalePriceRanges(facts: VerifiedFacts, now: Date): void {
  for (const range of facts.priceRanges) {
    if (isPriceRangeStale(range, now)) {
      console.warn(`[SEO] price range for ${range.page} (${range.item}) is stale — last confirmed ${range.asOf}, more than 180 days ago.`);
    }
  }
}

/** Retries after the first draft when it fails lint/critic, each fed the previous attempt's findings (so at most 1 + 2 = 3 drafts per topic). */
export const MAX_CONTENT_RETRIES = 2;
/** Cap on topics set aside per run, bounding API spend when several queued topics keep failing. */
export const MAX_BLOCKED_TOPICS_PER_RUN = 3;

type EvaluatedDraft = { post: BlogPostData; metaLint: LintResult; contentLint: ContentLintResult; critic: CriticVerdict; passes: boolean };

async function evaluateDraft(post: BlogPostData, facts: VerifiedFacts): Promise<EvaluatedDraft> {
  const pagePath = `/blog/${post.slug}`;
  const structure = countPostStructure(post);
  const body = renderPostPlainText(post);

  const metaLint = lintPageMeta({ pagePath, title: post.title, metaDescription: post.metaDescription });
  const contentLint = lintContent(
    {
      title: post.title,
      metaDescription: post.metaDescription,
      body,
      h1Count: structure.h1Count,
      h2Count: structure.h2Count,
      h3Count: structure.h3Count,
      faqQuestionCount: structure.faqQuestionCount,
      internalLinkPaths: extractInternalLinkPaths(post),
      existingTitlesAndH1s: readLocalExistingTitles(),
    },
    facts,
  );
  const critic = await runCriticPass(body, facts);
  return { post, metaLint, contentLint, critic, passes: metaLint.passes && contentLint.passes && critic.passes };
}

/** Blocking (non-warn) findings from every gate, phrased as instructions for the next draft attempt. */
/** Word-count target the drafter is told to aim for (the linter's window is 900-1400). */
const WORD_COUNT_TARGET = 1100;

/**
 * "Body is 811 words" alone did not move the model across three retries. Say what to DO: how many words to add (or cut), and
 * where they should come from — expanding the shortest sections with concrete detail, never padding or repeating.
 */
export function describeFinding(code: string, message: string): string {
  if (code === "word_count") {
    const n = Number(message.match(/Body is (\d+) words/)?.[1]);
    if (Number.isFinite(n)) {
      if (n < WORD_COUNT_TARGET) {
        return `word_count: ${message} Write about ${WORD_COUNT_TARGET - n} MORE words (aim for ~${WORD_COUNT_TARGET} total): expand your shortest sections with concrete detail — what to ask, what to send, a worked example — and add a section if needed. Do not pad or repeat yourself.`;
      }
      return `word_count: ${message} Cut about ${n - WORD_COUNT_TARGET} words (aim for ~${WORD_COUNT_TARGET} total) by tightening the longest sections, not by dropping required parts.`;
    }
  }
  return `${code}: ${message}`;
}

export function collectBlockingFindings(e: Pick<EvaluatedDraft, "metaLint" | "contentLint" | "critic">): string[] {
  return [
    ...e.metaLint.findings.filter((f) => f.severity !== "warn").map((f) => describeFinding(f.code, f.message)),
    ...e.contentLint.findings.filter((f) => f.severity !== "warn").map((f) => describeFinding(f.code, f.message)),
    ...e.critic.unsupportedClaims.map((c) => `unsupported_claim (remove it or replace it with a VERIFIED FACT): ${c}`),
  ];
}

/** First draft + up to MAX_CONTENT_RETRIES retries, stopping at the first passing draft. Never weakens a gate — a topic that never passes is reported, not forced. */
async function draftUntilPassing(topic: SeoContentQueueRow, facts: VerifiedFacts): Promise<EvaluatedDraft & { attempts: number }> {
  let findings: string[] = [];
  let last: EvaluatedDraft | null = null;
  let parseError: unknown = null;
  for (let attempt = 1; attempt <= 1 + MAX_CONTENT_RETRIES; attempt++) {
    let post: BlogPostData;
    try {
      post = await draftContentPost(topic, facts, findings);
    } catch (err) {
      if (!(err instanceof ContentDraftParseError)) throw err;
      parseError = err;
      findings = [...findings, `invalid_json: your previous response was not the required JSON object (${(err as Error).message.replace(/^Content draft response was not parseable as the expected JSON shape:\s*/, "").slice(0, 200)}) — respond with ONLY that JSON object, every section complete.`];
      continue;
    }
    last = await evaluateDraft(post, facts);
    if (last.passes) return { ...last, attempts: attempt };
    findings = collectBlockingFindings(last);
  }
  if (!last) throw parseError; // every attempt was unparseable — nothing to store; the topic stays queued
  return { ...last, attempts: 1 + MAX_CONTENT_RETRIES };
}

/**
 * Draft (and, once warmed up, auto-approve) the next eligible topic. Safe to
 * call repeatedly — no-ops when there's nothing to draft. A draft that fails
 * lint/critic is retried up to MAX_CONTENT_RETRIES times with its findings fed
 * back; a topic that still fails is set aside (audit row blocked: true, queue
 * status stays "drafted" so nextTopicToProcess skips it) and the run moves on
 * to the next topic, up to MAX_BLOCKED_TOPICS_PER_RUN.
 */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function runWeeklyContentJob(facts: VerifiedFacts = VERIFIED_FACTS): Promise<ContentDraftOutcome> {
  warnOnStalePriceRanges(facts, new Date());

  const breaker = await checkCircuitBreakerConditions();
  if (breaker.shouldPause) return { status: "circuit_paused", reason: breaker.reason };

  // One open content PR at a time (each post inserts into the same blogPosts.ts anchor, so concurrent PRs conflict). Only when this lane would auto-publish.
  if (process.env.SEO_AUTOPUBLISH_ENABLED === "true" && (await isWarmedUp("content"))) {
    const open = await findOpenBatchWithPrefix(CONTENT_BRANCH_PREFIX);
    if (open) {
      console.log(`[SEO] weekly content: batch #${open.id} (PR #${open.prNumber ?? "?"}) is still open — not drafting until it merges`);
      return { status: "open_pr", batchId: open.id, prNumber: open.prNumber ?? null };
    }
  }

  const blockedTopicIds: number[] = [];
  let lastBlocked: ContentDraftOutcome | null = null;

  while (blockedTopicIds.length < MAX_BLOCKED_TOPICS_PER_RUN) {
    const topic = await nextTopicToProcess();
    if (!topic || blockedTopicIds.includes(topic.id)) return lastBlocked ?? { status: "no_topic" };

    if (isResidentialOrRebateTopic(topic)) {
      // Set aside refused topics so later eligible topics can proceed.
      await updateQueueStatus(topic.id, "drafted");
      console.warn("[SEO] content topic refused by safety gate; set aside:", topic.id);
      blockedTopicIds.push(topic.id);
      lastBlocked = { status: "refused_residential_rebate", topicId: topic.id };
      continue;
    }
    if (!isFactsConfigured(facts)) {
      return { status: "facts_not_configured" };
    }

    const { post, metaLint, contentLint, critic, passes, attempts } = await draftUntilPassing(topic, facts);
    const pagePath = `/blog/${post.slug}`;

    await updateQueueStatus(topic.id, "drafted");
    await logAudit({
      actorId: null,
      action: "draft_generated",
      batchId: null,
      pagePath,
      before: null,
      after: { lane: "content", topicId: topic.id, post, metaLint, contentLint, criticBlocked: !critic.passes, criticClaims: critic.unsupportedClaims, passes, attempts, ...(passes ? {} : { blocked: true }) },
      lintResult: null,
    });

    if (!passes) {
      console.warn(`[SEO] content topic #${topic.id} blocked after ${attempts} attempts — set aside, moving on.`);
      blockedTopicIds.push(topic.id);
      lastBlocked = { status: "drafted", topicId: topic.id, passes, post, metaLint, contentLint, critic, attempts, blockedTopicIds: [...blockedTopicIds], autoApproved: false };
      continue;
    }

    let autoApproved = false;
    let batchId: number | undefined;
    if (process.env.SEO_AUTOPUBLISH_ENABLED === "true") {
      const warmedUp = await isWarmedUp("content");
      if (warmedUp && !breaker.shouldPause) {
        try {
          const approved = await approveContentToPR(topic.id, null, `auto-${yyyymmdd()}`);
          await armHold(approved.batchId);
          autoApproved = true;
          batchId = approved.batchId;
        } catch (err) {
          // The draft is already stored — a human can still approve it by hand
          // even if auto-approval itself failed (e.g. GitHub transiently down).
          console.error("[SEO] weekly content auto-approve failed (draft remains staged for manual approval):", (err as Error).message);
        }
      }
    }

    return { status: "drafted", topicId: topic.id, passes, post, metaLint, contentLint, critic, attempts, blockedTopicIds, autoApproved, ...(batchId !== undefined ? { batchId } : {}) };
  }
  return lastBlocked ?? { status: "no_topic" };
}

export type StoredContentDraft = {
  topicId: number;
  post: BlogPostData;
  metaLint: LintResult;
  contentLint: ContentLintResult;
  criticBlocked: boolean;
  criticClaims: string[];
  passes: boolean;
  /** True iff every retry failed and the topic was set aside (see runWeeklyContentJob). */
  blocked?: boolean;
  attempts?: number;
  generatedAt: Date;
};

/** Most recent content-lane draft for `topicId`, or null. */
export async function findLatestContentDraft(topicId: number): Promise<StoredContentDraft | null> {
  const rows = await listAuditLog({ action: "draft_generated", limit: 500 });
  const match = rows.find((r) => {
    const after = r.after as { lane?: string; topicId?: number } | null;
    return after?.lane === "content" && after.topicId === topicId;
  });
  if (!match) return null;
  const after = match.after as {
    post: BlogPostData; metaLint: LintResult; contentLint: ContentLintResult; criticBlocked: boolean; criticClaims: string[]; passes: boolean; blocked?: boolean; attempts?: number;
  };
  return { topicId, ...after, generatedAt: match.ts instanceof Date ? match.ts : new Date(match.ts) };
}

export class ContentNotReadyError extends Error {
  constructor(reason: string) {
    super(`This content draft isn't ready to publish: ${reason}`);
    this.name = "ContentNotReadyError";
  }
}

export type ApproveContentResult = { batchId: number; prUrl: string; prNumber: number };

/**
 * Publish step (separate from drafting, per spec): commit the post into
 * client/src/data/blogPosts.ts on a pr-content-YYYYMMDD branch and open a
 * PR. Reuses seoApprovalBatches — laneForBatch() in bulkApprove.ts reads the
 * "pr-content-" prefix, so veto/revert/refresh-status/warm-up all apply
 * uniformly. Never merges (same hard rule as the meta lane).
 */
export async function approveContentToPR(topicId: number, actorId: number | null, label?: string): Promise<ApproveContentResult> {
  if (!isGithubConfigured()) throw new GithubNotConfiguredError();
  const draft = await findLatestContentDraft(topicId);
  if (!draft) throw new ContentNotReadyError("no draft has been generated for this topic yet.");
  if (!draft.passes) throw new ContentNotReadyError("it has unresolved lint or critic findings.");

  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");

  // One PR per topic (pr-content-YYYYMMDD-t<topicId>), never appended to another topic's PR.
  const branch = await uniqueBranchFor(`pr-content-${yyyymmdd()}-t${topicId}`);
  await ensureBranch(branch);
  const { content: currentSource, sha } = await getFileContent(BLOG_POSTS_PATH, branch);
  const updatedSource = insertBlogPostIntoSource(currentSource, draft.post);
  const commitMessage = `content(blog): ${draft.post.title}\n\nTopic queue #${topicId}. Drafted by the weekly autopublish content pipeline.`;
  const commitSha = await putFileContent(BLOG_POSTS_PATH, branch, updatedSource, commitMessage, sha);

  const prBody = [
    `## New B2B post: ${draft.post.title}`,
    "",
    `**Slug:** \`${draft.post.slug}\`  **Category:** ${draft.post.category}`,
    "",
    `> ${draft.post.excerpt}`,
    "",
    "### Before merging",
    "- [ ] Reads naturally and matches the intended audience",
    "- [ ] No claims-linter or critic findings were overridden",
    "- [ ] Ready to go live",
  ].join("\n");
  const pr = await openOrGetPR(branch, `SEO content batch — ${yyyymmdd()}`, prBody);

  const inserted = await db.insert(seoApprovalBatches).values({
    label: label ?? draft.post.title,
    pages: [`/blog/${draft.post.slug}`],
    diff: [{ pagePath: `/blog/${draft.post.slug}`, pageId: topicId, before: { title: null, description: null }, after: { title: draft.post.title, description: draft.post.metaDescription }, hasBodyChanges: true, lint: draft.metaLint }],
    actorId,
    branch,
    commitSha,
    prUrl: pr.url,
    prNumber: pr.number,
    status: "pr_open",
  });
  const batchId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);

  await updateQueueStatus(topicId, "pr_open", batchId);
  await logAudit({ actorId, action: "approved_to_pr", batchId, pagePath: `/blog/${draft.post.slug}`, before: null, after: { prUrl: pr.url, prNumber: pr.number }, lintResult: null });
  await logAudit({ actorId, action: "pr_opened", batchId, pagePath: null, before: null, after: { prUrl: pr.url, prNumber: pr.number }, lintResult: null });

  return { batchId, prUrl: pr.url, prNumber: pr.number };
}

/**
 * Approve-to-PR wrapper (content lane, mirrors bulkApprove.ts's
 * approveMetaBatchWithAutopublish) that additionally arms the autopublish
 * hold when the content lane is warmed up. Used by the router's human-
 * triggered "Approve to PR" button. Lives here (not autoMerge.ts) because
 * autoMerge.ts already depends on this file's armHold-adjacent needs would
 * otherwise create a circular import — see autoMerge.ts's comment on the
 * same topic.
 */
export async function approveContentToPRWithAutopublish(topicId: number, actorId: number | null): Promise<ApproveContentResult> {
  const result = await approveContentToPR(topicId, actorId);
  if (await isWarmedUp("content")) await armHold(result.batchId);
  return result;
}

/**
 * The weekly content schedule as a standard 5-field cron string (minute hour
 * day-of-month month day-of-week — see shared/cronTiming.ts's
 * parseCronToSchedule for the supported subset). Lets the cadence change
 * without a code change. Defaults to Wednesdays 06:00 America/New_York
 * (spec Part 2) when unset or invalid.
 */
function contentSchedule(): ScheduleSpec {
  const raw = process.env.SEO_CONTENT_SCHEDULE?.trim();
  if (!raw) return DEFAULT_CONTENT_SCHEDULE;
  try {
    return parseCronToSchedule(raw, DEFAULT_CONTENT_SCHEDULE.timeZone);
  } catch (err) {
    console.error(`[SEO] SEO_CONTENT_SCHEDULE is invalid, falling back to the default (Wed 06:00 ET): ${(err as Error).message}`);
    return DEFAULT_CONTENT_SCHEDULE;
  }
}

/** In-process scheduler — Wednesday 06:00 America/New_York by default (spec Part 2), overridable via SEO_CONTENT_SCHEDULE, gated behind SEO_CONTENT_PIPELINE_ENABLED (default off). */
export function startWeeklyContentScheduler(): void {
  if (process.env.SEO_CONTENT_PIPELINE_ENABLED !== "true") {
    console.log("[SEO] Weekly content pipeline disabled (set SEO_CONTENT_PIPELINE_ENABLED=true to enable)");
    return;
  }
  const arm = () => {
    const delay = msUntilNextRun(contentSchedule());
    setTimeout(() => {
      runWeeklyContentJob()
        .then((outcome) => console.log(`[SEO] weekly content job: ${outcome.status}${outcome.status === "drafted" && outcome.autoApproved ? `, auto-approved to batch #${outcome.batchId}` : ""}`))
        .catch((err) => console.error("[SEO] weekly content job error:", err))
        .finally(arm);
    }, delay);
  };
  console.log(`[SEO] Weekly content pipeline scheduled — ${process.env.SEO_CONTENT_SCHEDULE?.trim() || "Wednesdays 06:00 America/New_York (default)"}`);
  arm();
}
