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
  meta?: { route?: string; ip?: string },
): void {
  for (const rule of rules) {
    const { allowed } = checkRateLimit(rule.bucket, rule.key, rule.max, rule.windowMs);
    if (!allowed) {
      // Same shape as the Turnstile reject log (ts / route / ip / reason) so both
      // spam-guard signals are greppable together. Falls back to the rule's
      // bucket/key when no meta is supplied.
      console.warn(
        `[spam-guard] rate-limit reject ts=${new Date().toISOString()} ` +
          `route=${meta?.route ?? rule.bucket} ip=${meta?.ip ?? rule.key} ` +
          `reason=${rule.bucket} over ${rule.max}/${Math.round(rule.windowMs / 60000)}min`,
      );
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please wait a bit and try again.",
      });
    }
  }
}

export const HOUR_MS = 60 * 60 * 1000;
export const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Shared cross-endpoint BACKSTOP for PUBLIC FORM write procedures (lead capture,
 * rebate calculation submit). Every public FORM submission counts against ONE
 * per-IP bucket so a single source spraying several form endpoints is caught.
 * Turnstile is the real gate — this is only a loose backstop, deliberately wide
 * enough NOT to trip an office/apartment behind one NAT. SMS-sending endpoints
 * are intentionally EXCLUDED (they keep their own per-phone/per-IP caps). Use the
 * exact same bucket/max/window at every call site or the counter won't aggregate.
 */
export const PUBLIC_WRITE_BUCKET = "public.write.ip";
export const PUBLIC_WRITE_MAX = 10;
export function publicWriteIpRule(ip: string) {
  return { bucket: PUBLIC_WRITE_BUCKET, key: ip, max: PUBLIC_WRITE_MAX, windowMs: TEN_MINUTES_MS };
}
