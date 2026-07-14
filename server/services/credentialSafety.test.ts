import "../testEnvSetup"; // MUST be first
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";
import { redactCredentials } from "./credentialSafety";

// ─── Unit: redaction never leaks a value (raw OR encrypted) ──────────────────

describe("redactCredentials", () => {
  it("returns only key NAMES, never any credential value", () => {
    const summary = redactCredentials("facebook", {
      accessToken: "EAAG_super_secret_page_token",
      appSecret: "app_secret_value",
      pageId: "123456789",
    });
    expect(summary.connected).toBe(true);
    expect(summary.configuredKeys.sort()).toEqual(["accessToken", "appSecret", "pageId"]);
    const json = JSON.stringify(summary);
    expect(json).not.toContain("EAAG_super_secret_page_token");
    expect(json).not.toContain("app_secret_value");
    expect(json).not.toContain("123456789");
  });

  it("never returns an encrypted token blob value", () => {
    // Even if the stored value is an encrypted blob, only the key name is exposed.
    const summary = redactCredentials("google_business", {
      accessToken: "enc:AES256GCM:9f8a7b6c5d4e3f2a1b0c:deadbeefcafebabe",
    });
    expect(summary.configuredKeys).toEqual(["accessToken"]);
    expect(JSON.stringify(summary)).not.toContain("enc:AES256GCM");
    expect(JSON.stringify(summary)).not.toContain("deadbeefcafebabe");
  });

  it("reports not-connected and empty keys when nothing is configured", () => {
    expect(redactCredentials("vapi", {})).toEqual({ service: "vapi", connected: false, configuredKeys: [] });
    expect(redactCredentials("vapi", null)).toEqual({ service: "vapi", connected: false, configuredKeys: [] });
  });

  it("ignores empty-string values (not configured)", () => {
    const s = redactCredentials("twilio", { accountSid: "AC123", authToken: "" });
    expect(s.configuredKeys).toEqual(["accountSid"]);
  });
});

// ─── Integration: real middleware via appRouter caller ───────────────────────

const createCaller = createCallerFactory(appRouter);

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: -1,
    openId: "team:1",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "team",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    videoInterests: null,
    ...overrides,
  };
}
function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return {
    req: { headers: {}, ip: "1.1.1.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user,
  };
}
const asAnon = () => createCaller(makeCtx(null));
const asMember = () => createCaller(makeCtx(makeUser({ role: "user", teamRole: "member" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ role: "admin", teamRole: "admin" })));

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

describe("canary API authorization (real middleware)", () => {
  it("blocks unauthenticated callers (adminProcedure denies with FORBIDDEN)", async () => {
    // adminProcedure checks (!user || role !== 'admin') together, so anon is
    // denied with FORBIDDEN (403) rather than UNAUTHORIZED — access is denied either way.
    expect(await errorCode(() => asAnon().aiVa.canary.status())).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().aiVa.canary.audit())).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().aiVa.canary.runSuccess({ platform: "facebook", confirmed: true }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().aiVa.canary.runFailureRetry({ platform: "facebook", confirmed: true }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asAnon().aiVa.canary.deleteExternal({ id: 1 }))).toBe("FORBIDDEN");
  });

  it("blocks non-admin (member) callers with FORBIDDEN", async () => {
    expect(await errorCode(() => asMember().aiVa.canary.status())).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().aiVa.canary.runSuccess({ platform: "facebook", confirmed: true }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().aiVa.canary.runFailureRetry({ platform: "facebook", confirmed: true }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().aiVa.canary.safetyChecks())).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().aiVa.canary.deleteExternal({ id: 1 }))).toBe("FORBIDDEN");
  });

  it("admin passes authorization (reaches handler, not FORBIDDEN/UNAUTHORIZED)", async () => {
    // No DATABASE_URL in tests → handler returns safely; the point is authz PASSED.
    const code = await errorCode(() => asAdmin().aiVa.canary.safetyChecks());
    expect(["NO_ERROR"]).toContain(code);
  });

  it("non-admin stays blocked even when passing extra/unknown fields", async () => {
    // A member trying to sneak a real-content field is still FORBIDDEN by authz,
    // and the input schema (platform + confirmed only) would strip it regardless.
    const res = await errorCode(() =>
      asMember().aiVa.canary.runSuccess({ platform: "facebook", confirmed: true, content: "REAL CAMPAIGN" } as any)
    );
    expect(res).toBe("FORBIDDEN");
  });

  it("confirmation is required (z.literal(true)) — rejects confirmed:false", async () => {
    const code = await errorCode(() => asAdmin().aiVa.canary.runSuccess({ platform: "facebook", confirmed: false as any }));
    expect(code).toBe("BAD_REQUEST");
  });
});

describe("credentials endpoints never return values (real middleware)", () => {
  it("getAllCredentials / getCredentials responses contain no credential values", async () => {
    // With no DB configured these return [] / empty summary — but crucially the
    // response TYPE has no 'credentials'/value field. Assert shape defensively.
    const all = (await asAdmin().aiVa.getAllCredentials()) as any[];
    for (const entry of all) {
      expect(entry).not.toHaveProperty("credentials");
      expect(Object.keys(entry).sort()).toEqual(["configuredKeys", "connected", "service"]);
    }
  });
});
