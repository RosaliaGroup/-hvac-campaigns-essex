/**
 * REST surface authorization: POST /api/analytics/ga4/sync must FAIL CLOSED —
 * disabled (503) until GA4_SYNC_CRON_SECRET is set, and 401 on a bad secret. It
 * only reaches the sync when the dedicated secret matches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Express, Request, Response } from "express";

vi.mock("./sync", () => ({ runGa4Sync: vi.fn(), readGa4SyncStatus: vi.fn() }));
vi.mock("../../_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));

import { registerGa4SyncRoutes } from "./routes";
import { runGa4Sync, readGa4SyncStatus } from "./sync";
import { notifyOwner } from "../../_core/notification";

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

describe("GA4 staleness watchdog — runs independently of the sync scheduler flag", () => {
  beforeEach(() => {
    vi.mocked(readGa4SyncStatus).mockReset();
    vi.mocked(notifyOwner).mockClear();
  });

  it("does nothing when GA4 is unconfigured (no propertyId)", async () => {
    const { checkGa4StalenessAndAlert } = await import("./routes");
    vi.mocked(readGa4SyncStatus).mockResolvedValue({
      connected: false, propertyId: null, lastRunAt: null, lastRunStatus: null,
      lastSuccessAt: null, lastError: null, rowsSynced: 0, stale: true,
    } as never);
    await checkGa4StalenessAndAlert();
    expect(vi.mocked(notifyOwner)).not.toHaveBeenCalled();
  });

  it("does not alert when the last success is recent", async () => {
    const { checkGa4StalenessAndAlert } = await import("./routes");
    vi.mocked(readGa4SyncStatus).mockResolvedValue({
      connected: true, propertyId: "123456789", lastRunAt: new Date().toISOString(), lastRunStatus: "success",
      lastSuccessAt: new Date().toISOString(), lastError: null, rowsSynced: 635, stale: false,
    } as never);
    await checkGa4StalenessAndAlert();
    expect(vi.mocked(notifyOwner)).not.toHaveBeenCalled();
  });

  it("alerts once when the last success is older than the stale threshold, and again after recovering-then-going-stale", async () => {
    vi.resetModules();
    vi.doMock("./sync", () => ({ runGa4Sync: vi.fn(), readGa4SyncStatus: vi.fn() }));
    vi.doMock("../../_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));
    const syncMod = await import("./sync");
    const notifyMod = await import("../../_core/notification");
    const { checkGa4StalenessAndAlert } = await import("./routes");

    const staleTimestamp = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(); // 40h ago
    vi.mocked(syncMod.readGa4SyncStatus).mockResolvedValue({
      connected: true, propertyId: "123456789", lastRunAt: staleTimestamp, lastRunStatus: "error",
      lastSuccessAt: staleTimestamp, lastError: "boom", rowsSynced: 0, stale: true,
    } as never);

    await checkGa4StalenessAndAlert();
    expect(vi.mocked(notifyMod.notifyOwner)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyMod.notifyOwner)).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("stale") }),
    );

    // Still stale on the next check — must NOT re-alert every 6h while stale.
    await checkGa4StalenessAndAlert();
    expect(vi.mocked(notifyMod.notifyOwner)).toHaveBeenCalledTimes(1);

    // Recovers...
    vi.mocked(syncMod.readGa4SyncStatus).mockResolvedValue({
      connected: true, propertyId: "123456789", lastRunAt: new Date().toISOString(), lastRunStatus: "success",
      lastSuccessAt: new Date().toISOString(), lastError: null, rowsSynced: 10, stale: false,
    } as never);
    await checkGa4StalenessAndAlert();
    expect(vi.mocked(notifyMod.notifyOwner)).toHaveBeenCalledTimes(1);

    // ...then goes stale again — should alert a second time.
    vi.mocked(syncMod.readGa4SyncStatus).mockResolvedValue({
      connected: true, propertyId: "123456789", lastRunAt: staleTimestamp, lastRunStatus: "error",
      lastSuccessAt: staleTimestamp, lastError: "boom again", rowsSynced: 0, stale: true,
    } as never);
    await checkGa4StalenessAndAlert();
    expect(vi.mocked(notifyMod.notifyOwner)).toHaveBeenCalledTimes(2);
  });
});
