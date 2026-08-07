/**
 * Task 5 authorization tests.
 * Uses the real appRouter with fabricated contexts — middleware runs exactly
 * as in production; DB-dependent handlers are only reached when authz passes,
 * so assertions distinguish FORBIDDEN (blocked by us) from downstream errors.
 */
import "./testEnvSetup"; // MUST be first — see file comment
import { beforeEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";
import { resetRateLimits, publicWriteIpRule } from "./_core/rateLimit";

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

function makeCtx(user: AuthenticatedUser | null, ip = "1.1.1.1"): TrpcContext {
  return {
    req: { headers: { "x-forwarded-for": ip }, ip } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user,
  };
}

const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asAdmin = () => createCaller(makeCtx(makeUser({ teamRole: "admin", role: "admin" })));
const asAnon = () => createCaller(makeCtx(null));

async function errorCode(fn: () => Promise<unknown>): Promise<string | "NO_ERROR"> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

describe("authz — unauthenticated", () => {
  it("rejects protected queries and mutations with UNAUTHORIZED", async () => {
    expect(await errorCode(() => asAnon().customers.stats())).toBe("UNAUTHORIZED");
    expect(await errorCode(() => asAnon().customers.archive({ id: 1 }))).toBe("UNAUTHORIZED");
    expect(await errorCode(() => asAnon().teamAuth.list())).toBe("UNAUTHORIZED");
  });
});

describe("authz — viewer is read-only everywhere", () => {
  it("viewer CAN run queries", async () => {
    // db is unavailable in tests → stats resolves to zeros; the point is no FORBIDDEN
    const stats = await asViewer().customers.stats();
    expect(stats.total).toBe(0);
    const appts = await asViewer().appointments.list({});
    expect(Array.isArray(appts)).toBe(true);
  });

  it("viewer CANNOT run mutations — across different routers", async () => {
    expect(await errorCode(() => asViewer().customers.archive({ id: 1 }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asViewer().appointments.updateStatus({ id: 1, status: "confirmed" }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asViewer().leads.updateStatus({ id: 1, status: "won" }))).toBe("FORBIDDEN");
    expect(await errorCode(() => asViewer().aiScripts.delete({ id: 1 }))).toBe("FORBIDDEN");
  });

  it("viewer mutation rejection carries the read-only message", async () => {
    try {
      await asViewer().customers.archive({ id: 1 });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toMatch(/read-only/i);
    }
  });
});

describe("authz — member vs admin", () => {
  it("member passes the viewer gate on ordinary mutations (fails later on DB, never FORBIDDEN)", async () => {
    const code = await errorCode(() => asMember().customers.archive({ id: 1 }));
    expect(code).not.toBe("FORBIDDEN");
    expect(code).not.toBe("UNAUTHORIZED");
  });

  it("member is blocked from admin-only team management", async () => {
    expect(await errorCode(() =>
      asMember().teamAuth.invite({ email: "x@y.com", name: "X", role: "member", origin: "https://example.com" }),
    )).toBe("FORBIDDEN");
    expect(await errorCode(() => asMember().teamAuth.remove({ id: 99 }))).toBe("FORBIDDEN");
  });

  it("member is blocked from ad-platform credentials/config", async () => {
    expect(await errorCode(() => asMember().metaAds.saveConfig({ accessToken: "t", adAccountId: "a" } as never))).toBe("FORBIDDEN");
    expect(await errorCode(() =>
      asMember().aiVa.saveCredentials({ service: "vapi", apiKey: "k" } as never),
    )).toBe("FORBIDDEN");
  });

  it("admin passes the admin gate (may fail later on DB, never FORBIDDEN)", async () => {
    const code = await errorCode(() =>
      asAdmin().teamAuth.invite({ email: "new@example.com", name: "New", role: "member", origin: "https://example.com" }),
    );
    expect(code).not.toBe("FORBIDDEN");
    expect(code).not.toBe("UNAUTHORIZED");
  });
});

describe("rate limiting — public SMS endpoint (integration)", () => {
  beforeEach(() => resetRateLimits());

  const smsInput = {
    phone: "8625551234",
    firstName: "Test",
    totalRebates: 10000,
    outOfPocket: 0,
    selectedOption: "standard" as const,
  };

  it("blocks the 4th SMS to the same phone within the hour", async () => {
    const caller = asAnon(); // endpoint is public
    // Telnyx isn't configured in tests → each call returns fast with success:false,
    // but every attempt still counts against the limiter (that's the point).
    for (let i = 0; i < 3; i++) {
      const code = await errorCode(() => caller.rebateCalculator.sendResultsSms(smsInput));
      expect(code).not.toBe("TOO_MANY_REQUESTS");
    }
    expect(await errorCode(() => caller.rebateCalculator.sendResultsSms(smsInput))).toBe("TOO_MANY_REQUESTS");
  });

  it("SMS endpoints are EXEMPT from the shared public-write backstop (different phones, one IP)", async () => {
    const caller = asAnon();
    // 6 distinct phones from a single IP. Under the old shared 3/IP/10min bucket
    // the 4th would have been TOO_MANY_REQUESTS; SMS endpoints are now excluded
    // from that backstop, so all pass (bounded only by rebate.sms.ip = 10/IP/hr).
    for (let i = 0; i < 6; i++) {
      const other = { ...smsInput, phone: `862555${i}000` };
      expect(await errorCode(() => caller.rebateCalculator.sendResultsSms(other))).not.toBe("TOO_MANY_REQUESTS");
    }
  });
});

describe("rate limiting — shared public-write backstop (forms)", () => {
  beforeEach(() => resetRateLimits());

  it("publicWriteIpRule is a 10-per-IP / 10-minute backstop", () => {
    const rule = publicWriteIpRule("9.9.9.9");
    expect(rule.max).toBe(10);
    expect(rule.windowMs).toBe(10 * 60 * 1000);
  });

  it("blocks the 11th public FORM submission from one IP within 10 minutes", async () => {
    const caller = createCaller(makeCtx(null, "5.5.5.5"));
    const input = { captureType: "inline_form" as const, email: "load@test.com", firstName: "Load" };
    // First 10 clear the limiter (they fail later on the missing test DB — never
    // TOO_MANY_REQUESTS); the 11th trips the shared public-write backstop.
    for (let i = 0; i < 10; i++) {
      expect(await errorCode(() => caller.leadCaptures.create(input))).not.toBe("TOO_MANY_REQUESTS");
    }
    expect(await errorCode(() => caller.leadCaptures.create(input))).toBe("TOO_MANY_REQUESTS");
  });
});
