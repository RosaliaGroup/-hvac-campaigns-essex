/**
 * Auth boundary tests for takeoffs.analyzeBatch.
 * Uses the real appRouter with fabricated contexts (middleware runs as in prod).
 * The handler is only reached once authz passes; with no ANTHROPIC_API_KEY it
 * fails fast with INTERNAL_SERVER_ERROR *before* any network call — so these
 * tests never hit Anthropic.
 */
import "../testEnvSetup"; // MUST be first
import { afterEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext, AuthenticatedUser } from "../_core/context";

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
    req: { headers: { "x-forwarded-for": "1.1.1.1" }, ip: "1.1.1.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user,
  };
}

const asMember = () => createCaller(makeCtx(makeUser({ teamRole: "member" })));
const asViewer = () => createCaller(makeCtx(makeUser({ teamRole: "viewer" })));
const asAnon = () => createCaller(makeCtx(null));

const VALID_INPUT = {
  mode: "quick" as const,
  system: "You are an estimator.",
  messages: [{ role: "user", content: "hi" }],
};

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${String(err)}`;
  }
}

describe("takeoffs.analyzeBatch — auth", () => {
  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).__RESTORE_KEY__;
  });

  it("rejects anonymous callers with UNAUTHORIZED (never reaches Anthropic)", async () => {
    expect(await errorCode(() => asAnon().takeoffs.analyzeBatch(VALID_INPUT))).toBe("UNAUTHORIZED");
  });

  it("rejects viewer mutations with FORBIDDEN", async () => {
    expect(await errorCode(() => asViewer().takeoffs.analyzeBatch(VALID_INPUT))).toBe("FORBIDDEN");
  });

  it("lets an authenticated member past authz, then fails INTERNAL when the key is unset (no network)", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const code = await errorCode(() => asMember().takeoffs.analyzeBatch(VALID_INPUT));
      expect(code).toBe("INTERNAL_SERVER_ERROR"); // reached handler; not UNAUTHORIZED/FORBIDDEN
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });
});
