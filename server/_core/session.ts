/**
 * Hardened staff/OAuth session primitives (Auth Hardening, 2026-07).
 *
 * Design: sessions stay STATELESS (HS256 JWT in the `app_session_id` cookie —
 * no server-side session store), but each token now carries TWO independent
 * time bounds:
 *
 *   1. Absolute expiry (`absExp` claim, epoch ms) — the hard cap. 8h by default,
 *      30d when the user ticks "Remember this device". Never extended.
 *   2. Idle expiry (the JWT's own `exp`, epoch seconds) — a sliding 30-minute
 *      inactivity window. Every authenticated request re-mints the token with a
 *      fresh idle window (bounded by `absExp`), so activity resets the timer and
 *      inactivity lets the JWT lapse → the server rejects it → client redirects
 *      to /team-login.
 *
 * This module is intentionally free of ENV / DB / Express coupling so the timing
 * logic is unit-testable with an injected `nowMs`. `sdk.ts` wires it to the real
 * secret, request, and cookie.
 *
 * The legacy `sdk.signSession` / `sdk.verifySession` are deliberately left in
 * place for the separate customer-portal realm and are NOT touched here.
 */
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { envBoundedInt } from "./envInt";

/**
 * Durations below are the PRODUCTION defaults. Each may be overridden by an env
 * var — intended for STAGING only, so expiry behavior can be exercised in
 * minutes. Production leaves these unset and gets the defaults. An unset,
 * empty, or invalid value falls back to the default; a value above the safe
 * maximum is clamped down (never blocks startup) so misconfiguration cannot
 * create an effectively permanent session/idle/skew window.
 *
 *   env var                  default   safe maximum
 *   SESSION_TTL_MS           8h        24h
 *   REMEMBER_ME_TTL_MS       30d       30d
 *   IDLE_TIMEOUT_MS          30m       SESSION_TTL_MS (the standard absolute lifetime)
 *   JWT_CLOCK_SKEW_SECONDS   30s       120s
 */

/** Hard ceilings — a value above these is clamped down with a warning. */
export const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const MAX_REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
export const MAX_CLOCK_SKEW_SEC = 120; // 2 min

/** Default (non-remembered) absolute session lifetime: 8 hours (max 24h). */
export const SESSION_TTL_MS = envBoundedInt("SESSION_TTL_MS", 8 * 60 * 60 * 1000, MAX_SESSION_TTL_MS);
/** "Remember this device" absolute session lifetime: 30 days (max 30d). */
export const REMEMBER_ME_TTL_MS = envBoundedInt("REMEMBER_ME_TTL_MS", 30 * 24 * 60 * 60 * 1000, MAX_REMEMBER_ME_TTL_MS);
/** Inactivity window (max = the standard absolute session lifetime; idle must never exceed the cap). */
export const IDLE_TIMEOUT_MS = envBoundedInt("IDLE_TIMEOUT_MS", 30 * 60 * 1000, SESSION_TTL_MS);
/** Allowed clock skew between signer/verifier (seconds; max 120s). */
export const CLOCK_TOLERANCE_SEC = envBoundedInt("JWT_CLOCK_SKEW_SECONDS", 30, MAX_CLOCK_SKEW_SEC);

export type StaffSessionClaims = {
  openId: string;
  appId: string;
  name: string;
  /** Absolute session expiry (epoch ms). The hard cap that idle-refresh never exceeds. */
  absExp: number;
  /** Whether this session was created with "Remember this device" (for audit only). */
  rmb: boolean;
};

export type VerifyReason =
  | "missing" // no cookie presented (anonymous visitor — not a security event)
  | "expired" // idle window lapsed OR absolute cap reached (jose JWTExpired / absExp)
  | "invalid_signature" // signature did not verify (wrong/rotated secret, tampering)
  | "invalid"; // malformed token, wrong alg, or missing required claims

export type VerifyResult =
  | { ok: true; claims: StaffSessionClaims }
  | { ok: false; reason: VerifyReason };

/** Absolute lifetime for a new session, selected by the remember-device choice. */
export function sessionTtlMs(rememberDevice: boolean): number {
  return rememberDevice ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;
}

/**
 * The JWT `exp` (epoch seconds) for a token minted now: a sliding idle deadline
 * that is never allowed past the absolute expiry.
 */
export function idleExpSeconds(nowMs: number, absExpMs: number, idleMs: number = IDLE_TIMEOUT_MS): number {
  const deadlineMs = Math.min(nowMs + idleMs, absExpMs);
  return Math.floor(deadlineMs / 1000);
}

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Mint a hardened staff session token. `exp` is the sliding idle deadline;
 * `absExp` is embedded as a claim so refreshes can enforce the hard cap.
 */
export async function signSessionToken(
  claims: StaffSessionClaims,
  secret: string,
  nowMs: number,
  idleMs: number = IDLE_TIMEOUT_MS,
): Promise<string> {
  const exp = idleExpSeconds(nowMs, claims.absExp, idleMs);
  return new SignJWT({
    openId: claims.openId,
    appId: claims.appId,
    name: claims.name,
    absExp: claims.absExp,
    rmb: claims.rmb,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(nowMs / 1000))
    .setExpirationTime(exp)
    .sign(encodeSecret(secret));
}

/**
 * Verify a staff session token. Returns a typed result so the caller can log the
 * precise failure mode (expired vs bad signature vs malformed). Enforces:
 *  - HS256 only (no alg-confusion),
 *  - the JWT's own `exp` (idle deadline) with clock-skew tolerance,
 *  - the absolute `absExp` cap defensively.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  opts: { clockToleranceSec?: number; nowMs?: number } = {},
): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: "missing" };

  const clockTolerance = opts.clockToleranceSec ?? CLOCK_TOLERANCE_SEC;
  const nowMs = opts.nowMs ?? Date.now();

  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: ["HS256"],
      clockTolerance,
      currentDate: new Date(nowMs),
    });

    const { openId, appId, name, absExp, rmb } = payload as Record<string, unknown>;

    if (
      typeof openId !== "string" || openId.length === 0 ||
      typeof appId !== "string" || appId.length === 0 ||
      typeof name !== "string" || name.length === 0
    ) {
      return { ok: false, reason: "invalid" };
    }

    // Defensive absolute-cap enforcement (the idle `exp` is already <= absExp for
    // tokens we mint, but a legacy/hand-crafted token may lack or exceed it).
    const absExpNum = typeof absExp === "number" ? absExp : 0;
    if (absExpNum > 0 && nowMs > absExpNum + clockTolerance * 1000) {
      return { ok: false, reason: "expired" };
    }

    return {
      ok: true,
      claims: { openId, appId, name, absExp: absExpNum, rmb: Boolean(rmb) },
    };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: "expired" };
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      return { ok: false, reason: "invalid_signature" };
    }
    return { ok: false, reason: "invalid" };
  }
}
