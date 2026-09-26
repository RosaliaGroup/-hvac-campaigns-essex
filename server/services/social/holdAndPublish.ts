/**
 * Hold → veto → publish → revert (docs/social-lane-spec.md §1/§7).
 *
 * `scheduleForHold` is the ONLY entry point that creates a new socialPosts
 * row from generated content — it runs the linter (blocks) and duplicate
 * check (regenerate signal, left to the caller) BEFORE ever writing a row, so
 * a post that fails either guardrail never even reaches `held` state, let
 * alone `publishSocialPost`.
 *
 * `processDueHolds` is the cron-style sweep: for every `held` row whose
 * `holdUntil` has passed with no veto, it calls
 * `publishSocialPost({ id, approved: true }, ...)` — the EXISTING publisher
 * in server/services/socialPublisher.ts — exactly once. socialPublisher.ts
 * itself is untouched; this only decides WHEN to call it.
 *
 * `vetoPost` / `revertPost` are the two negative-path actions, both driven by
 * the signed single-use links from server/services/seo/actionLinks.ts's
 * Social Lane extension.
 */
import {
  publishSocialPost,
  defaultDeps,
  type PublisherDeps,
  type Platform as PublishablePlatform,
} from "../socialPublisher";
import { lintSocialContent } from "./linter";
import { signSocialActionLink, verifySocialActionLink } from "../seo/actionLinks";
import type { SocialPlatformClient, SocialPlatform } from "./platformClient";

export function getSocialHoldHours(): number {
  const raw = process.env.SOCIAL_HOLD_HOURS;
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 12;
}

/** Minimal shape of a socialPosts row this module needs (superset of PublisherDeps' SocialPostRow). */
export interface HoldablePostRow {
  id: number;
  platform: string;
  content: string;
  status: string;
  postId: string | null;
  mediaUrls: string | null;
  holdUntil: Date | null;
}

export interface HoldRepoDeps {
  create(row: { platform: string; content: string; contentType: string | null; mediaUrls: string | null; contentSource: string | null; utmCampaign: string | null }): Promise<number>;
  getById(id: number): Promise<HoldablePostRow | null>;
  setHeld(id: number, holdUntil: Date): Promise<void>;
  setVetoed(id: number): Promise<void>;
  setReverted(id: number): Promise<void>;
  listDueHeld(now: Date): Promise<HoldablePostRow[]>;
}

export class GuardrailBlockedError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(`Content blocked by guardrails: ${reasons.join("; ")}`);
    this.name = "GuardrailBlockedError";
    this.reasons = reasons;
  }
}

/**
 * Create a new social post and put it into the hold window. Throws
 * GuardrailBlockedError (never writes a row) if the linter blocks the
 * content — callers should regenerate rather than catch-and-ignore.
 */
export async function scheduleForHold(
  params: { platform: string; content: string; contentType?: string; mediaUrls?: string[]; contentSource?: string; utmCampaign?: string },
  repo: HoldRepoDeps,
  now: Date = new Date(),
  holdHours: number = getSocialHoldHours(),
): Promise<{ id: number; holdUntil: Date }> {
  const lint = lintSocialContent(params.content);
  if (lint.blocked) throw new GuardrailBlockedError(lint.reasons);

  const id = await repo.create({
    platform: params.platform,
    content: params.content,
    contentType: params.contentType ?? null,
    mediaUrls: params.mediaUrls ? JSON.stringify(params.mediaUrls) : null,
    contentSource: params.contentSource ?? null,
    utmCampaign: params.utmCampaign ?? null,
  });
  const holdUntil = new Date(now.getTime() + holdHours * 60 * 60 * 1000);
  await repo.setHeld(id, holdUntil);
  return { id, holdUntil };
}

export interface ProcessedHold {
  id: number;
  outcome: "published" | "failed" | "skipped";
  detail?: string;
}

/** Sweep every due `held` row and publish it via the existing publisher, unless it's been vetoed. */
export async function processDueHolds(
  repo: HoldRepoDeps,
  publisherDeps: PublisherDeps = defaultDeps(),
  now: Date = new Date(),
): Promise<ProcessedHold[]> {
  const due = await repo.listDueHeld(now);
  const results: ProcessedHold[] = [];
  for (const row of due) {
    if (row.status !== "held") {
      results.push({ id: row.id, outcome: "skipped", detail: `status is "${row.status}", not held` });
      continue;
    }
    try {
      await publishSocialPost({ id: row.id, platform: row.platform as PublishablePlatform, content: row.content, approved: true }, publisherDeps);
      results.push({ id: row.id, outcome: "published" });
    } catch (err) {
      results.push({ id: row.id, outcome: "failed", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

/** Build the veto link for a held post's digest entry. */
export function buildVetoLink(baseUrl: string, postId: number): string {
  const token = signSocialActionLink(postId, "social_veto");
  return `${baseUrl}/api/social/veto?token=${encodeURIComponent(token)}`;
}

/** Build the revert ("Delete") link for a posted post's digest entry. */
export function buildRevertLink(baseUrl: string, postId: number): string {
  const token = signSocialActionLink(postId, "social_revert");
  return `${baseUrl}/api/social/revert?token=${encodeURIComponent(token)}`;
}

export class SocialActionAlreadyHandledError extends Error {
  constructor(status: string) {
    super(`This post is already "${status}" — the action was already handled or no longer applies.`);
    this.name = "SocialActionAlreadyHandledError";
  }
}

/** Veto a held post via a signed token. Idempotent: a non-"held" row is treated as already-handled, not an error retry target. */
export async function vetoPost(token: string, repo: HoldRepoDeps): Promise<{ id: number }> {
  const payload = verifySocialActionLink(token);
  if (payload.action !== "social_veto") throw new Error("Wrong link type for veto");
  const row = await repo.getById(payload.postId);
  if (!row) throw new Error(`Social post ${payload.postId} not found`);
  if (row.status !== "held") throw new SocialActionAlreadyHandledError(row.status);
  await repo.setVetoed(payload.postId);
  return { id: payload.postId };
}

/** Revert ("Delete") a posted post: delete on the platform, then mark the row reverted. */
export async function revertPost(token: string, repo: HoldRepoDeps, platformClient: SocialPlatformClient): Promise<{ id: number }> {
  const payload = verifySocialActionLink(token);
  if (payload.action !== "social_revert") throw new Error("Wrong link type for revert");
  const row = await repo.getById(payload.postId);
  if (!row) throw new Error(`Social post ${payload.postId} not found`);
  if (row.status !== "posted") throw new SocialActionAlreadyHandledError(row.status);
  if (!row.postId) throw new Error(`Social post ${payload.postId} has no external postId to revert`);

  await platformClient.deletePost(row.platform as SocialPlatform, row.postId);
  await repo.setReverted(payload.postId);
  return { id: payload.postId };
}
