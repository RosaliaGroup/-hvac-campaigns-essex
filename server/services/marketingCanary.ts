/**
 * Marketing Publishing Canary — an ADMIN-ONLY, opt-in tool to exercise the
 * live social-publishing path against ONE company-owned connected destination,
 * using fixed, clearly-labeled test content only.
 *
 * Safety properties:
 *  - Content is ALWAYS the fixed canary string; callers cannot substitute real
 *    campaign content. There is no user-supplied payload seam.
 *  - Canary rows are tagged via the existing `contentType` column
 *    ("canary" / "canary_fail") and carry audit metadata in the existing
 *    `engagement` JSON column — NO schema migration.
 *  - Idempotency/failure/retry reuse the same socialPosts row as the real
 *    publisher, so a canary can never create duplicate external posts or rows.
 *  - The failure seam forces the platform call to throw WITHOUT hitting any
 *    external API (no post is created on the failing attempt). It is only
 *    reachable through the admin canary endpoint, only for canary-tagged rows,
 *    and is audited — it is not a general-purpose backdoor.
 *  - Credential status is reported as booleans + a masked reference only.
 *    Tokens are never returned or logged.
 */

import * as dbModule from "../db";
import {
  publishSocialPost,
  retrySocialPost,
  defaultDeps as defaultPublisherDeps,
  type PublisherDeps,
  type Platform,
} from "./socialPublisher";
import { postToFacebook, postToInstagram, deleteFacebookPost } from "../integrations/facebook";
import { postToGoogleBusiness, deleteGoogleBusinessPost } from "../integrations/google-business";
import {
  parseGeneratedContent,
  buildSystemPrompt,
  generateSocialPost,
} from "../integrations/ai-content-generator";

/** The ONLY content a canary may publish. Never editable into real content. */
export const CANARY_CONTENT = "Mechanical Enterprise publishing test — safe to delete";
export const CANARY_TYPE_SUCCESS = "canary";
export const CANARY_TYPE_FAILURE = "canary_fail";

/** Platforms the canary can publish to via API. Nextdoor is queued-only. */
export const CANARY_PLATFORMS = ["facebook", "instagram", "google_business"] as const;
export type CanaryPlatform = (typeof CANARY_PLATFORMS)[number];

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Business",
  google_business: "Google Business Profile",
  nextdoor: "Nextdoor",
};

export class CanaryError extends Error {
  code: "NO_DESTINATION" | "NOT_CONFIRMED" | "NOT_CANARY" | "NOT_FOUND";
  constructor(code: CanaryError["code"], message: string) {
    super(message);
    this.name = "CanaryError";
    this.code = code;
  }
}

export interface DestinationStatus {
  platform: string;
  label: string;
  connected: boolean;
  credentialsAvailable: boolean;
  destinationName: string | null;
  /** Masked, non-secret reference (e.g. "…4321") — never a token. */
  destinationRef: string | null;
  health: "connected" | "missing";
}

export interface CanaryRowView {
  id: number;
  platform: string;
  contentType: string | null;
  status: string;
  postId: string | null;
  createdAt: unknown;
  postedAt: unknown;
  errorMessage: string | null;
  meta: CanaryMeta | null;
}

interface CanaryMeta {
  canary: true;
  kind: "success" | "failure";
  createdBy: number | null;
  externalUrl?: string | null;
  state?: "active" | "canary_completed";
}

/** Mask a public-but-noisy id to its last 4 chars. Never used on secrets. */
function mask(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = String(v);
  return s.length <= 4 ? `…${s}` : `…${s.slice(-4)}`;
}

function externalUrl(platform: string, postId: string | null): string | null {
  if (!postId) return null;
  if (platform === "facebook") return `https://www.facebook.com/${postId}`;
  // Instagram media ids and Google Business resource names have no stable public URL.
  return null;
}

