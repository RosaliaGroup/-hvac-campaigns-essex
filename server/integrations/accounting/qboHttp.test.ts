import { describe, it, expect, vi } from "vitest";
import { resilientFetch, RETRYABLE_STATUS, type QboFetchLogEntry } from "./qboHttp";

const instantSleep = () => Promise.resolve();

/** A fetch that never resolves but honours the abort signal (like real fetch). */
function hangingFetch(): typeof fetch {
  return ((_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const e = new Error("The operation was aborted");
        e.name = "AbortError";
        reject(e);
      });
    })) as unknown as typeof fetch;
}

/** A fetch that returns each queued response/error in order. */
function scriptedFetch(steps: Array<Response | Error>): { fn: typeof fetch; calls: () => number } {
  let i = 0;
  const fn = ((_url: string, _init: RequestInit) => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
  }) as unknown as typeof fetch;
  return { fn, calls: () => i };
}

describe("resilientFetch — timeout", () => {
  it("aborts and throws a timeout error instead of hanging forever", async () => {
    const logs: QboFetchLogEntry[] = [];
    const p = resilientFetch("https://qbo/x", { method: "GET" }, {
      timeoutMs: 30,
      maxRetries: 0,
      fetchImpl: hangingFetch(),
      sleep: instantSleep,
      log: e => logs.push(e),
      label: "/estimate",
    });
    await expect(p).rejects.toThrow(/timed out after 30ms/);
    expect(logs.at(-1)).toMatchObject({ outcome: "timeout", status: null });
  });

  it("retries a timeout up to the bound, then throws (bounded, terminates)", async () => {
    const logs: QboFetchLogEntry[] = [];
    await expect(
      resilientFetch("https://qbo/x", {}, {
        timeoutMs: 20, maxRetries: 2, fetchImpl: hangingFetch(), sleep: instantSleep, log: e => logs.push(e),
      }),
    ).rejects.toThrow(/timed out/);
    // 1 initial + 2 retries = 3 attempts, all timeouts.
    expect(logs.filter(l => l.outcome === "timeout")).toHaveLength(3);
  });
});

describe("resilientFetch — transient retries", () => {
  it("retries a 503 then returns the eventual 200", async () => {
    const { fn, calls } = scriptedFetch([new Response("busy", { status: 503 }), new Response("ok", { status: 200 })]);
    const res = await resilientFetch("https://qbo/x", {}, { fetchImpl: fn, sleep: instantSleep, maxRetries: 2 });
    expect(res.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("retries a network error then succeeds", async () => {
    const { fn, calls } = scriptedFetch([new Error("ECONNRESET"), new Response("ok", { status: 200 })]);
    const res = await resilientFetch("https://qbo/x", {}, { fetchImpl: fn, sleep: instantSleep, maxRetries: 2 });
    expect(res.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("exhausts retries on persistent 429 and returns the last response (not a throw)", async () => {
    const { fn, calls } = scriptedFetch([new Response("", { status: 429 })]);
    const res = await resilientFetch("https://qbo/x", {}, { fetchImpl: fn, sleep: instantSleep, maxRetries: 2 });
    expect(res.status).toBe(429);
    expect(calls()).toBe(3); // initial + 2 retries
  });

  it("throws after exhausting retries on a persistent network error", async () => {
    const { fn, calls } = scriptedFetch([new Error("ENOTFOUND")]);
    await expect(
      resilientFetch("https://qbo/x", {}, { fetchImpl: fn, sleep: instantSleep, maxRetries: 1 }),
    ).rejects.toThrow(/ENOTFOUND/);
    expect(calls()).toBe(2);
  });
});

describe("resilientFetch — non-retryable statuses", () => {
  it.each([400, 401, 403, 404, 500])("does NOT retry a %i and returns it once", async status => {
    const { fn, calls } = scriptedFetch([new Response("", { status })]);
    const res = await resilientFetch("https://qbo/x", {}, { fetchImpl: fn, sleep: instantSleep, maxRetries: 3 });
    expect(res.status).toBe(status);
    expect(calls()).toBe(1);
    expect(RETRYABLE_STATUS.has(status)).toBe(false);
  });
});

describe("resilientFetch — logging", () => {
  it("logs one entry per attempt with a stable request id and duration", async () => {
    const logs: QboFetchLogEntry[] = [];
    let clock = 1000;
    const { fn } = scriptedFetch([new Response("", { status: 503 }), new Response("ok", { status: 200 })]);
    await resilientFetch("https://qbo/x", { method: "POST" }, {
      fetchImpl: fn, sleep: instantSleep, maxRetries: 2, log: e => logs.push(e),
      now: () => (clock += 5), label: "/query",
    });
    expect(logs).toHaveLength(2);
    expect(new Set(logs.map(l => l.requestId)).size).toBe(1); // same request id across attempts
    expect(logs.every(l => l.method === "POST" && l.label === "/query" && l.ms >= 0)).toBe(true);
  });
});
