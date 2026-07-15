/**
 * Google Business Profile REST route + scheduler — protection tests.
 *
 *   - POST /api/gbp/sync fails CLOSED without a configured secret (503), rejects
 *     a wrong secret (401), and only runs with the correct secret.
 *   - The in-process scheduler is OFF by default (opt-in via
 *     GBP_SYNC_SCHEDULER_ENABLED="true").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Express, Request, Response } from "express";

vi.mock("./sync", () => ({ runGbpSync: vi.fn() }));
import { registerGbpSyncRoutes, startGbpSyncScheduler } from "./routes";
import { runGbpSync } from "./sync";

/** Capture the POST handler registered on a fake Express app. */
function capture(): { app: Express; handler: () => Promise<void> } {
  let handler: (req: Request, res: Response) => Promise<void> = async () => {};
  const app = {
    post(_path: string, h: (req: Request, res: Response) => Promise<void>) {
      handler = h;
    },
  } as unknown as Express;
  registerGbpSyncRoutes(app);
  return { app, handler: handler as never };
}

function fakeRes() {
  const out: { code?: number; body?: unknown } = {};
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
  } as unknown as Response;
  return { res, out };
}

const req = (secret?: string) =>
  ({ header: (name: string) => (name === "x-gbp-sync-secret" ? secret : undefined) }) as unknown as Request;

const savedSecret = process.env.GBP_SYNC_CRON_SECRET;
const savedSched = process.env.GBP_SYNC_SCHEDULER_ENABLED;

beforeEach(() => vi.mocked(runGbpSync).mockReset());
afterEach(() => {
  if (savedSecret === undefined) delete process.env.GBP_SYNC_CRON_SECRET;
  else process.env.GBP_SYNC_CRON_SECRET = savedSecret;
  if (savedSched === undefined) delete process.env.GBP_SYNC_SCHEDULER_ENABLED;
  else process.env.GBP_SYNC_SCHEDULER_ENABLED = savedSched;
  vi.useRealTimers();
});

describe("POST /api/gbp/sync — secret protection", () => {
  it("fails closed with 503 when no secret is configured", async () => {
    delete process.env.GBP_SYNC_CRON_SECRET;
    const { handler } = capture();
    const { res, out } = fakeRes();
    await (handler as unknown as (r: Request, s: Response) => Promise<void>)(req("anything"), res);
    expect(out.code).toBe(503);
    expect(runGbpSync).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret with 401", async () => {
    process.env.GBP_SYNC_CRON_SECRET = "s3cret";
    const { handler } = capture();
    const { res, out } = fakeRes();
    await (handler as unknown as (r: Request, s: Response) => Promise<void>)(req("wrong"), res);
    expect(out.code).toBe(401);
    expect(runGbpSync).not.toHaveBeenCalled();
  });

  it("runs the sync with the correct secret", async () => {
    process.env.GBP_SYNC_CRON_SECRET = "s3cret";
    vi.mocked(runGbpSync).mockResolvedValue({ ok: true, reviewsSynced: 0, metricsSynced: 1, photosSynced: 0, postsSynced: 0 });
    const { handler } = capture();
    const { res, out } = fakeRes();
    await (handler as unknown as (r: Request, s: Response) => Promise<void>)(req("s3cret"), res);
    expect(runGbpSync).toHaveBeenCalledOnce();
    expect(out.code).toBe(200);
  });
});

describe("startGbpSyncScheduler — opt-in", () => {
  it("does NOT schedule when the flag is unset (default off)", () => {
    vi.useFakeTimers();
    delete process.env.GBP_SYNC_SCHEDULER_ENABLED;
    startGbpSyncScheduler();
    vi.advanceTimersByTime(48 * 60 * 60 * 1000); // two days
    expect(runGbpSync).not.toHaveBeenCalled();
  });

  it("does NOT schedule when explicitly set to false", () => {
    vi.useFakeTimers();
    process.env.GBP_SYNC_SCHEDULER_ENABLED = "false";
    startGbpSyncScheduler();
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(runGbpSync).not.toHaveBeenCalled();
  });

  it("schedules a run after the startup delay when enabled", () => {
    vi.useFakeTimers();
    process.env.GBP_SYNC_SCHEDULER_ENABLED = "true";
    vi.mocked(runGbpSync).mockResolvedValue({ ok: true, reviewsSynced: 0, metricsSynced: 0, photosSynced: 0, postsSynced: 0 });
    startGbpSyncScheduler();
    expect(runGbpSync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(91 * 1000); // past the 90s startup delay
    expect(runGbpSync).toHaveBeenCalledOnce();
  });
});
