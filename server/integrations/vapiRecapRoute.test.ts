import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerVapiRecapRoute } from "./vapiRecapRoute";

/**
 * Route-level security tests for POST /api/vapi/call-recap.
 *
 * These exercise ONLY the fail-closed auth + contract validation that run
 * BEFORE any persistence, so no DB is required:
 *   - secret absent            → 503 (endpoint inert; never publicly callable)
 *   - secret set, header wrong  → 401
 *   - secret set, header right  → auth passes (reaches 400 on missing name/phone)
 */

type Handler = (req: unknown, res: unknown) => Promise<unknown> | unknown;

function captureHandler(): Handler {
  let handler: Handler | null = null;
  const app = { post: (_path: string, h: Handler) => { handler = h; } };
  registerVapiRecapRoute(app as never);
  if (!handler) throw new Error("route not registered");
  return handler;
}

function mockReq(headers: Record<string, string>, body: unknown) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { get: (h: string) => lower[h.toLowerCase()], body };
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
  };
  return res;
}

const validBody = { name: "Ana Haynes", phone: "8624191763" };

describe("vapiRecapRoute — fail-closed authentication", () => {
  const handler = captureHandler();

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects with 503 when the secret is NOT configured (never public)", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "");
    const res = mockRes();
    await handler(mockReq({}, validBody), res);
    expect(res.statusCode).toBe(503);
  });

  it("rejects with 401 when the secret is set but the header is missing", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "s3cret");
    const res = mockRes();
    await handler(mockReq({}, validBody), res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects with 401 when the header presents the wrong secret", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "s3cret");
    const res = mockRes();
    await handler(mockReq({ authorization: "Bearer wrong" }, validBody), res);
    expect(res.statusCode).toBe(401);
  });

  it("passes auth with the correct Bearer secret (reaches contract validation)", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "s3cret");
    const res = mockRes();
    // Missing name/phone → 400 proves we got PAST auth without touching the DB.
    await handler(mockReq({ authorization: "Bearer s3cret" }, {}), res);
    expect(res.statusCode).toBe(400);
  });

  it("accepts the x-vapi-secret header form too", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "s3cret");
    const res = mockRes();
    await handler(mockReq({ "x-vapi-secret": "s3cret" }, {}), res);
    expect(res.statusCode).toBe(400); // auth passed, then contract validation
  });
});
