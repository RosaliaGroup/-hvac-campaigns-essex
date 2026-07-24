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

describe("getTrustedClientIp — proxy spoofing resistance", () => {
  it("uses the RIGHTMOST XFF hop (Railway edge), ignoring a spoofed leftmost", () => {
    // Attacker prepends a fake IP; Railway appends the real peer on the right.
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    // Attacker cannot change the rightmost by spoofing the left.
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 8.8.8.8, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("handles a single client IP and array-form headers", () => {
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": ["1.1.1.1", "203.0.113.9"] }))).toBe("203.0.113.9");
  });

  it("honors a configurable trusted-hop count (extra proxy in front)", () => {
    // With 2 trusted hops, the client is the 2nd entry from the right.
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "spoof, 203.0.113.9, cdn-edge" }), 2)).toBe("203.0.113.9");
  });

  it("falls back to the socket peer when no XFF is present", () => {
    expect(getTrustedClientIp(reqWith({}, "198.51.100.2"))).toBe("198.51.100.2");
    expect(getTrustedClientIp(reqWith({}))).toBe("unknown-ip");
  });

  it("is robust to adversarial XFF shapes (whitespace, IPv6, empty segments, deep spoof)", () => {
    // Railway always appends the real peer last; everything left of it is noise.
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "  1.2.3.4 , 203.0.113.9 " }))).toBe("203.0.113.9");
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "1.2.3.4,,203.0.113.9" }))).toBe("203.0.113.9");
    expect(getTrustedClientIp(reqWith({ "x-forwarded-for": "::1, 2001:db8::1" }))).toBe("2001:db8::1");
    // Attacker crams many fake hops on the left; rightmost (Railway) still wins.
    expect(
      getTrustedClientIp(reqWith({ "x-forwarded-for": "a, b, c, d, e, f, 203.0.113.9" })),
    ).toBe("203.0.113.9");
    // Duplicate header delivered as an array is concatenated in order → rightmost real.
    expect(
      getTrustedClientIp(reqWith({ "x-forwarded-for": ["9.9.9.9, 8.8.8.8", "203.0.113.9"] })),
    ).toBe("203.0.113.9");
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

  it("a spoofed leftmost XFF cannot dodge the limit (same rightmost IP → same bucket)", async () => {
    const realIp = "203.0.113.77";
    const email = "victim@example.com";
    for (let i = 0; i < 5; i++) recordRateLimitHit("team_login_fail", `${email}|${realIp}`, WINDOW);

    // Attacker rotates the spoofable leftmost value but the trusted rightmost is unchanged.
    const spoofCtx: TrpcContext = {
      user: null,
      req: { headers: { "x-forwarded-for": `1.1.1.1, ${realIp}`, "user-agent": "vitest" } } as TrpcContext["req"],
      res: { cookie: () => {}, clearCookie: () => {}, setHeader: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(spoofCtx);
    expect(await code(() => caller.teamAuth.login({ email, password: "anything" }))).toBe("TOO_MANY_REQUESTS");
  });
});
