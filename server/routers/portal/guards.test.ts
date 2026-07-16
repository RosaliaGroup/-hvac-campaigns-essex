import "./testEnv"; // MUST be first — sets STRIPE + JWT env before appRouter loads
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../../routers";
import { createCallerFactory } from "../../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../../_core/context";
import { sdk } from "../../_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { PORTAL_COOKIE } from "./session";

const createCaller = createCallerFactory(appRouter);

function makeCtx(opts: { cookie?: string; user?: AuthenticatedUser | null } = {}): TrpcContext {
  return {
    req: { headers: opts.cookie ? { cookie: opts.cookie } : {}, ip: "1.1.1.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user: opts.user ?? null,
  };
}

function makeTeamUser(): AuthenticatedUser {
  return {
    id: -1,
    openId: "team:1",
    name: "Staffer",
    email: "staff@example.com",
    loginMethod: "team",
    role: "admin",
    teamRole: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    videoInterests: null,
  } as AuthenticatedUser;
}

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

describe("portal guards — unauthenticated", () => {
  const anon = () => createCaller(makeCtx());

  it("portal.auth.me returns null (never throws) when signed out", async () => {
    expect(await anon().portal.auth.me()).toBeNull();
  });

  it("blocks protected portal queries with UNAUTHORIZED", async () => {
    expect(await errorCode(() => anon().portal.estimates.list())).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.invoices.list())).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.dashboard.summary())).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.serviceHistory.list())).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.documents.list())).toBe("UNAUTHORIZED");
  });

  it("blocks protected portal mutations with UNAUTHORIZED", async () => {
    expect(await errorCode(() => anon().portal.messaging.sendMessage({ threadId: 1, body: "hi" }))).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.messaging.startThread({ subject: "s", body: "b" }))).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.appointments.request({ appointmentType: "service_call", preferredDate: "2026-08-01", preferredTime: "AM" }))).toBe("UNAUTHORIZED");
    expect(await errorCode(() => anon().portal.payments.createInvoiceCheckout({ invoiceId: 1, origin: "https://x.test" }))).toBe("UNAUTHORIZED");
  });
});

describe("portal guards — realm isolation", () => {
  it("a valid TEAM session cookie does NOT grant portal access", async () => {
    const teamToken = await sdk.signSession(
      { openId: "team:1", appId: "team", name: "Staffer" },
      { expiresInMs: ONE_YEAR_MS },
    );
    const caller = createCaller(makeCtx({ cookie: `${PORTAL_COOKIE}=${teamToken}` }));
    expect(await caller.portal.auth.me()).toBeNull();
    expect(await errorCode(() => caller.portal.estimates.list())).toBe("UNAUTHORIZED");
  });

  it("an authenticated STAFF user (ctx.user) still cannot reach portal data", async () => {
    // Portal auth is a separate realm from staff/admin auth entirely.
    const caller = createCaller(makeCtx({ user: makeTeamUser() }));
    expect(await caller.portal.auth.me()).toBeNull();
    expect(await errorCode(() => caller.portal.invoices.list())).toBe("UNAUTHORIZED");
    expect(await errorCode(() => caller.portal.messaging.startThread({ subject: "s", body: "b" }))).toBe("UNAUTHORIZED");
  });

  it("an expired portal cookie fails safe with UNAUTHORIZED", async () => {
    const expired = await sdk.signSession(
      { openId: "portal:9", appId: "portal", name: "Old" },
      { expiresInMs: -1000 },
    );
    const caller = createCaller(makeCtx({ cookie: `${PORTAL_COOKIE}=${expired}` }));
    expect(await errorCode(() => caller.portal.equipment.list())).toBe("UNAUTHORIZED");
  });
});