function safeParseMeta(engagement: string | null | undefined): CanaryMeta | null {
  if (!engagement) return null;
  try {
    const m = JSON.parse(engagement);
    return m && m.canary === true ? (m as CanaryMeta) : null;
  } catch {
    return null;
  }
}

// ─── Injectable dependencies (real by default, fakes in tests) ───────────────

export interface CanaryDeps {
  publisherDeps: PublisherDeps;
  publish: typeof publishSocialPost;
  retry: typeof retrySocialPost;
  credentialStatus(platform: CanaryPlatform): Promise<DestinationStatus>;
  findCanaryRow(platform: string, contentType: string): Promise<{ id: number; status: string } | null>;
  createRow(row: { platform: string; contentType: string; engagement: string }): Promise<number>;
  getRow(id: number): Promise<{
    id: number; platform: string; contentType: string | null; status: string;
    postId: string | null; engagement: string | null; errorMessage: string | null;
  } | null>;
  updateRow(id: number, patch: Record<string, unknown>): Promise<void>;
  listCanary(): Promise<CanaryRowView[]>;
  deleteExternalPost(platform: string, postId: string): Promise<{ supported: boolean; deleted: boolean; detail?: string }>;
}

/**
 * Build a destination status from raw credentials WITHOUT ever surfacing a
 * token. Only booleans + a masked (last-4) reference of a public id are
 * returned. Pure + exported so the no-leak guarantee is directly testable.
 */
export function buildDestinationStatus(
  platform: CanaryPlatform,
  cred: Record<string, string> | null | undefined,
): DestinationStatus {
  const has = (k: string) => Boolean(cred && cred[k]);
  let connected = false;
  let ref: string | null = null;
  if (platform === "facebook") {
    connected = has("accessToken") && has("pageId");
    ref = mask(cred?.pageId);
  } else if (platform === "instagram") {
    connected = has("accessToken") && has("instagramAccountId");
    ref = mask(cred?.instagramAccountId);
  } else {
    connected = has("accessToken") && has("accountId") && has("locationId");
    ref = mask(cred?.locationId);
  }
  return {
    platform,
    label: PLATFORM_LABELS[platform] ?? platform,
    connected,
    credentialsAvailable: has("accessToken"),
    destinationName: connected ? (PLATFORM_LABELS[platform] ?? platform) : null,
    destinationRef: connected ? ref : null,
    health: connected ? "connected" : "missing",
  };
}

async function realCredentialStatus(platform: CanaryPlatform): Promise<DestinationStatus> {
  const service = platform === "instagram" ? "facebook" : platform;
  const cred = (await dbModule.getAiVaCredentials(service)) as Record<string, string>;
  return buildDestinationStatus(platform, cred);
}

async function realDeleteExternalPost(platform: string, postId: string) {
  const service = platform === "instagram" ? "facebook" : platform;
  const cred = (await dbModule.getAiVaCredentials(service)) as Record<string, string>;
  if (platform === "facebook") {
    await deleteFacebookPost({ accessToken: cred.accessToken, pageId: cred.pageId }, postId);
    return { supported: true, deleted: true };
  }
  if (platform === "google_business") {
    await deleteGoogleBusinessPost(
      { accessToken: cred.accessToken, accountId: cred.accountId, locationId: cred.locationId },
      postId,
    );
    return { supported: true, deleted: true };
  }
  // Instagram has no reliable content-delete API.
  return { supported: false, deleted: false, detail: `Delete not supported for ${platform}; remove manually.` };
}

