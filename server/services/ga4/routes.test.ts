/**
 * REST surface authorization: POST /api/analytics/ga4/sync must FAIL CLOSED —
 * disabled (503) until GA4_SYNC_CRON_SECRET is set, and 401 on a bad secret. It
 * only reaches the sync when the dedicated secret matches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Express, Request, Response } from "express";

vi.mock("./sync", () => ({ runGa4Sync: vi.fn() }));

import { registerGa4SyncRoutes } from "./routes";
import { runGa4Sync } from "./sync";

type Handler = (req: Request, res: Response) => Promise<void> | void;

function captureHandler(): { app: Express; getHandler: () => Handler } {
  let handler: Handler = () => {};
  const app = { post: (_path: string, h: Handler) => { handler = h; } } as unknown as Express;
  return { app, getHandler: () => handler };
}
function fakeReq(headers: Record<string, string>): Request {
  return { header: (k: string) => headers[k.toLowerCase()] } as unknown as Request;
}
function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  return res;
}

const prev = process.env.GA4_SYNC_CRON_SECRET;
beforeEach(() => { vi.mocked(runGa4Sync).mockReset(); });
afterEach(() => {
  if (prev === undefined) delete process.env.GA4_SYNC_CRON_SECRET;
  else process.env.GA4_SYNC_CRON_SECRET = prev;
});

describe("POST /api/analytics/ga4/sync — fail closed", () => {
  it("returns 503 (disabled) when no secret is configured, and does NOT sync", async () => {
    delete process.env.GA4_SYNC_CRON_SECRET;
    const { app, getHandler } = captureHandler();
    registerGa4SyncRoutes(app);
    const res = fakeRes();
    await getHandler()(fakeReq({}), res as unknown as Response);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false });
    expect(vi.mocked(runGa4Sync)).not.toHaveBeenCalled();
  });

  it("returns 401 on a wrong secret, and does NOT sync", async () => {
    process.env.GA4_SYNC_CRON_SECRET = "s3cret";
    const { app, getHandler } = captureHandler();
    registerGa4SyncRoutes(app);
    const res = fakeRes();
    await getHandler()(fakeReq({ "x-ga4-sync-secret": "wrong" }), res as unknown as Response);
    expect(res.statusCode).toBe(401);
    expect(vi.mocked(runGa4Sync)).not.toHaveBeenCalled();
  });

  it("runs the sync only when the dedicated secret matches", async () => {
    process.env.GA4_SYNC_CRON_SECRET = "s3cret";
    vi.mocked(runGa4Sync).mockResolvedValue({ ok: true, rowsSynced: 0, window: { start: "a", end: "b" } } as never);
    const { app, getHandler } = captureHandler();
    registerGa4SyncRoutes(app);
    const res = fakeRes();
    await getHandler()(fakeReq({ "x-ga4-sync-secret": "s3cret" }), res as unknown as Response);
    expect(vi.mocked(runGa4Sync)).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });
});
