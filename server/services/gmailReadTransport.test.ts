import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

describe("shared Gmail read recovery", () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("stops all readers on the first quota failure without immediate retries, then resumes", async () => {
    const { pacedGmailRead } = await import("./gmailReadTransport");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{errors:[{reason:"rateLimitExceeded"}]}}),{status:403}))
      .mockResolvedValue(new Response("{}"));
    await expect(pacedGmailRead("gmail", {}, fetcher)).rejects.toThrow("shared cooldown");
    await expect(pacedGmailRead("gmail", {}, fetcher)).rejects.toThrow("shared cooldown");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(900_000);
    await expect(pacedGmailRead("gmail", {}, fetcher)).resolves.toBeInstanceOf(Response);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("paces simultaneous scanner requests through one lane", async () => {
    const { pacedGmailRead } = await import("./gmailReadTransport");
    const times: number[] = [];
    const fetcher = vi.fn(async () => { times.push(Date.now()); return new Response("{}"); });
    const pending = [pacedGmailRead("a",{},fetcher),pacedGmailRead("b",{},fetcher),pacedGmailRead("c",{},fetcher)];
    await vi.runAllTimersAsync();
    await Promise.all(pending);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(250);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(250);
  });

  it("honors a long Retry-After and does not confuse permissions with quota", async () => {
    const { pacedGmailRead, gmailRetryAfterSeconds } = await import("./gmailReadTransport");
    const { gmailQuotaRemainingMs } = await import("./gmailQuotaCooldown");
    expect(gmailRetryAfterSeconds("Wed, 21 Oct 2026 14:00:00 GMT")).toBe(7200);
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{errors:[{reason:"insufficientPermissions"}]}}),{status:403}))
      .mockResolvedValueOnce(new Response("{}",{status:429,headers:{"retry-after":"7200"}}));
    expect((await pacedGmailRead("a",{},fetcher)).status).toBe(403);
    expect(gmailQuotaRemainingMs()).toBe(0);
    const rejected = expect(pacedGmailRead("b",{},fetcher)).rejects.toThrow("shared cooldown");
    await vi.runAllTimersAsync(); await rejected;
    expect(gmailQuotaRemainingMs()).toBe(7200_000);
  });
});
