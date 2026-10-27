import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const url = "https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews";
const ok = () => Response.json({ reviews: [] });
const limited = (retryAfter?: string) => Response.json(
  { error: { status: "RESOURCE_EXHAUSTED", details: [{ reason: "RATE_LIMIT_EXCEEDED" }] } },
  { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : {} },
);

describe("GBP read transport", () => {
  it("paces simultaneous reads to the same service and keeps the queue usable", async () => {
    const { getGbpJson } = await import("./gbpHttp");
    const times: number[] = [];
    const fetcher = vi.fn(async () => { times.push(Date.now()); return ok(); });
    const calls = Promise.all([getGbpJson(url, "token", fetcher), getGbpJson(url, "token", fetcher), getGbpJson(url, "token", fetcher)]);
    await vi.runAllTimersAsync();
    await calls;
    expect(times.map(time => time - times[0])).toEqual([0, 250, 500]);
    expect(fetcher.mock.calls).toHaveLength(3);
  });

  it("honors Retry-After then recovers without another caller retrying", async () => {
    const { getGbpJson } = await import("./gbpHttp");
    const fetcher = vi.fn().mockResolvedValueOnce(limited("3")).mockResolvedValueOnce(ok());
    const promise = getGbpJson(url, "token", fetcher);
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ reviews: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("bounds persistent 429 retries and shares cooldown with queued callers", async () => {
    const { getGbpJson } = await import("./gbpHttp");
    const fetcher = vi.fn(async () => limited());
    const calls = Promise.allSettled([getGbpJson(url, "token", fetcher), getGbpJson(url, "token", fetcher)]);
    await vi.runAllTimersAsync();
    const results = await calls;
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(results.every(result => result.status === "rejected")).toBe(true);
    expect((results[0] as PromiseRejectedResult).reason).toMatchObject({ status: 429, reason: "RATE_LIMIT_EXCEEDED", retryAfterSeconds: 60 });
    await vi.advanceTimersByTimeAsync(60_000);
    const healthy = vi.fn(async () => ok());
    await expect(getGbpJson(url, "token", healthy)).resolves.toEqual({ reviews: [] });
  });

  it.each(["120", "Sat, 17 Oct 2026 12:02:00 GMT"])("does not shorten a long Retry-After (%s)", async retryAfter => {
    const { getGbpJson } = await import("./gbpHttp");
    const fetcher = vi.fn(async () => limited(retryAfter));
    await expect(getGbpJson(url, "token", fetcher)).rejects.toMatchObject({ status: 429, retryAfterSeconds: 120 });
    await expect(getGbpJson(url, "token", fetcher)).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not retry permissions errors or block an unrelated API service", async () => {
    const { getGbpJson } = await import("./gbpHttp");
    const fetcher = vi.fn(async () => Response.json({ error: { status: "PERMISSION_DENIED" } }, { status: 403 }));
    await expect(getGbpJson(url, "token", fetcher)).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const healthy = vi.fn(async () => ok());
    await expect(getGbpJson("https://businessprofileperformance.googleapis.com/v1/locations/2", "token", healthy)).resolves.toEqual({ reviews: [] });
  });

  it("retries transient server errors", async () => {
    const { getGbpJson } = await import("./gbpHttp");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })).mockResolvedValueOnce(ok());
    const promise = getGbpJson(url, "token", fetcher);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ reviews: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
