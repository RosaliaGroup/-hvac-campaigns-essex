/**
 * Social Publisher — the single writer of `socialPosts` rows for the publish
 * path. Centralises the reliability guarantees the marketing team needs:
 *
 *  - Idempotency: an external platform post maps 1:1 to a socialPosts row.
 *    Publishing content that is already "posted" returns the existing record
 *    instead of creating a second external post or a second DB row.
 *  - Failure persistence: a platform error marks the row status="failed" with
 *    a safe (bounded, single-line) error message — nothing is silently lost.
 *  - Retry: retrying operates on the SAME row, so it can never create a
 *    duplicate record or a duplicate external post.
 *  - Approval gate: a post cannot be published unless it is approved (an
 *    explicit publish action, or an already-scheduled row). Failed retries
 *    inherit the original approval.
 *  - Non-API channels (Nextdoor): queued for manual posting — never marked
 *    "posted" and never sent to a non-existent API.
 *
 * No schema change is required: the idempotency unit is the existing
 * socialPosts primary key, and the external id is stored in the existing
 * `postId` column.
 */

import * as dbModule from "../db";
import { postToFacebook, postToInstagram } from "../integrations/facebook";
import { postToGoogleBusiness } from "../integrations/google-business";

export type Platform = "facebook" | "instagram" | "google_business" | "nextdoor";

/** Channels we can actually publish to via an API. Nextdoor has no public posting API. */
export const API_PUBLISHABLE_PLATFORMS: readonly Platform[] = [
  "facebook",
  "instagram",
  "google_business",
] as const;

export function isApiPublishable(platform: Platform): boolean {
  return API_PUBLISHABLE_PLATFORMS.includes(platform);
}

/** Error with a machine-readable code so the router can map it to a clean response. */
export class PublishError extends Error {
  code: "NOT_APPROVED" | "PUBLISH_FAILED" | "NOT_RETRYABLE" | "NOT_FOUND";
  postId: number | null;
  constructor(
    code: PublishError["code"],
    message: string,
    postId: number | null = null,
  ) {
    super(message);
    this.name = "PublishError";
    this.code = code;
    this.postId = postId;
  }
}

/**
 * Reduce any thrown value to a bounded, single-line string safe to persist in
 * `socialPosts.errorMessage` (varchar/text) and show to a user. Never throws.
 */
export function safeErrorMessage(err: unknown, max = 480): string {
  let msg: string;
  if (err == null) {
    msg = "Unknown error";
  } else if (err instanceof Error) {
    msg = err.message || err.name || "Unknown error";
  } else if (typeof err === "string") {
    msg = err;
  } else {
    try {
      // JSON.stringify(undefined) returns undefined, not a string.
      msg = JSON.stringify(err) ?? String(err);
    } catch {
      msg = String(err);
    }
  }
  msg = (msg ?? "").replace(/\s+/g, " ").trim();
  if (!msg) msg = "Unknown error";
  return msg.length > max ? `${msg.slice(0, max - 1)}…` : msg;
}

/** Minimal view of a socialPosts row the publisher needs. */
export interface SocialPostRow {
  id: number;
  platform: string;
  content: string;
  status: string;
  postId: string | null;
  mediaUrls: string | null;
}

/** Injectable dependencies — real implementations by default, fakes in tests. */
export interface PublisherDeps {
  getById(id: number): Promise<SocialPostRow | null>;
  findReusable(platform: string, content: string): Promise<SocialPostRow | null>;
  create(row: {
    platform: string;
    content: string;
    contentType: string | null;
    mediaUrls: string | null;
    status: string;
  }): Promise<number>;
  update(id: number, patch: Record<string, unknown>): Promise<void>;
  /** Publish to the platform's API and return the external post id. */
  publishToPlatform(platform: Platform, content: string, mediaUrls?: string[]): Promise<string>;
}

function toRow(r: {
  id: number;
  platform: string;
  content: string;
  status: string;
  postId: string | null;
  mediaUrls: string | null;
}): SocialPostRow {
  return {
    id: r.id,
    platform: r.platform,
    content: r.content,
    status: r.status,
    postId: r.postId ?? null,
    mediaUrls: r.mediaUrls ?? null,
  };
}

/** Resolve stored credentials and dispatch to the correct platform integration. */
async function defaultPublishToPlatform(
  platform: Platform,
  content: string,
  mediaUrls?: string[],
): Promise<string> {
  // Instagram credentials are stored under the "facebook" service (shared Meta token).
  const service = platform === "instagram" ? "facebook" : platform;
  const cred = await dbModule.getAiVaCredentials(service);
  if (!cred || !cred.accessToken) {
    throw new Error(`No credentials saved for ${platform}. Please configure in AI VA Settings.`);
  }

  if (platform === "google_business") {
    return await postToGoogleBusiness(
      { accessToken: cred.accessToken, accountId: cred.accountId, locationId: cred.locationId },
      content,
      mediaUrls,
    );
  }
  if (platform === "facebook") {
    return await postToFacebook(
      { accessToken: cred.accessToken, pageId: cred.pageId, instagramAccountId: cred.instagramAccountId },
      content,
      mediaUrls?.[0],
    );
  }
  if (platform === "instagram") {
    if (!mediaUrls?.[0]) throw new Error("Instagram posts require an image URL");
    return await postToInstagram(
      { accessToken: cred.accessToken, pageId: cred.pageId, instagramAccountId: cred.instagramAccountId },
      content,
      mediaUrls[0],
    );
  }
  throw new Error(`Platform ${platform} is not API-publishable`);
}

