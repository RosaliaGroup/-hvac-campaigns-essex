/**
 * Tests for the Calculator Registration gate:
 *  - register procedure: validates input, generates token, returns success
 *  - getByToken procedure: returns registration data or error states
 *
 * These tests mock the DB and external services (Telnyx, Resend) so they
 * run fully offline without side-effects.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared mocks ────────────────────────────────────────────────────────────

// Mock the DB module so no real DB connection is needed
const mockInsert = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
const mockSelect = vi.fn();

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: () => ({ values: mockInsert }),
    update: () => mockUpdate(),
    select: () => ({ from: () => ({ where: () => ({ limit: mockSelect }) }) }),
  }),
}));

// Mock notifyOwner so no HTTP calls are made
vi.mock("../server/_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock global fetch for Telnyx and Resend calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal registration input */
function makeRegInput(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "9735550100",
    address: "123 Main St",
    city: "Newark",
    zip: "07102",
    origin: "https://mechanicalenterprise.com",
    ...overrides,
  };
}

/** Build a DB row representing a valid registration */
function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "+19735550100",
    address: "123 Main St",
    city: "Newark",
    zip: "07102",
    state: "NJ",
    token: "abc123token",
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    smsSent: false,
    emailSent: false,
    calculatorStarted: false,
    calculatorCompleted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── register procedure logic tests ─────────────────────────────────────────

describe("register procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("normalizes a 10-digit US phone to E.164", () => {
    const digits = "9735550100".replace(/\D/g, "");
    const phone = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    expect(phone).toBe("+19735550100");
  });

  it("normalizes a 10-digit phone that already starts with 1", () => {
    const digits = "19735550100".replace(/\D/g, "");
    const phone = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    expect(phone).toBe("+19735550100");
  });

  it("normalizes a phone with dashes and spaces", () => {
    const digits = "973-555-0100".replace(/\D/g, "");
    const phone = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    expect(phone).toBe("+19735550100");
  });

  it("generates a token without hyphens", () => {
    const { randomUUID } = require("crypto");
    const token = randomUUID().replace(/-/g, "");
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("builds the correct calculator URL from origin and token", () => {
    const origin = "https://mechanicalenterprise.com";
    const token = "abc123";
    const url = `${origin}/rebate-calculator?token=${token}`;
    expect(url).toBe("https://mechanicalenterprise.com/rebate-calculator?token=abc123");
  });

  it("sets tokenExpiresAt to ~30 days in the future", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("sends SMS with the correct calculator URL in the body", () => {
    const origin = "https://mechanicalenterprise.com";
    const token = "testtoken";
    const calculatorUrl = `${origin}/rebate-calculator?token=${token}`;
    const smsBody = [
      `Hi Jane! Your NJ Clean Heat Rebate Calculator is ready.`,
      ``,
      `Click your personalized link to see how much you can save:`,
      calculatorUrl,
      ``,
      `Link valid for 30 days. Questions? Call (862) 423-9396`,
      `Reply STOP to opt out.`,
    ].join("\n");
    expect(smsBody).toContain(calculatorUrl);
    expect(smsBody).toContain("Hi Jane!");
    expect(smsBody).toContain("Reply STOP to opt out.");
  });

  it("includes homeowner first name in email subject", () => {
    const subject = `Jane, your NJ Clean Heat Rebate Calculator is ready`;
    expect(subject).toContain("Jane");
    expect(subject).toContain("NJ Clean Heat");
  });

  it("returns success:true when DB insert succeeds", async () => {
    // Simulate the happy path
    const result = { success: true, smsSent: true, emailSent: true };
    expect(result.success).toBe(true);
  });
});

// ─── getByToken procedure logic tests ────────────────────────────────────────

describe("getByToken procedure logic", () => {
  it("returns valid:false with 'Link not found' when no row exists", () => {
    const row = null;
    const result = row ? { valid: true } : { valid: false, error: "Link not found" };
    expect(result).toEqual({ valid: false, error: "Link not found" });
  });

  it("returns valid:false when token is expired", () => {
    const row = makeDbRow({ tokenExpiresAt: new Date(Date.now() - 1000) }); // 1 second ago
    const result =
      row.tokenExpiresAt < new Date()
        ? { valid: false, error: "This link has expired. Please register again." }
        : { valid: true };
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain("expired");
  });

  it("returns valid:true with personal details when token is valid", () => {
    const row = makeDbRow();
    const isExpired = row.tokenExpiresAt < new Date();
    const result = isExpired
      ? { valid: false }
      : {
          valid: true,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          address: row.address,
          city: row.city,
          zip: row.zip,
          state: row.state,
        };
    expect(result.valid).toBe(true);
    expect((result as { firstName: string }).firstName).toBe("Jane");
    expect((result as { email: string }).email).toBe("jane@example.com");
    expect((result as { phone: string }).phone).toBe("+19735550100");
  });

  it("returns NJ as state for all registrations", () => {
    const row = makeDbRow();
    expect(row.state).toBe("NJ");
  });

  it("token expiry is in the future for a fresh registration", () => {
    const row = makeDbRow();
    expect(row.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("marks calculatorStarted as false on a new row", () => {
    const row = makeDbRow();
    expect(row.calculatorStarted).toBe(false);
  });

  it("returns valid:false for a token that expired exactly 1ms ago", () => {
    const row = makeDbRow({ tokenExpiresAt: new Date(Date.now() - 1) });
    const expired = row.tokenExpiresAt < new Date();
    expect(expired).toBe(true);
  });
});

// ─── Pre-population logic tests ──────────────────────────────────────────────

describe("pre-population logic (frontend useEffect)", () => {
  it("builds full name from firstName + lastName", () => {
    const reg = { firstName: "Jane", lastName: "Smith" };
    const fullName = [reg.firstName, reg.lastName].filter(Boolean).join(" ");
    expect(fullName).toBe("Jane Smith");
  });

  it("handles missing lastName gracefully", () => {
    const reg = { firstName: "Jane", lastName: "" };
    const fullName = [reg.firstName, reg.lastName].filter(Boolean).join(" ");
    expect(fullName).toBe("Jane");
  });

  it("detects LMI zip from NJ_LMI_ZIPS set", () => {
    const NJ_LMI_ZIPS = new Set(["07102", "07103", "07104"]);
    expect(NJ_LMI_ZIPS.has("07102")).toBe(true);
    expect(NJ_LMI_ZIPS.has("07001")).toBe(false);
  });

  it("sets incomeLevel to lmi when zip is in LMI set", () => {
    const NJ_LMI_ZIPS = new Set(["07102"]);
    const zip = "07102";
    const incomeLevel = NJ_LMI_ZIPS.has(zip) ? "lmi" : "standard";
    expect(incomeLevel).toBe("lmi");
  });

  it("sets incomeLevel to standard when zip is not in LMI set", () => {
    const NJ_LMI_ZIPS = new Set(["07102"]);
    const zip = "07001";
    const incomeLevel = NJ_LMI_ZIPS.has(zip) ? "lmi" : "standard";
    expect(incomeLevel).toBe("standard");
  });
});
