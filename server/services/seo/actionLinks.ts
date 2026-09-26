/**
 * HMAC-signed, single-use action links for the autopublish hold-and-veto flow
 * (docs/seo-automation-addendum-autopublish.md §A2). Only the Veto link is
 * unauthenticated by design — Edit goes through normal CRM login with a
 * return path. This module is pure token crypto + consumption bookkeeping;
 * the actual veto business logic (closing the PR, resetting the warm-up
 * counter) lives in bulkApprove.ts's vetoBatch(), which calls consumeActionLink()
 * first.
 *
 * Token shape: `<base64url(JSON payload)>.<base64url(HMAC-SHA256 signature)>`.
 * Deliberately not a JWT library dependency — two fields, one algorithm, no
 * header/alg-confusion surface to worry about.
 *
 * Single-use: consumption is recorded as a `link_consumed` row in seoAuditLog
 * (keyed by the SHA-256 hash of the full token, scoped by batchId — see
 * isConsumed()). No separate table; the audit log is already the append-only,
 * queryable record this needs.
 */
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { seoAuditLog } from "../../../drizzle/schema";
import { logAudit } from "./auditLog";

export type ActionLinkAction = "veto";

export type ActionLinkPayload = {
  batchId: number;
  action: ActionLinkAction;
  /** Unix ms expiry. */
  exp: number;
};

export const ACTION_LINK_TTL_MS = 72 * 60 * 60 * 1000; // 72h, per spec

export class ActionLinkNotConfiguredError extends Error {
  constructor() {
    super("SEO_ACTION_LINK_SECRET is not set — veto/edit links cannot be created or verified.");
    this.name = "ActionLinkNotConfiguredError";
  }
}
export class InvalidActionLinkError extends Error {
  constructor() {
    super("This link is invalid or has been tampered with.");
    this.name = "InvalidActionLinkError";
  }
}
export class ExpiredActionLinkError extends Error {
  constructor() {
    super("This link has expired.");
    this.name = "ExpiredActionLinkError";
  }
}
export class ActionLinkAlreadyConsumedError extends Error {
  constructor() {
    super("This link has already been used.");
    this.name = "ActionLinkAlreadyConsumedError";
  }
}

export function isActionLinksConfigured(): boolean {
  return !!process.env.SEO_ACTION_LINK_SECRET;
}

function secret(): string {
  const s = process.env.SEO_ACTION_LINK_SECRET;
  if (!s) throw new ActionLinkNotConfiguredError();
  return s;
}

function hmacOf(payloadB64: string): string {
  return crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

/** Build a signed, single-use link payload string (the part after `?token=`). */
export function signActionLink(batchId: number, action: ActionLinkAction, ttlMs: number = ACTION_LINK_TTL_MS): string {
  const payload: ActionLinkPayload = { batchId, action, exp: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${payloadB64}.${hmacOf(payloadB64)}`;
}

/** Verify signature + shape + expiry. Does NOT check/record consumption. */
export function verifyActionLink(token: string): ActionLinkPayload {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new InvalidActionLinkError();
  const [payloadB64, sig] = parts;

  const expectedSig = hmacOf(payloadB64);
  const provided = Buffer.from(sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new InvalidActionLinkError();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    throw new InvalidActionLinkError();
  }
  const p = payload as Partial<ActionLinkPayload>;
  if (typeof p.batchId !== "number" || typeof p.exp !== "number" || p.action !== "veto") {
    throw new InvalidActionLinkError();
  }
  if (Date.now() > p.exp) throw new ExpiredActionLinkError();
  return { batchId: p.batchId, action: p.action, exp: p.exp };
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Has this exact token already been consumed? Scoped by batchId (indexed) for an efficient lookup. */
export async function isActionLinkConsumed(token: string, batchId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const hash = tokenHash(token);
  const rows = await db
    .select()
    .from(seoAuditLog)
    .where(and(eq(seoAuditLog.batchId, batchId), eq(seoAuditLog.action, "link_consumed")));
  return rows.some((r) => (r.after as { tokenHash?: string } | null)?.tokenHash === hash);
}

/**
 * Verify + enforce single-use + record consumption, atomically enough for this
 * use case (a genuine simultaneous double-click on the same link is low-
 * probability and low-harm — worst case is closing an already-closed PR
 * twice, which is idempotent). Returns the payload on success; throws one of
 * the typed errors above otherwise. Callers (the veto route) map these to the
 * confirmation page's messaging.
 */
export async function consumeActionLink(token: string): Promise<ActionLinkPayload> {
  const payload = verifyActionLink(token);
  if (await isActionLinkConsumed(token, payload.batchId)) {
    throw new ActionLinkAlreadyConsumedError();
  }
  await logAudit({
    actorId: null,
    action: "link_consumed",
    batchId: payload.batchId,
    pagePath: null,
    before: null,
    after: { tokenHash: tokenHash(token), linkAction: payload.action },
    lintResult: null,
  });
  return payload;
}

/* ── Social Lane reuse (docs/social-lane-spec.md §1/§7) ─────────────────────
 * The Social Lane's hold-and-veto flow reuses this module's exact HMAC
 * signing scheme (same secret, same base64url(payload).base64url(hmac) shape,
 * same timing-safe verify) rather than duplicating the crypto elsewhere. It
 * does NOT reuse `signActionLink`/`verifyActionLink`/`consumeActionLink`
 * directly because those are hard-typed to the SEO payload shape
 * (`batchId` + literal action "veto") and record consumption in
 * `seoAuditLog`, which is an SEO-domain table a social post has no business
 * writing to. Instead, consumption for a social link is checked against the
 * socialPosts row's own state (idempotent: a post that's already
 * vetoed/reverted/posted just no-ops), which is simpler and keeps this an
 * additive extension — none of the SEO exports above changed.
 */
export type SocialActionKind = "social_veto" | "social_revert";
export type SocialActionPayload = { postId: number; action: SocialActionKind; exp: number };

/** Sign a single-use link for a socialPosts row (veto a held post, or revert a posted one). */
export function signSocialActionLink(
  postId: number,
  action: SocialActionKind,
  ttlMs: number = ACTION_LINK_TTL_MS,
): string {
  const payload: SocialActionPayload = { postId, action, exp: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${payloadB64}.${hmacOf(payloadB64)}`;
}

/** Verify signature + shape + expiry for a Social Lane action link. Does not check consumption. */
export function verifySocialActionLink(token: string): SocialActionPayload {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new InvalidActionLinkError();
  const [payloadB64, sig] = parts;

  const expectedSig = hmacOf(payloadB64);
  const provided = Buffer.from(sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new InvalidActionLinkError();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    throw new InvalidActionLinkError();
  }
  const p = payload as Partial<SocialActionPayload>;
  if (typeof p.postId !== "number" || typeof p.exp !== "number" || (p.action !== "social_veto" && p.action !== "social_revert")) {
    throw new InvalidActionLinkError();
  }
  if (Date.now() > p.exp) throw new ExpiredActionLinkError();
  return { postId: p.postId, action: p.action, exp: p.exp };
}
