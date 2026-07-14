/**
 * Auth boundary tests for takeoffs.analyzeBatch.
 * Uses the real appRouter with fabricated contexts (middleware runs as in prod).
 * The handler is only reached once authz passes; with no ANTHROPIC_API_KEY it
 * fails fast with INTERNAL_SERVER_ERROR *before* any network call — so these
 * tests never hit Anthropic.
 */
import "../testEnvSetup"; // MUST be first
import { afterEach, describe, expect, it, vi } from "vitest";
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
  batchId: "to:1:quick:deadbeef",
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

describe("takeoffs.analyzeBatch — idempotency (no double-billing)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function anthropicOk(text = "ok") {
    return new Response(
      JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 20 } }),
      { status: 200 },
    );
  }

  it("bills once for a repeated batchId and returns the cached response on the retry", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => anthropicOk("analysis"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      // Unique id so this test is independent of the module-level store's history.
      const input = { ...VALID_INPUT, batchId: "to:1:quick:idem-test-1" };

      const first = await asMember().takeoffs.analyzeBatch(input);
      const second = await asMember().takeoffs.analyzeBatch(input); // browser retry

      expect(first.text).toBe("analysis");
      expect(first.cached).toBe(false);
      expect(second.text).toBe("analysis"); // same response
      expect(second.cached).toBe(true);     // served from cache, not re-billed
      expect(fetchMock).toHaveBeenCalledTimes(1); // Anthropic called exactly once
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("bills again for a different batchId (distinct batch → distinct call)", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => anthropicOk());
    vi.stubGlobal("fetch", fetchMock);
    try {
      await asMember().takeoffs.analyzeBatch({ ...VALID_INPUT, batchId: "to:1:quick:idem-test-A" });
      await asMember().takeoffs.analyzeBatch({ ...VALID_INPUT, batchId: "to:1:quick:idem-test-B" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