export function defaultDeps(): PublisherDeps {
  return {
    getById: async (id) => {
      const r = await dbModule.getSocialPostById(id);
      return r ? toRow(r as any) : null;
    },
    findReusable: async (platform, content) => {
      const r = await dbModule.findReusableSocialPost(platform, content);
      return r ? toRow(r as any) : null;
    },
    create: async (row) =>
      await dbModule.createSocialPostReturningId({
        platform: row.platform,
        content: row.content,
        contentType: row.contentType,
        mediaUrls: row.mediaUrls,
        status: row.status as any,
      }),
    update: async (id, patch) => {
      await dbModule.updateSocialPost(id, patch as any);
    },
    publishToPlatform: defaultPublishToPlatform,
  };
}

export interface PublishParams {
  /** Existing socialPosts row to reuse. When omitted we reuse a matching row or create one. */
  id?: number;
  platform: Platform;
  content: string;
  contentType?: string;
  mediaUrls?: string[];
  /** Explicit approval to publish (e.g. a human clicked "Publish"). */
  approved?: boolean;
  /** Set false only for internal callers that already enforced approval. Default true. */
  requireApproval?: boolean;
}

export interface PublishResult {
  id: number;
  platform: Platform;
  status: "posted" | "queued" | "failed";
  postId: string | null;
  /** True when the post was already published and we short-circuited (idempotent). */
  alreadyPosted: boolean;
  /** True for non-API channels queued for manual posting. */
  queued: boolean;
}

/**
 * Publish (or reuse) a social post idempotently.
 *
 * @throws PublishError("NOT_APPROVED") if approval is required and absent.
 * @throws PublishError("PUBLISH_FAILED") after persisting status="failed".
 */
export async function publishSocialPost(
  params: PublishParams,
  deps: PublisherDeps = defaultDeps(),
): Promise<PublishResult> {
  const { platform, content } = params;
  const requireApproval = params.requireApproval !== false;

  // 1. Resolve or reuse the row (reuse an existing record when possible).
  let row: SocialPostRow | null = null;
  if (params.id != null) {
    row = await deps.getById(params.id);
    if (!row) throw new PublishError("NOT_FOUND", `Social post ${params.id} not found`, params.id);
  } else {
    row = await deps.findReusable(platform, content);
  }

  // 2. Idempotency: already posted → return the existing record. No second
  //    external post, no second DB row.
  if (row && row.status === "posted" && row.postId) {
    return {
      id: row.id,
      platform,
      status: "posted",
      postId: row.postId,
      alreadyPosted: true,
      queued: false,
    };
  }

  // 3. Approval gate. Approved = explicit approval, or an already-scheduled row.
  const approved = params.approved === true || row?.status === "scheduled";
  if (requireApproval && !approved) {
    throw new PublishError(
      "NOT_APPROVED",
      `Post ${row?.id ?? "(new)"} is not approved for publishing`,
      row?.id ?? null,
    );
  }

  // Ensure exactly one row backs this publish attempt.
  const id = row
    ? row.id
    : await deps.create({
        platform,
        content,
        contentType: params.contentType ?? null,
        mediaUrls: params.mediaUrls ? JSON.stringify(params.mediaUrls) : null,
        status: "draft",
      });

  // 4. Non-API channels (Nextdoor): queue for manual posting. Never "posted".
  if (!isApiPublishable(platform)) {
    await deps.update(id, { status: "scheduled", errorMessage: null });
    return { id, platform, status: "queued", postId: null, alreadyPosted: false, queued: true };
  }

  // 5. Publish with failure persistence.
  try {
    const postId = await deps.publishToPlatform(platform, content, params.mediaUrls);
    await deps.update(id, {
      status: "posted",
      postId,
      postedAt: new Date(),
      errorMessage: null,
    });
    return { id, platform, status: "posted", postId, alreadyPosted: false, queued: false };
  } catch (err) {
    const msg = safeErrorMessage(err);
    await deps.update(id, { status: "failed", errorMessage: msg });
    throw new PublishError("PUBLISH_FAILED", msg, id);
  }
}

/**
 * Retry a failed post on its SAME row — cannot create a duplicate record or a
 * duplicate external post. Idempotent if the post already succeeded.
 */
export async function retrySocialPost(
  id: number,
  deps: PublisherDeps = defaultDeps(),
): Promise<PublishResult> {
  const row = await deps.getById(id);
  if (!row) throw new PublishError("NOT_FOUND", `Social post ${id} not found`, id);

  // Already posted → idempotent no-op.
  if (row.status === "posted" && row.postId) {
    return {
      id,
      platform: row.platform as Platform,
      status: "posted",
      postId: row.postId,
      alreadyPosted: true,
      queued: false,
    };
  }

  if (row.status !== "failed") {
    throw new PublishError(
      "NOT_RETRYABLE",
      `Post ${id} has status "${row.status}"; only failed posts can be retried`,
      id,
    );
  }

  // A failed post already cleared the approval gate on its first attempt, so
  // the retry inherits that approval.
  let mediaUrls: string[] | undefined;
  if (row.mediaUrls) {
    try {
      const parsed = JSON.parse(row.mediaUrls);
      if (Array.isArray(parsed)) mediaUrls = parsed.map(String);
    } catch {
      mediaUrls = undefined;
    }
  }

  return await publishSocialPost(
    {
      id,
      platform: row.platform as Platform,
      content: row.content,
      mediaUrls,
      approved: true,
    },
    deps,
  );
}
