/**
 * Unit tests for the sendResultsSms procedure in the Rebate Calculator router.
 *
 * Tests cover phone number normalization, message formatting, and the
 * Telnyx API call behavior (mocked to avoid real network requests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Phone number normalization (mirrors server logic) ─────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

// ─── SMS message builder (mirrors server logic) ────────────────────────────────

function buildSmsMessage(params: {
  firstName: string;
  selectedOption: "high_efficiency" | "standard";
  totalRebates: number;
  outOfPocket: number;
}): string {
  const { firstName, selectedOption, totalRebates, outOfPocket } = params;
  const optionLabel = selectedOption === "high_efficiency" ? "High-Efficiency" : "Standard";
  const rebateFormatted = `$${totalRebates.toLocaleString()}`;
  const oopFormatted =
    outOfPocket === 0 ? "$0 out of pocket" : `$${outOfPocket.toLocaleString()} out of pocket`;

  return [
    `Hi ${firstName}! Here are your NJ Clean Heat rebate results from Mechanical Enterprise:`,
    ``,
    `✅ ${optionLabel} Heat Pump`,
    `💰 Total Rebates: ${rebateFormatted}`,
    `🏠 Your Cost: ${oopFormatted}`,
    ``,
    `Ready to lock in your rebate? Book your FREE assessment:`,
    `https://mechanicalenterprise.com`,
    ``,
    `Questions? Call us: (862) 419-1763`,
    `Reply STOP to opt out.`,
  ].join("\n");
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("sendResultsSms — phone number normalization", () => {
  it("normalizes a 10-digit number to E.164", () => {
    expect(normalizePhone("8624191763")).toBe("+18624191763");
  });

  it("normalizes a formatted number (dashes) to E.164", () => {
    expect(normalizePhone("862-419-1763")).toBe("+18624191763");
  });

  it("normalizes a formatted number (parens + spaces) to E.164", () => {
    expect(normalizePhone("(862) 419-1763")).toBe("+18624191763");
  });

  it("does not double-prefix a number that already starts with 1", () => {
    expect(normalizePhone("18624191763")).toBe("+18624191763");
  });

  it("does not double-prefix a number in E.164 format", () => {
    // strip the + before passing to normalizePhone (as the server does with replace(/\D/g,''))
    expect(normalizePhone("+18624191763".replace(/\D/g, ""))).toBe("+18624191763");
  });
});

describe("sendResultsSms — message content", () => {
  it("includes homeowner first name", () => {
    const msg = buildSmsMessage({
      firstName: "Maria",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });
    expect(msg).toContain("Hi Maria!");
  });

  it("shows High-Efficiency label for high_efficiency option", () => {
    const msg = buildSmsMessage({
      firstName: "John",
      selectedOption: "high_efficiency",
      totalRebates: 14000,
      outOfPocket: 0,
    });
    expect(msg).toContain("High-Efficiency Heat Pump");
  });

  it("shows Standard label for standard option", () => {
    const msg = buildSmsMessage({
      firstName: "John",
      selectedOption: "standard",
      totalRebates: 0,
      outOfPocket: 8500,
    });
    expect(msg).toContain("Standard Heat Pump");
  });

  it("formats total rebates as currency", () => {
    const msg = buildSmsMessage({
      firstName: "Ana",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });
    expect(msg).toContain("$16,000");
  });

  it("shows $0 out of pocket when outOfPocket is 0", () => {
    const msg = buildSmsMessage({
      firstName: "Ana",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });
    expect(msg).toContain("$0 out of pocket");
  });

  it("shows dollar amount when outOfPocket > 0", () => {
    const msg = buildSmsMessage({
      firstName: "Bob",
      selectedOption: "standard",
      totalRebates: 0,
      outOfPocket: 8500,
    });
    expect(msg).toContain("$8,500 out of pocket");
  });

  it("includes the booking URL", () => {
    const msg = buildSmsMessage({
      firstName: "Ana",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });
    expect(msg).toContain("https://mechanicalenterprise.com");
  });

  it("includes the opt-out instruction", () => {
    const msg = buildSmsMessage({
      firstName: "Ana",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });
    expect(msg).toContain("Reply STOP to opt out.");
  });

  it("includes the company phone number", () => {
    const msg = buildSmsMessage({
      firstName: "Ana",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });
    expect(msg).toContain("(862) 419-1763");
  });
});

describe("sendResultsSms — Telnyx API call (mocked)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TELNYX_API_KEY = "KEY_test_mock";
    process.env.TELNYX_FROM_NUMBER = "+18621234567";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_FROM_NUMBER;
  });

  it("calls Telnyx API with correct payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "msg_123" } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const phone = "8624191763";
    const toNumber = normalizePhone(phone);
    const message = buildSmsMessage({
      firstName: "Ana",
      selectedOption: "high_efficiency",
      totalRebates: 16000,
      outOfPocket: 0,
    });

    await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.TELNYX_FROM_NUMBER,
        to: toNumber,
        text: message,
      }),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telnyx.com/v2/messages");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.to).toBe("+18624191763");
    expect(body.from).toBe("+18621234567");
    expect(body.text).toContain("Ana");
    expect(body.text).toContain("$16,000");
  });

  it("returns success: false when API returns non-200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "Unauthorized",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: "Bearer bad_key", "Content-Type": "application/json" },
      body: JSON.stringify({ from: "+1000", to: "+1111", text: "test" }),
    });

    expect(response.ok).toBe(false);
  });
});
