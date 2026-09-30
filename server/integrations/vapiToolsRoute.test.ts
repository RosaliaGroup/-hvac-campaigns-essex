import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dispatch = vi.fn(async () => ({ results: [{ toolCallId: "t1", result: '{"ok":true}' }] }));
vi.mock("./vapiTools", () => ({ handleVapiToolCalls: (p: unknown) => dispatch(p) }));

import { registerVapiToolsRoute } from "./vapiToolsRoute";

type Handler = (req: unknown, res: unknown) => Promise<unknown> | unknown;

function capture(): { path: string; handler: Handler } {
  let out: { path: string; handler: Handler } | null = null;
  registerVapiToolsRoute({ post: (path: string, handler: Handler) => { out = { path, handler }; } } as never);
  if (!out) throw new Error("route not registered");
  return out;
}
const req = (auth: string | undefined, body: unknown) => ({ get: (h: string) => (h.toLowerCase() === "authorization" ? auth : undefined), body });
function res() {
  const r = { statusCode: 0, body: undefined as unknown, status(c: number) { r.statusCode = c; return r; }, json(p: unknown) { r.body = p; return r; } };
  return r;
}
const body = { message: { type: "tool-calls", toolCallList: [{ id: "t1", type: "function", function: { name: "getCallerInfo", arguments: '{"phone":"+12015550123"}' } }] } };

describe("POST /api/vapi/tools", () => {
  const saved = process.env.VAPI_WEBHOOK_SECRET;
  beforeEach(() => { dispatch.mockClear(); process.env.VAPI_WEBHOOK_SECRET = "s3cret"; });
  afterEach(() => { if (saved === undefined) delete process.env.VAPI_WEBHOOK_SECRET; else process.env.VAPI_WEBHOOK_SECRET = saved; });

  it("registers exactly /api/vapi/tools", () => { expect(capture().path).toBe("/api/vapi/tools"); });

  it("503 and no dispatch when the secret is not configured (fail-closed)", async () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    const r = res(); await capture().handler(req("Bearer s3cret", body), r);
    expect(r.statusCode).toBe(503); expect(dispatch).not.toHaveBeenCalled();
  });
  it("401 and no dispatch for a missing or wrong header", async () => {
    for (const h of [undefined, "Bearer nope", "s3cret", "Basic s3cret"]) {
      const r = res(); await capture().handler(req(h, body), r);
      expect(r.statusCode).toBe(401);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("400 for a body without toolCallList (auth passed)", async () => {
    const r = res(); await capture().handler(req("Bearer s3cret", { message: {} }), r);
    expect(r.statusCode).toBe(400); expect(dispatch).not.toHaveBeenCalled();
  });
  it("200 with the Vapi-shaped { results } reply when authenticated", async () => {
    const r = res(); await capture().handler(req("Bearer s3cret", body), r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ results: [{ toolCallId: "t1", result: '{"ok":true}' }] });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it("500 without leaking details when the dispatcher throws", async () => {
    dispatch.mockRejectedValueOnce(new Error("db password=hunter2"));
    const r = res(); await capture().handler(req("Bearer s3cret", body), r);
    expect(r.statusCode).toBe(500); expect(JSON.stringify(r.body)).not.toContain("hunter2");
  });
});
