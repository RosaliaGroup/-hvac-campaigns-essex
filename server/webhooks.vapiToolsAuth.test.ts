import "./testEnvSetup"; // MUST be first — appRouter loads stripe at import time
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the dispatcher so we can prove whether a request ever reaches tool execution.
vi.mock("./integrations/vapiTools", () => ({
  handleVapiToolCalls: vi.fn(async () => ({
    results: [{ toolCallId: "tc_1", result: JSON.stringify({ success: true }) }],
  })),
}));

import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { handleVapiToolCalls } from "./integrations/vapiTools";

const createCaller = createCallerFactory(appRouter);
const SECRET = "router-secret-xyz-987";
const PREV = process.env.VAPI_WEBHOOK_SECRET;

function ctxWithAuth(authorization?: string): TrpcContext {
  return {
    req: { headers: authorization === undefined ? {} : { authorization } } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user: null,
  };
}

// A well-formed tool-call the dispatcher WOULD act on if it were ever reached.
const payload = {
  message: {
    type: "tool-calls",
    call: { id: "vapi_1" },
    toolCallList: [
      { id: "tc_1", type: "function", function: { name: "sendReferralLink", arguments: JSON.stringify({ phone: "8624191763" }) } },
    ],
  },
};

describe("webhooks.vapiTools — dispatcher authentication (Bearer VAPI_WEBHOOK_SECRET)", () => {
  beforeEach(() => {
    vi.mocked(handleVapiToolCalls).mockClear();
    process.env.VAPI_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    if (PREV === undefined) delete process.env.VAPI_WEBHOOK_SECRET;
    else process.env.VAPI_WEBHOOK_SECRET = PREV;
  });

  async function expectRejectedNoTool(ctx: TrpcContext) {
    const caller = createCaller(ctx);
    await expect(caller.webhooks.vapiTools(payload)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    // The decisive assertion: no tool was parsed or executed.
    expect(handleVapiToolCalls).not.toHaveBeenCalled();
  }

  it("rejects and runs NO tool when the secret is not configured (fail-closed)", async () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    await expectRejectedNoTool(ctxWithAuth(`Bearer ${SECRET}`));
  });

  it("rejects and runs NO tool when the Authorization header is missing", async () => {
    await expectRejectedNoTool(ctxWithAuth(undefined));
  });

  it("rejects and runs NO tool on a malformed header", async () => {
    await expectRejectedNoTool(ctxWithAuth(`Basic ${SECRET}`));
  });

  it("rejects and runs NO tool on a wrong secret", async () => {
    await expectRejectedNoTool(ctxWithAuth("Bearer definitely-not-the-secret"));
  });

  it("accepts the correct Bearer secret and dispatches the tool exactly once", async () => {
    const caller = createCaller(ctxWithAuth(`Bearer ${SECRET}`));
    const res = await caller.webhooks.vapiTools(payload);
    expect(handleVapiToolCalls).toHaveBeenCalledTimes(1);
    expect(handleVapiToolCalls).toHaveBeenCalledWith(payload);
    expect(res).toEqual({ results: [{ toolCallId: "tc_1", result: JSON.stringify({ success: true }) }] });
  });
});
