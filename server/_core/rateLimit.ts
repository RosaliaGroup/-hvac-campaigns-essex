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

/** Test helper: clear all limiter state. */
export function resetRateLimits(): void {
  store.clear();
  lastSweep = 0;
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
