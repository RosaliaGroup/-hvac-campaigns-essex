import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyAnthropicError,
  modelChain,
  callAnthropicWithFallback,
} from "./anthropic";

// Fast retry config so tests don't sleep.
const RETRY = { maxAttemptsPerModel: 2, baseDelayMs: 0, timeoutMs: 1000 };

function okResponse(text = "hello") {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}
function errResponse(status: number, type: string, extra = "") {
  return new Response(JSON.stringify({ error: { type, message: extra } }), { status });
}

/** Queue-backed fetch mock: each call returns (or throws) the next queued item. */
function queueFetch(items: Array<Response | Error>) {
  const q = [...items];
  return vi.fn(async () => {
    const next = q.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("fetch queue exhausted");
    return next;
  });
}

beforeEach(() => {
  delete process.env.TAKEOFF_MODEL_QUICK;
  delete process.env.TAKEOFF_MODEL_PRECISE;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyAnthropicError", () => {
  it("classifies transient errors as retryable", () => {
    expect(classifyAnthropicError(429, "rate_limit_error", "")).toBe("retryable");
    expect(classifyAnthropicError(500, "api_error", "")).toBe("retryable");
    expect(classifyAnthropicError(503, "", "")).toBe("retryable");
    expect(classifyAnthropicError(529, "overloaded_error", "")).toBe("retryable");
    expect(classifyAnthropicError(408, "", "")).toBe("retryable");
  });

  it("classifies 404 / not_found as model_unavailable", () => {
    expect(classifyAnthropicError(404, "", "")).toBe("model_unavailable");
    expect(classifyAnthropicError(200, "not_found_error", "")).toBe("model_unavailable");
  });

  it("classifies billing / auth / permission / malformed as fatal (no retry)", () => {
    expect(classifyAnthropicError(400, "invalid_request_error", "your credit balance is too low")).toBe("fatal");
    expect(classifyAnthropicError(401, "authentication_error", "")).toBe("fatal");
    expect(classifyAnthropicError(403, "permission_error", "")).toBe("fatal");
    expect(classifyAnthropicError(400, "invalid_request_error", "bad model")).toBe("fatal");
    expect(classifyAnthropicError(413, "request_too_large", "")).toBe("fatal");
  });
});

describe("modelChain", () => {
  it("uses approved defaults and fallback order", () => {
    expect(modelChain("quick")).toEqual(["claude-sonnet-5", "claude-haiku-4-5"]);
    expect(modelChain("precise")).toEqual(["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"]);
  });

  it("honors env overrides", () => {
    process.env.TAKEOFF_MODEL_QUICK = "claude-custom-x";
    expect(modelChain("quick")[0]).toBe("claude-custom-x");
  });
});

describe("callAnthropicWithFallback", () => {
  it("retries a transient 429 then succeeds (same model)", async () => {
    const fetchMock = queueFetch([errResponse(429, "rate_limit_error"), okResponse("ok")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "quick", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(true);
    expect(r.model).toBe("claude-sonnet-5");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error then succeeds", async () => {
    const fetchMock = queueFetch([new Error("ECONNRESET"), okResponse("ok")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "quick", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the next model when the primary is unavailable (404)", async () => {
    const fetchMock = queueFetch([errResponse(404, "not_found_error"), okResponse("ok")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "precise", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(true);
    expect(r.model).toBe("claude-sonnet-5"); // opus-4-8 -> sonnet-5
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a billing error and returns a friendly message", async () => {
    const fetchMock = queueFetch([errResponse(400, "invalid_request_error", "your credit balance is too low")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "quick", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry
    expect(r.error).toMatch(/credits/i);
  });

  it("does NOT retry an auth error", async () => {
    const fetchMock = queueFetch([errResponse(401, "authentication_error")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "quick", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports all_models_unavailable when every model 404s", async () => {
    // quick chain has 2 models; each returns 404 once (model_unavailable breaks to next).
    const fetchMock = queueFetch([errResponse(404, "not_found_error"), errResponse(404, "not_found_error")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "quick", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("all_models_unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on a persistent 5xx", async () => {
    const fetchMock = queueFetch([errResponse(503, "api_error"), errResponse(503, "api_error")]);
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAnthropicWithFallback({ apiKey: "k", mode: "quick", messages: [{ role: "user", content: "x" }], retry: RETRY });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(RETRY.maxAttemptsPerModel);
  });
});
