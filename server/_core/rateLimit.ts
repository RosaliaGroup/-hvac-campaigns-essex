/**
 * In-memory sliding-window rate limiter for public tRPC procedures.
 * Phase 1 security hardening (Task 5).
 *
 * Scope: protects abuse-prone PUBLIC endpoints (SMS senders, lead capture)
 * from budget-drain and spam. In-memory is intentional — the server is a
 * single Express process; if that ever changes, swap the store for Redis
 * behind the same interface.
 */
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";

type Bucket = number[]; // timestamps (ms) of accepted hits inside the window

const store = new Map<string, Bucket>();

// Prevent unbounded memory: prune the whole store occasionally.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  store.forEach((hits, key) => {
    const alive = hits.filter(t => now - t < windowMs);
    if (alive.length === 0) store.delete(key);
    else store.set(key, alive);
  });
}

/**
 * Record a hit for `key` in `bucket`. Returns whether it is ALLOWED.
 * `nowFn` is injectable for tests.
 */
export function checkRateLimit(
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
  nowFn: () => number = Date.now,
): { allowed: boolean; remaining: number } {
  const now = nowFn();
  sweep(now, windowMs);
  const storeKey = `${bucket}:${key}`;
  const hits = (store.get(storeKey) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= max) {
    store.set(storeKey, hits);
    return { allowed: false, remaining: 0 };
  }
  hits.push(now);
  store.set(storeKey, hits);
  return { allowed: true, remaining: max - hits.length };
}

/**
 * Peek the number of live hits for `key` WITHOUT recording a new one. Used by
 * login rate limiting to check the lockout threshold before deciding whether to
 * even attempt authentication.
 */
export function countRateLimitHits(
  bucket: string,
  key: string,
  windowMs: number,
  nowFn: () => number = Date.now,
): number {
  const now = nowFn();
  const storeKey = `${bucket}:${key}`;
  const hits = (store.get(storeKey) ?? []).filter(t => now - t < windowMs);
  store.set(storeKey, hits);
  return hits.length;
}

/** Record one hit for `key` (e.g. a failed login). Returns the new live count. */
export function recordRateLimitHit(
  bucket: string,
  key: string,
  windowMs: number,
  nowFn: () => number = Date.now,
): number {
  const now = nowFn();
  const storeKey = `${bucket}:${key}`;
  const hits = (store.get(storeKey) ?? []).filter(t => now - t < windowMs);
  hits.push(now);
  store.set(storeKey, hits);
  return hits.length;
}

/** Clear the counter for `key` (e.g. after a successful login). */
export function clearRateLimit(bucket: string, key: string): void {
  store.delete(`${bucket}:${key}`);
}

/** Test helper: clear all limiter state. */
export function resetRateLimits(): void {
  store.clear();
  lastSweep = 0;
}

/**
 * Trusted client IP for SECURITY decisions (login rate limiting).
 *
 * `X-Forwarded-For` is `client, proxy1, proxy2, ...` — appended left-to-right as
 * the request traverses proxies. A client can PREPEND arbitrary fake entries,
 * so the LEFTMOST values are attacker-controllable. Each trusted proxy appends
 * the real peer it saw, so the RIGHTMOST entries are trustworthy. With exactly
 * one trusted hop (Railway's edge — the default), the real client IP is the last
 * XFF entry. This mirrors Express `trust proxy = <n>`: trust `hops` entries from
 * the right and ignore everything to their left.
 *
 * NOTE: increase `TRUSTED_PROXY_HOPS` only if you add another trusted proxy in
 * front of Railway (e.g. Cloudflare) — otherwise a client could spoof the extra
 * hop. Never key security limits on `getClientIp` (leftmost, spoofable).
 */
/** Upper bound on trusted proxy hops — a client could spoof beyond a real chain. */
export const MAX_TRUSTED_PROXY_HOPS = 4;

export function getTrustedClientIp(ctx: Pick<TrpcContext, "req">, hops?: number): string {
  const req = ctx.req as {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  };
  // Trusted hops is a small bounded integer in [1, MAX_TRUSTED_PROXY_HOPS];
  // out-of-range / invalid values fall back to 1 (Railway's single edge hop).
  const parsedHops = Number.isInteger(hops)
    ? (hops as number)
    : parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  const trustedHops =
    Number.isInteger(parsedHops) && parsedHops >= 1 && parsedHops <= MAX_TRUSTED_PROXY_HOPS
      ? parsedHops
      : 1;

  const fwd = req?.headers?.["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd.join(",") : (fwd ?? "");
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);

  if (parts.length > 0) {
    // The entry `trustedHops` from the right is the deepest hop we still trust.
    const idx = Math.max(0, parts.length - trustedHops);
    const candidate = parts[idx];
    if (candidate) return candidate;
  }
  // No usable XFF → fall back to the direct socket peer.
  return req?.socket?.remoteAddress || req?.ip || "unknown-ip";
}

/** Best-effort client IP behind Netlify/any proxy. */
export function getClientIp(ctx: Pick<TrpcContext, "req">): string {
  const req = ctx.req as { headers?: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } };
  const fwd = req?.headers?.["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return (first?.trim() || req?.ip || req?.socket?.remoteAddress || "unknown-ip");
}

/** Normalize a phone to a stable limiter key (last 10 digits). */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-10) || "unknown-phone";
}

/**
 * Guard for use inside procedures: throws TOO_MANY_REQUESTS when over limit.
 * Checks every provided rule; all must pass.
 */
export function enforceRateLimit(
  rules: Array<{ bucket: string; key: string; max: number; windowMs: number }>,
): void {
  for (const rule of rules) {
    const { allowed } = checkRateLimit(rule.bucket, rule.key, rule.max, rule.windowMs);
    if (!allowed) {
      console.warn(`[RateLimit] Blocked ${rule.bucket} for key=${rule.key} (max ${rule.max}/${rule.windowMs}ms)`);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please wait a bit and try again.",
      });
    }
  }
}

export const HOUR_MS = 60 * 60 * 1000;