export function defaultCanaryDeps(): CanaryDeps {
  return {
    publisherDeps: defaultPublisherDeps(),
    publish: publishSocialPost,
    retry: retrySocialPost,
    credentialStatus: realCredentialStatus,
    findCanaryRow: async (platform, contentType) => {
      const r = await dbModule.findSocialPostByPlatformAndType(platform, contentType);
      return r ? { id: (r as any).id, status: (r as any).status } : null;
    },
    createRow: async (row) =>
      await dbModule.createSocialPostReturningId({
        platform: row.platform,
        content: CANARY_CONTENT,
        contentType: row.contentType as any,
        engagement: row.engagement,
        status: "draft" as any,
      }),
    getRow: async (id) => {
      const r = await dbModule.getSocialPostById(id);
      return r
        ? {
            id: (r as any).id,
            platform: (r as any).platform,
            contentType: (r as any).contentType ?? null,
            status: (r as any).status,
            postId: (r as any).postId ?? null,
            engagement: (r as any).engagement ?? null,
            errorMessage: (r as any).errorMessage ?? null,
          }
        : null;
    },
    updateRow: async (id, patch) => {
      await dbModule.updateSocialPost(id, patch as any);
    },
    listCanary: async () => {
      const rows = await dbModule.listCanarySocialPosts();
      return (rows as any[]).map((r) => ({
        id: r.id,
        platform: r.platform,
        contentType: r.contentType ?? null,
        status: r.status,
        postId: r.postId ?? null,
        createdAt: r.createdAt,
        postedAt: r.postedAt,
        errorMessage: r.errorMessage ?? null,
        meta: safeParseMeta(r.engagement),
      }));
    },
    deleteExternalPost: realDeleteExternalPost,
  };
}

/** Force the platform call to throw WITHOUT touching any external API. */
function failingPublisherDeps(base: PublisherDeps): PublisherDeps {
  return {
    ...base,
    publishToPlatform: async () => {
      throw new Error("Canary forced failure (test-only, no external API call was made)");
    },
  };
}

export function isCanaryType(contentType: string | null | undefined): boolean {
  return typeof contentType === "string" && contentType.startsWith("canary");
}

// ─── Public operations ───────────────────────────────────────────────────────

export async function getStatus(deps: CanaryDeps = defaultCanaryDeps()) {
  const platforms = await Promise.all(CANARY_PLATFORMS.map((p) => deps.credentialStatus(p)));
  const rows = await deps.listCanary();
  const active = rows.find((r) => r.status === "posted" || r.status === "scheduled") ?? null;
  return {
    platforms,
    nextdoorNote: "Nextdoor has no publish API — canary posts are queued/manual only, never marked posted.",
    activeCanary: active
      ? { id: active.id, platform: active.platform, status: active.status, contentType: active.contentType }
      : null,
    latestResult: rows[0] ?? null,
    canaryContent: CANARY_CONTENT,
  };
}

export interface SuccessCanaryResult {
  platform: string;
  rowId: number;
  externalId: string | null;
  externalUrl: string | null;
  firstStatus: string;
  secondAlreadyPosted: boolean;
  duplicatePrevented: boolean;
}

export async function runSuccessCanary(
  platform: CanaryPlatform,
  userId: number | null,
  confirmed: boolean,
  deps: CanaryDeps = defaultCanaryDeps(),
): Promise<SuccessCanaryResult> {
  if (confirmed !== true) throw new CanaryError("NOT_CONFIRMED", "Explicit confirmation is required.");
  const st = await deps.credentialStatus(platform);
  if (!st.connected) {
    throw new CanaryError("NO_DESTINATION", "No safe connected destination is available. Canary cannot run.");
  }

  // Reuse the dedicated canary row for this platform (or create one).
  const existing = await deps.findCanaryRow(platform, CANARY_TYPE_SUCCESS);
  const id =
    existing?.id ??
    (await deps.createRow({
      platform,
      contentType: CANARY_TYPE_SUCCESS,
      engagement: JSON.stringify({ canary: true, kind: "success", createdBy: userId, state: "active" } as CanaryMeta),
    }));

  // Publish once (always by id → never falls back to content-based reuse).
  const first = await deps.publish(
    { id, platform: platform as Platform, content: CANARY_CONTENT, approved: true },
    deps.publisherDeps,
  );
  const url = externalUrl(platform, first.postId);
  await deps.updateRow(id, {
    engagement: JSON.stringify({ canary: true, kind: "success", createdBy: userId, externalUrl: url, state: "active" } as CanaryMeta),
  });

  // Submit the identical request again → must be idempotent.
  const second = await deps.publish(
    { id, platform: platform as Platform, content: CANARY_CONTENT, approved: true },
    deps.publisherDeps,
  );

  return {
    platform,
    rowId: id,
    externalId: first.postId,
    externalUrl: url,
    firstStatus: first.status,
    secondAlreadyPosted: second.alreadyPosted,
    duplicatePrevented: second.alreadyPosted && second.postId === first.postId && second.id === id,
  };
}

