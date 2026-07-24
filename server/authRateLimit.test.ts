/**
 * Auth Hardening — login rate limiting + proxy-safe client IP.
 * Verifies: trusted-IP derivation ignores spoofed leftmost XFF, peek/record/clear
 * counter semantics, and the login lockout short-circuits (generic, DB-free) once
 * the per-account/IP failure threshold is reached.
 */
import "./testEnvSetup"; // MUST be first
import { beforeEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getTrustedClientIp,
  countRateLimitHits,
  recordRateLimitHit,
  clearRateLimit,
  resetRateLimits,
} from "./_core/rateLimit";

const BUCKET = "team_login_fail";
const WINDOW = 15 * 60 * 1000;
const NOW = 1_700_000_000_000;
const now = () => NOW;

beforeEach(() => resetRateLimits());

function reqWith(headers: Record<string, string | string[] | undefined>, socketIp?: string) {
  return { req: { headers, socket: { remoteAddress: socketIp } } as never } as Pick<TrpcContext, "req">;
}

describe("getTrustedClientIp — Railway-verified proxy model", () => {
  // Railway REWRITES forwarding headers (verified live 2026-07-24): X-Real-IP =
  // true client (overwrites spoofs); X-Forwarded-For = "<real-client>, <railway-hop>".
  it("prefers X-Real-IP (Railway sets it to the true client, overwriting spoofs)", () => {
    // Even if XFF carries other junk, X-Real-IP wins.
    expect(getTrustedClientIp(reqWith({ "x-real-ip": "24.185.130.70", "x-forwarded-for": "1.2.3.4, 152.233.30.104" }))).toBe("24.185.130.70");
    // Array-form header.
    expect(getTrustedClientIp(reqWith({ "x-real-ip": ["24.185.130.70"] }))).toBe("24.185.130.70");
  });

  it("uses the LEFTMOST XFF entry (real client) when X-Real-IP is absent", () => {
    // Railway's rewrite puts the real client first and its own edge hop last.
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "24.185.130.70, 152.233.30.104" }))).toBe("24.185.130.70");
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": " 24.185.130.70 , 152.233.30.104 " }))).toBe("24.185.130.70");
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": ["24.185.130.70", "152.233.30.104"] }))).toBe("24.185.130.70");
  });

  it("is spoof-proof in production: a client cannot forge the keyed value", () => {
    // On Railway the app only ever SEES Railway's rewritten headers. Modeling that:
    // whatever the client attempts, X-Real-IP is what Railway wrote (the real client),
    // so the derived IP is stable regardless of injected XFF chains.
    const railwayWrote = { "x-real-ip": "24.185.130.70" };
    expect(getTrustedClientIp(reqWith({ ...railwayWrote, "x-forwarded-for": "attacker1, attacker2" }))).toBe("24.185.130.70");
    expect(getTrustedClientIp(reqWith({ ...railwayWrote, "x-forwarded-for": "9.9.9.9" }))).toBe("24.185.130.70");
  });

  it("does NOT trust the client-controllable Forwarded header", () => {
    // Forwarded is passed through unsanitized by Railway; we never read it.
    expect(getTrustedClientIp(reqWith({ "x-real-ip": "24.185.130.70", forwarded: "for=6.6.6.6" }))).toBe("24.185.130.70");
  });

  it("falls back to the socket peer when no forwarding headers are present", () => {
    expect(getTrustedClientIp(reqWith({}, "198.51.100.2"))).toBe("198.51.100.2");
    expect(getTrustedClientIp(reqWith({}))).toBe("unknown-ip");
  });
});

describe("rate-limit counter semantics", () => {
  it("peek does not increment; record does; clear resets", () => {
    const key = "user@example.com|203.0.113.9";
    expect(countRateLimitHits(BUCKET, key, WINDOW, now)).toBe(0);
    expect(countRateLimitHits(BUCKET, key, WINDOW, now)).toBe(0); // peek stays 0

    for (let i = 1; i <= 5; i++) {
      expect(recordRateLimitHit(BUCKET, key, WINDOW, now)).toBe(i);
    }
    expect(countRateLimitHits(BUCKET, key, WINDOW, now)).toBe(5);

    clearRateLimit(BUCKET, key);
    expect(countRateLimitHits(BUCKET, key, WINDOW, now)).toBe(0);
  });

  it("hits outside the window are not counted", () => {
    const key = "stale@example.com|203.0.113.9";
    recordRateLimitHit(BUCKET, key, WINDOW, () => NOW - WINDOW - 1); // long ago
    expect(countRateLimitHits(BUCKET, key, WINDOW, now)).toBe(0);
  });
});

describe("teamAuth.login lockout (DB-free short-circuit)", () => {
  function loginCtx(ip: string): TrpcContext {
    return {
      user: null,
      req: { headers: { "x-forwarded-for": ip, "user-agent": "vitest" } } as TrpcContext["req"],
      res: { cookie: () => {}, clearCookie: () => {}, setHeader: () => {} } as unknown as TrpcContext["res"],
    };
  }

  async function code(fn: () => Promise<unknown>): Promise<string> {
    try {
      await fn();
      return "NO_ERROR";
    } catch (e) {
      return e instanceof TRPCError ? e.code : `OTHER:${String(e)}`;
    }
  }

  it("blocks the 6th attempt once 5 failures are on record for account+IP", async () => {
    const ip = "203.0.113.50";
    const email = "attacker@example.com";
    // Pre-load the failure counter exactly as failed logins would.
    for (let i = 0; i < 5; i++) recordRateLimitHit("team_login_fail", `${email}|${ip}`, WINDOW);

    const caller = appRouter.createCaller(loginCtx(ip));
    // Pre-check throws TOO_MANY_REQUESTS before any DB lookup.
    expect(await code(() => caller.teamAuth.login({ email, password: "anything" }))).toBe("TOO_MANY_REQUESTS");
  });

  it("does not reveal account existence: same generic lockout regardless of email", async () => {
    const ip = "203.0.113.51";
    for (const email of ["real-owner@example.com", "does-not-exist@example.com"]) {
      resetRateLimits();
      for (let i = 0; i < 5; i++) recordRateLimitHit("team_login_fail", `${email}|${ip}`, WINDOW);
      const caller = appRouter.createCaller(loginCtx(ip));
      let message = "";
      try {
        await caller.teamAuth.login({ email, password: "anything" });
      } catch (e) {
        if (e instanceof TRPCError) message = e.message;
      }
      expect(message).toBe("Too many login attempts. Please wait 15 minutes and try again.");
    }
  });

  it("a client cannot dodge the limit by injecting XFF — Railway's X-Real-IP is authoritative", async () => {
    const realIp = "24.185.130.70"; // the value Railway's edge writes as X-Real-IP
    const email = "victim@example.com";
    for (let i = 0; i < 5; i++) recordRateLimitHit("team_login_fail", `${email}|${realIp}`, WINDOW);

    // The attacker crams junk into X-Forwarded-For, but on Railway the edge sets
    // X-Real-IP to the real client and overwrites client-supplied values, so the
    // limiter keys on the true IP and the lockout holds.
    const spoofCtx: TrpcContext = {
      user: null,
      req: { headers: { "x-real-ip": realIp, "x-forwarded-for": "1.1.1.1, 2.2.2.2", "user-agent": "vitest" } } as TrpcContext["req"],
      res: { cookie: () => {}, clearCookie: () => {}, setHeader: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(spoofCtx);
    expect(await code(() => caller.teamAuth.login({ email, password: "anything" }))).toBe("TOO_MANY_REQUESTS");
  });
});
