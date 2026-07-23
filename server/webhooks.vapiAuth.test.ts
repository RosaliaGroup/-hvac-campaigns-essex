import "./testEnvSetup"; // MUST be first — appRouter loads stripe at import time
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the call-events handler so we can prove whether a request ever reaches it.
vi.mock("./integrations/vapi", () => ({
  handleVapiWebhook: vi.fn(async () => {}),
}));

import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { handleVapiWebhook } from "./integrations/vapi";

const createCaller = createCallerFactory(appRouter);
const SECRET = "router-webhook-secret-555";
const PREV_SECRET = process.env.VAPI_WEBHOOK_SECRET;
const PREV_ENFORCED = process.env.VAPI_WEBHOOK_AUTH_ENFORCED;

function ctxWithAuth(authorization?: string): TrpcContext {
  return {
    req: { headers: authorization === undefined ? {} : { authorization } } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user: null,
  };
}

const event = { type: "call.ended", call: { id: "vapi_evt_1" } };

describe("webhooks.vapi — call-events authentication (compatibility → enforced)", () => {
  beforeEach(() => {
    vi.mocked(handleVapiWebhook).mockClear();
    process.env.VAPI_WEBHOOK_SECRET = SECRET;
    delete process.env.VAPI_WEBHOOK_AUTH_ENFORCED;
  });
  afterEach(() => {
    if (PREV_SECRET === undefined) delete process.env.VAPI_WEBHOOK_SECRET;
    else process.env.VAPI_WEBHOOK_SECRET = PREV_SECRET;
    if (PREV_ENFORCED === undefined) delete process.env.VAPI_WEBHOOK_AUTH_ENFORCED;
    else process.env.VAPI_WEBHOOK_AUTH_ENFORCED = PREV_ENFORCED;
  });

  it("accepts a correct Bearer secret and invokes the handler once", async () => {
    const caller = createCaller(ctxWithAuth(`Bearer ${SECRET}`));
    await expect(caller.webhooks.vapi(event)).resolves.toEqual({ success: true });
    expect(handleVapiWebhook).toHaveBeenCalledTimes(1);
    expect(handleVapiWebhook).toHaveBeenCalledWith(event);
  });

  it("compat: MISSING header is temporarily accepted (handler runs)", async () => {
    const caller = createCaller(ctxWithAuth(undefined));
    await expect(caller.webhooks.vapi(event)).resolves.toEqual({ success: true });
    expect(handleVapiWebhook).toHaveBeenCalledTimes(1);
  });

  it("compat: WRONG secret is rejected and the handler never runs", async () => {
    const caller = createCaller(ctxWithAuth("Bearer wrong-secret"));
    await expect(caller.webhooks.vapi(event)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(handleVapiWebhook).not.toHaveBeenCalled();
  });

  it("compat: MALFORMED scheme is rejected and the handler never runs", async () => {
    const caller = createCaller(ctxWithAuth(`Basic ${SECRET}`));
    await expect(caller.webhooks.vapi(event)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(handleVapiWebhook).not.toHaveBeenCalled();
  });

  it("enforced: MISSING header is rejected (fail-closed), handler never runs", async () => {
    process.env.VAPI_WEBHOOK_AUTH_ENFORCED = "true";
    const caller = createCaller(ctxWithAuth(undefined));
    await expect(caller.webhooks.vapi(event)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(handleVapiWebhook).not.toHaveBeenCalled();
  });

  it("enforced: correct Bearer still accepted", async () => {
    process.env.VAPI_WEBHOOK_AUTH_ENFORCED = "true";
    const caller = createCaller(ctxWithAuth(`Bearer ${SECRET}`));
    await expect(caller.webhooks.vapi(event)).resolves.toEqual({ success: true });
    expect(handleVapiWebhook).toHaveBeenCalledTimes(1);
  });

  it("enforced: unconfigured backend secret rejects even a plausible token", async () => {
    process.env.VAPI_WEBHOOK_AUTH_ENFORCED = "true";
    delete process.env.VAPI_WEBHOOK_SECRET;
    const caller = createCaller(ctxWithAuth(`Bearer ${SECRET}`));
    await expect(caller.webhooks.vapi(event)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(handleVapiWebhook).not.toHaveBeenCalled();
  });
});