export interface FailureCanaryResult {
  platform: string;
  rowId: number;
  failedStatus: string;
  failedError: string | null;
  retryStatus: string;
  externalId: string | null;
  sameRow: boolean;
  duplicatePrevented: boolean;
  alreadyPosted: boolean;
}

export async function runFailureRetryCanary(
  platform: CanaryPlatform,
  userId: number | null,
  confirmed: boolean,
  deps: CanaryDeps = defaultCanaryDeps(),
): Promise<FailureCanaryResult> {
  if (confirmed !== true) throw new CanaryError("NOT_CONFIRMED", "Explicit confirmation is required.");
  const st = await deps.credentialStatus(platform);
  if (!st.connected) {
    throw new CanaryError("NO_DESTINATION", "No safe connected destination is available. Canary cannot run.");
  }

  const existing = await deps.findCanaryRow(platform, CANARY_TYPE_FAILURE);
  const id =
    existing?.id ??
    (await deps.createRow({
      platform,
      contentType: CANARY_TYPE_FAILURE,
      engagement: JSON.stringify({ canary: true, kind: "failure", createdBy: userId, state: "active" } as CanaryMeta),
    }));

  // If a prior run already succeeded, treat as idempotent (don't re-fail).
  const before = await deps.getRow(id);
  if (before?.status === "posted" && before.postId) {
    return {
      platform, rowId: id, failedStatus: "posted", failedError: null,
      retryStatus: "posted", externalId: before.postId, sameRow: true,
      duplicatePrevented: true, alreadyPosted: true,
    };
  }

  // 1) Forced failure (no external API call) → row must become "failed".
  try {
    await deps.publish(
      { id, platform: platform as Platform, content: CANARY_CONTENT, approved: true },
      failingPublisherDeps(deps.publisherDeps),
    );
  } catch {
    /* expected PublishError; state persisted below */
  }
  const afterFail = await deps.getRow(id);

  // 2) Retry the SAME row under valid conditions → posts once, reuses the row.
  const retried = await deps.retry(id, deps.publisherDeps);
  await deps.updateRow(id, {
    engagement: JSON.stringify({
      canary: true, kind: "failure", createdBy: userId,
      externalUrl: externalUrl(platform, retried.postId), state: "active",
    } as CanaryMeta),
  });

  return {
    platform,
    rowId: id,
    failedStatus: afterFail?.status ?? "unknown",
    failedError: afterFail?.errorMessage ?? null,
    retryStatus: retried.status,
    externalId: retried.postId,
    sameRow: retried.id === id,
    duplicatePrevented: retried.id === id,
    alreadyPosted: false,
  };
}

export async function getAudit(deps: CanaryDeps = defaultCanaryDeps()): Promise<CanaryRowView[]> {
  return await deps.listCanary();
}

export async function deleteCanaryExternal(id: number, deps: CanaryDeps = defaultCanaryDeps()) {
  const row = await deps.getRow(id);
  if (!row) throw new CanaryError("NOT_FOUND", `Canary post ${id} not found`);
  if (!isCanaryType(row.contentType)) {
    throw new CanaryError("NOT_CANARY", `Post ${id} is not a canary row; refusing to delete.`);
  }

  let result: { supported: boolean; deleted: boolean; detail?: string } = { supported: false, deleted: false };
  if (row.postId && row.status === "posted") {
    result = await deps.deleteExternalPost(row.platform, row.postId);
  }

  // Preserve the DB row as audit evidence, marked completed (existing fields only).
  const meta = safeParseMeta(row.engagement) ?? { canary: true as const, kind: "success" as const, createdBy: null };
  meta.state = "canary_completed";
  await deps.updateRow(id, { engagement: JSON.stringify(meta) });

  return { id, ...result, state: "canary_completed" };
}

