import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-level test: dispatch logic + status-code mapping. The crypto/consumption
// logic itself (sign/verify/expiry/single-use) is already covered exhaustively
// in actionLinks.test.ts — mocking it here keeps this file focused on the route.
vi.mock("./actionLinks", () => ({
  verifyActionLink: vi.fn(),
  consumeActionLink: vi.fn(),
  ActionLinkNotConfiguredError: class ActionLinkNotConfiguredError extends Error {},
  InvalidActionLinkError: class InvalidActionLinkError extends Error {},
  ExpiredActionLinkError: class ExpiredActionLinkError extends Error {},
  ActionLinkAlreadyConsumedError: class ActionLinkAlreadyConsumedError extends Error {},
}));
vi.mock("./bulkApprove", () => ({ vetoBatch: vi.fn() }));
vi.mock("../../_core/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

import { registerActionLinkRoutes } from "./actionLinkRoutes";
import { verifyActionLink, consumeActionLink, ExpiredActionLinkError, ActionLinkAlreadyConsumedError, InvalidActionLinkError } from "./actionLinks";
import { vetoBatch } from "./bulkApprove";
import { checkRateLimit } from "../../_core/rateLimit";

function captureHandlers() {
  const handlers: Record<string, (req: unknown, res: unknown) => unknown> = {};
  const app = {
    get: (path: string, h: (req: unknown, res: unknown) => unknown) => { handlers[`GET ${path}`] = h; },
    post: (path: string, h: (req: unknown, res: unknown) => unknown) => { handlers[`POST ${path}`] = h; },
  };
  registerActionLinkRoutes(app as never);
  return handlers;
}

function mockRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    send(b: unknown) { this.body = b; return this; },
  };
}

beforeEach(() => {
  vi.mocked(verifyActionLink).mockReset();
  vi.mocked(consumeActionLink).mockReset();
  vi.mocked(vetoBatch).mockReset().mockResolvedValue({} as never);
  vi.mocked(checkRateLimit).mockReset().mockReturnValue({ allowed: true, remaining: 10 });
});

describe("GET /api/seo/action", () => {
  it("renders a confirmation page for a valid token, without consuming it", async () => {
    vi.mocked(verifyActionLink).mockReturnValue({ batchId: 7, action: "veto", exp: Date.now() + 1000 });
    const res = mockRes();
    await captureHandlers()["GET /api/seo/action"]({ query: { token: "tok" } }, res);
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain("batch #7");
    expect(consumeActionLink).not.toHaveBeenCalled();
    expect(vetoBatch).not.toHaveBeenCalled();
  });

  it("400s on an invalid token", async () => {
    vi.mocked(verifyActionLink).mockImplementation(() => { throw new InvalidActionLinkError(); });
    const res = mockRes();
    await captureHandlers()["GET /api/seo/action"]({ query: { token: "garbage" } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("410s on an expired token", async () => {
    vi.mocked(verifyActionLink).mockImplementation(() => { throw new ExpiredActionLinkError(); });
    const res = mockRes();
    await captureHandlers()["GET /api/seo/action"]({ query: { token: "tok" } }, res);
    expect(res.statusCode).toBe(410);
  });
});

describe("POST /api/seo/action", () => {
  it("consumes the token and vetoes the batch on success", async () => {
    vi.mocked(consumeActionLink).mockResolvedValue({ batchId: 7, action: "veto", exp: Date.now() + 1000 });
    const res = mockRes();
    await captureHandlers()["POST /api/seo/action"]({ body: { token: "tok" }, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(vetoBatch).toHaveBeenCalledWith(7, null);
  });

  it("409s and does not veto when the token was already consumed", async () => {
    vi.mocked(consumeActionLink).mockRejectedValue(new ActionLinkAlreadyConsumedError());
    const res = mockRes();
    await captureHandlers()["POST /api/seo/action"]({ body: { token: "tok" }, query: {} }, res);
    expect(res.statusCode).toBe(409);
    expect(vetoBatch).not.toHaveBeenCalled();
  });

  it("410s on an expired token, without vetoing", async () => {
    vi.mocked(consumeActionLink).mockRejectedValue(new ExpiredActionLinkError());
    const res = mockRes();
    await captureHandlers()["POST /api/seo/action"]({ body: { token: "tok" }, query: {} }, res);
    expect(res.statusCode).toBe(410);
    expect(vetoBatch).not.toHaveBeenCalled();
  });

  it("400s on an invalid token, without vetoing", async () => {
    vi.mocked(consumeActionLink).mockRejectedValue(new InvalidActionLinkError());
    const res = mockRes();
    await captureHandlers()["POST /api/seo/action"]({ body: { token: "garbage" }, query: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(vetoBatch).not.toHaveBeenCalled();
  });

  it("429s when rate-limited, without ever touching the token", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0 });
    const res = mockRes();
    await captureHandlers()["POST /api/seo/action"]({ body: { token: "tok" }, query: {} }, res);
    expect(res.statusCode).toBe(429);
    expect(consumeActionLink).not.toHaveBeenCalled();
    expect(vetoBatch).not.toHaveBeenCalled();
  });
});
