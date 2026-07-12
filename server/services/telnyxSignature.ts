/**
 * Telnyx webhook signature verification (Ed25519).
 *
 * Telnyx signs every webhook with its account Ed25519 key and sends:
 *   telnyx-signature-ed25519  — base64 signature of `${timestamp}|${rawBody}`
 *   telnyx-timestamp          — unix seconds when Telnyx sent the request
 *
 * The verifying public key is the account "Public Key" from the Telnyx portal
 * (Account → Keys & Credentials → Public Key). Store it as TELNYX_PUBLIC_KEY.
 * It is a base64-encoded raw 32-byte Ed25519 key.
 *
 * Pure functions only — no Express/DB imports — so this is unit-testable and
 * reusable. Uses Node's built-in crypto; no third-party dependency.
 */
import { createPublicKey, verify as cryptoVerify, type KeyObject } from "crypto";

// DER SubjectPublicKeyInfo prefix for an Ed25519 public key (RFC 8410).
// A raw 32-byte Ed25519 key becomes an importable SPKI key when prefixed.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Default replay window. Telnyx recommends 5 minutes. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

/** Build a Node KeyObject from Telnyx's base64 raw Ed25519 public key. */
export function telnyxPublicKeyObject(publicKeyBase64: string): KeyObject {
  const raw = Buffer.from(publicKeyBase64.trim(), "base64");
  if (raw.length !== 32) {
    throw new Error(`Invalid Telnyx public key: expected 32 raw bytes, got ${raw.length}`);
  }
  const spki = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return createPublicKey({ key: spki, format: "der", type: "spki" });
}

export interface VerifyArgs {
  /** Exact raw request body bytes as received (NOT re-serialized JSON). */
  rawBody: string | Buffer;
  /** Value of the `telnyx-signature-ed25519` header. */
  signature: string | undefined | null;
  /** Value of the `telnyx-timestamp` header. */
  timestamp: string | undefined | null;
  /** Telnyx account public key (base64, raw 32 bytes). */
  publicKeyBase64: string;
  /** Allowed clock skew in seconds. Defaults to 5 minutes. */
  toleranceSeconds?: number;
  /** Current unix time in seconds — injectable for tests. Defaults to now. */
  nowSeconds?: number;
}

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: "missing_headers" | "bad_timestamp" | "expired" | "bad_signature" | "verify_error" };

/**
 * Verify a Telnyx webhook signature. Returns a structured result rather than
 * throwing so the caller can log the specific rejection reason.
 */
export function verifyTelnyxSignature(args: VerifyArgs): VerifyResult {
  const {
    rawBody,
    signature,
    timestamp,
    publicKeyBase64,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    nowSeconds,
  } = args;

  if (!signature || !timestamp) return { valid: false, reason: "missing_headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: "bad_timestamp" };

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return { valid: false, reason: "expired" };

  try {
    const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
    const signedPayload = Buffer.concat([Buffer.from(`${timestamp}|`, "utf8"), bodyBuf]);
    const sigBuf = Buffer.from(signature, "base64");
    const keyObject = telnyxPublicKeyObject(publicKeyBase64);
    const ok = cryptoVerify(null, signedPayload, keyObject, sigBuf);
    return ok ? { valid: true } : { valid: false, reason: "bad_signature" };
  } catch {
    return { valid: false, reason: "verify_error" };
  }
}

/** Whether webhook signature verification is configured (public key present). */
export function telnyxSignatureConfigured(): boolean {
  return Boolean(process.env.TELNYX_PUBLIC_KEY);
}

// ── Fail-closed webhook authorization policy ─────────────────────────────────
//
// Production MUST verify signatures. The ONLY way to skip verification is an
// explicit, clearly-named dev/test bypass (TELNYX_WEBHOOK_SIGNATURE_BYPASS),
// which is IGNORED in production. A missing public key is NEVER treated as an
// implicit bypass — it is a misconfiguration that rejects requests.

export type WebhookAuthMode = "verify" | "bypass" | "misconfigured";

export interface AuthPolicyInput {
  nodeEnv?: string | undefined;
  publicKey?: string | null | undefined;
  bypass?: string | boolean | null | undefined;
}

/**
 * Decide how to treat inbound webhook auth from configuration alone.
 *  - "verify"       → a public key is present; verify the signature.
 *  - "bypass"       → explicit dev/test bypass is enabled (never in production).
 *  - "misconfigured"→ cannot safely accept (prod w/o key, or non-prod w/o key
 *                     AND without an explicit bypass). Reject the request.
 */
export function resolveWebhookAuthMode(input: AuthPolicyInput = {}): WebhookAuthMode {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  const publicKey = input.publicKey ?? process.env.TELNYX_PUBLIC_KEY;
  const bypassRaw = input.bypass ?? process.env.TELNYX_WEBHOOK_SIGNATURE_BYPASS;
  const bypass = bypassRaw === true || bypassRaw === "true";
  const isProd = nodeEnv === "production";

  if (publicKey) return "verify";
  // No public key from here down.
  if (bypass && !isProd) return "bypass"; // explicit, non-production only
  return "misconfigured"; // prod-without-key, or dev-without-key-and-no-bypass
}

export type WebhookAuthResult =
  | { ok: true; mode: "verify" | "bypass" }
  | { ok: false; code: 401 | 503; reason: string };

export interface AuthorizeInput extends AuthPolicyInput {
  signature?: string | null;
  timestamp?: string | null;
  rawBody: string | Buffer;
  toleranceSeconds?: number;
  nowSeconds?: number;
}

/**
 * Full fail-closed authorization for a Telnyx webhook request. Returns a 503
 * for a misconfigured server (no key where one is required), 401 for a bad or
 * missing signature, and ok for a verified request or an explicit dev bypass.
 */
export function authorizeTelnyxWebhook(input: AuthorizeInput): WebhookAuthResult {
  const mode = resolveWebhookAuthMode(input);
  if (mode === "bypass") return { ok: true, mode: "bypass" };
  if (mode === "misconfigured") {
    return { ok: false, code: 503, reason: "signature_verification_unconfigured" };
  }
  const publicKey = input.publicKey ?? process.env.TELNYX_PUBLIC_KEY;
  const result = verifyTelnyxSignature({
    rawBody: input.rawBody,
    signature: input.signature,
    timestamp: input.timestamp,
    publicKeyBase64: publicKey as string,
    toleranceSeconds: input.toleranceSeconds,
    nowSeconds: input.nowSeconds,
  });
  if (!result.valid) return { ok: false, code: 401, reason: result.reason };
  return { ok: true, mode: "verify" };
}