// ─── Deterministic internal safety checks (NO external publishing) ───────────

export interface SafetyCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/** In-memory publisher deps for the deterministic checks. */
function memoryPublisherDeps() {
  const rows: any[] = [];
  let seq = 0;
  return {
    getById: async (id: number) => rows.find((r) => r.id === id) ?? null,
    findReusable: async () => null,
    create: async (row: any) => {
      const id = ++seq;
      rows.push({ id, ...row, postId: null });
      return id;
    },
    update: async (id: number, patch: any) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
    publishToPlatform: async (p: string) => `mem_${p}`,
  } as PublisherDeps;
}

export async function runSafetyChecks(): Promise<SafetyCheck[]> {
  const checks: SafetyCheck[] = [];

  // 1) Unapproved post cannot publish.
  try {
    await publishSocialPost(
      { platform: "facebook", content: "x", approved: false },
      memoryPublisherDeps(),
    );
    checks.push({ name: "unapproved_blocked", passed: false, detail: "Unapproved post was published (should be blocked)" });
  } catch (e: any) {
    checks.push({ name: "unapproved_blocked", passed: e?.code === "NOT_APPROVED", detail: e?.code ?? String(e) });
  }

  // 2) Retry requires a failed (approved) row — a draft/unapproved row is not retryable.
  try {
    const deps = memoryPublisherDeps();
    const id = await deps.create({ platform: "facebook", content: "x", contentType: null, mediaUrls: null, status: "draft" } as any);
    await retrySocialPost(id, deps);
    checks.push({ name: "retry_requires_approval", passed: false, detail: "Draft row was retried (should be blocked)" });
  } catch (e: any) {
    checks.push({ name: "retry_requires_approval", passed: e?.code === "NOT_RETRYABLE", detail: e?.code ?? String(e) });
  }

  // 3) Nextdoor is queued/manual only, never posted.
  try {
    const r = await publishSocialPost(
      { platform: "nextdoor", content: CANARY_CONTENT, approved: true },
      memoryPublisherDeps(),
    );
    checks.push({
      name: "nextdoor_queued_only",
      passed: r.status === "queued" && r.status !== ("posted" as string),
      detail: `status=${r.status}`,
    });
  } catch (e: any) {
    checks.push({ name: "nextdoor_queued_only", passed: false, detail: String(e) });
  }

  // 4) Malformed AI JSON returns the safe unverified fallback.
  const parsed = parseGeneratedContent("<<not json>>");
  checks.push({
    name: "malformed_ai_json_safe",
    passed: parsed.unverified === true && parsed.parseError === true,
    detail: `unverified=${parsed.unverified}`,
  });

  // 5) Testimonial generation does not instruct invention (deterministic prompt check).
  const captured: any[] = [];
  const fakeInvoke = (async (args: any) => {
    captured.push(args);
    return { choices: [{ message: { content: JSON.stringify({ content: "c", hashtags: [], callToAction: "cta", imagePrompt: "i" }) } }] } as any;
  }) as any;
  await generateSocialPost("customer_testimonial", "facebook", { invoke: fakeInvoke });
  const sys = buildSystemPrompt("facebook");
  const userMsg = String(captured[0]?.messages?.find((m: any) => m.role === "user")?.content ?? "");
  checks.push({
    name: "testimonial_no_invention",
    passed: /NEVER invent/i.test(sys) && /do NOT fabricate/i.test(userMsg) && !/fictional/i.test(userMsg),
    detail: "system forbids invention; testimonial prompt forbids fabrication",
  });

  return checks;
}
