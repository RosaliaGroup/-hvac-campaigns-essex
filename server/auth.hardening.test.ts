/**
 * Auth Hardening — router-level tests: remember-device duration selection and
 * logout behavior (cookie cleared + no-store headers to defeat back-button
 * restore). DB-free: logout touches no database, and issueSession is pure crypto.
 */
import "./testEnvSetup"; // MUST be first — provides dummy STRIPE + JWT secrets
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import { SESSION_TTL_MS, REMEMBER_ME_TTL_MS } from "./_core/session";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type Header = { key: string; value: unknown };

function makeLogoutCtx() {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const headers: Header[] = [];

  const ctx: TrpcContext = {
    user: {
      id: -1,
      openId: "team:1",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "team",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": "9.9.9.9", "user-agent": "vitest" },
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      setHeader: (key: string, value: unknown) => {
        headers.push({ key, value });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, clearedCookies, headers };
}

describe("remember-device duration", () => {
  it("issues an 8h session by default and a 30d session when remembered", async () => {
    const standard = await sdk.issueSession({ openId: "team:1", appId: "team", name: "X" }, {});
    const remembered = await sdk.issueSession(
      { openId: "team:1", appId: "team", name: "X" },
      { rememberDevice: true },
    );
    expect(standard.ttlMs).toBe(SESSION_TTL_MS);
    expect(standard.ttlMs).toBe(8 * 60 * 60 * 1000);
    expect(remembered.ttlMs).toBe(REMEMBER_ME_TTL_MS);
    expect(remembered.ttlMs).toBe(30 * 24 * 60 * 60 * 1000);
    // The 30d duration only applies when explicitly remembered.
    expect(remembered.ttlMs).toBeGreaterThan(standard.ttlMs);
  });

  it("mints a non-empty JWT whose absExp matches the chosen (30d) lifetime", async () => {
    const { token, absExp } = await sdk.issueSession(
      { openId: "team:1", appId: "team", name: "X" },
      { rememberDevice: true },
    );
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
    expect(absExp - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });
});

describe("legacy cookie handling", () => {
  it("refuses a pre-hardening cookie that has no absolute cap (forces re-login)", async () => {
    // sdk.signSession is the LEGACY signer (no absExp claim), same as old prod.
    const legacy = await sdk.signSession(
      { openId: "team:1", appId: "team", name: "X" },
      { expiresInMs: 60_000 }, // signature valid & unexpired
    );
    // Rejection happens on the missing absExp BEFORE any DB lookup.
    const res = await sdk.authenticateRequest({
      headers: { cookie: `${COOKIE_NAME}=${legacy}` },
    } as never);
    expect(res.user).toBeNull();
    expect(res.refreshedToken).toBeUndefined();
  });
});

describe("auth.logout hardening", () => {
  it("clears the session cookie AND sets no-store cache headers", async () => {
    const { ctx, clearedCookies, headers } = makeLogoutCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });

    // Cookie cleared with matching path/flags.
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1, path: "/", httpOnly: true });

    // Back-button / bfcache defense: no-store must be present.
    const cacheControl = headers.find(h => h.key === "Cache-Control");
    expect(cacheControl).toBeDefined();
    expect(String(cacheControl?.value)).toContain("no-store");
  });
});
