/**
 * Shared Telnyx sender tests (Task 12): E.164 normalization, successful send,
 * Telnyx API failure, network error, not-configured, and invalid recipient.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toE164, sendTelnyxSms, telnyxConfigured } from "./telnyxSms";

describe("toE164 normalization", () => {
  it("normalizes 10-digit to +1XXXXXXXXXX", () => {
    expect(toE164("8624239396")).toBe("+18624239396");
  });
  it("normalizes formatted numbers", () => {
    expect(toE164("(862) 423-9396")).toBe("+18624239396");
    expect(toE164("862-423-9396")).toBe("+18624239396");
    expect(toE164("862.423.9396")).toBe("+18624239396");
  });
  it("keeps a leading 1 without double-prefixing", () => {
    expect(toE164("18624239396")).toBe("+18624239396");
    expect(toE164("+1 862 423 9396")).toBe("+18624239396");
  });
  it("returns null for unusable input", () => {
    expect(toE164("")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
    expect(toE164("12345")).toBeNull();
    expect(toE164("+44 20 7946 0958")).toBeNull(); // non-US
  });
});

describe("sendTelnyxSms", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TELNYX_API_KEY = "KEY_test_mock";
    process.env.TELNYX_FROM_NUMBER = "+15516007027";
  });
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_FROM_NUMBER;
    vi.restoreAllMocks();
  });

  it("telnyxConfigured reflects env", () => {
    expect(telnyxConfigured()).toBe(true);
    delete process.env.TELNYX_API_KEY;
    expect(telnyxConfigured()).toBe(false);
  });

  it("sends and returns the Telnyx message id, posting E.164 payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { id: "msg_abc", to: [{ status: "queued" }] } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const res = await sendTelnyxSms("(862) 423-9396", "Hi there");
    expect(res).toEqual({ success: true, messageId: "msg_abc" });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telnyx.com/v2/messages");
    const body = JSON.parse((options as { body: string }).body);
    expect(body).toEqual({ from: "+15516007027", to: "+18624239396", text: "Hi there" });
    expect((options as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer KEY_test_mock");
  });

  it("returns not-configured error when env is missing", async () => {
    delete process.env.TELNYX_API_KEY;
    const res = await sendTelnyxSms("8624239396", "x");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not configured/i);
  });

  it("rejects an invalid recipient before calling the API", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    const res = await sendTelnyxSms("12345", "x");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid phone/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("surfaces a Telnyx API error (non-2xx)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ errors: [{ detail: "Authentication failed" }] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
    const res = await sendTelnyxSms("8624239396", "x");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/401/);
  });

  it("handles a network error without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    global.fetch = mockFetch as unknown as typeof fetch;
    const res = await sendTelnyxSms("8624239396", "x");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/ECONNRESET/);
  });
});
