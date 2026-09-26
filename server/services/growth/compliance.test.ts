/**
 * Guardrail tests (docs/growth-system-spec.md §11): consent/DNC/quiet-hours/caps
 * enforcement, with fixtures — no real DB, no network.
 */
import "../../testEnvSetup"; // MUST be first
import { describe, it, expect, beforeEach } from "vitest";
import { gateGrowthSend, isTerminalGrowthBlock } from "./compliance";

/** Fake db supporting exactly the query shape touchLedger.countCadenceChannelAttempts
 *  issues: select({n}).from(growthTouches).where(...) — no further chain calls. */
function fakeDbWithAttemptCount(count: number) {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ n: count }]),
      }),
    }),
  } as unknown as Parameters<typeof gateGrowthSend>[0]["db"];
}

function fakeDbThatThrows() {
  return {
    select: () => ({
      from: () => ({
        where: () => { throw new Error("db down"); },
      }),
    }),
  } as unknown as Parameters<typeof gateGrowthSend>[0]["db"];
}

const INSIDE_HOURS = new Date("2026-01-14T15:00:00Z"); // Wed 10:00 AM ET
const OUTSIDE_HOURS = new Date("2026-01-18T17:00:00Z"); // Sunday noon ET

beforeEach(() => {
  delete process.env.DNC_SCRUB_PROVIDER; // NullDncProvider (always unknown) — the default
});

describe("gateGrowthSend — consent (§0/§11 National-DNC default-safe rule)", () => {
  it("blocks consent=unknown for sms — no automated send to an unverified contact", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(0), channel: "sms", phone: "8624239396",
      consentStatus: "unknown", now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: false, reason: "consent_unknown" });
  });

  it("blocks consent=unknown for call too", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(0), channel: "call", phone: "8624239396",
      consentStatus: "unknown", now: INSIDE_HOURS,
    });
    expect(result.ok).toBe(false);
  });

  it("allows consent=opt_in inside calling hours with no cap hit", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(0), channel: "sms", phone: "8624239396",
      consentStatus: "opt_in", now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: true });
  });

  it("allows consent=customer inside calling hours", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(0), channel: "call", phone: "8624239396",
      consentStatus: "customer", now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: true });
  });

  it("no phone at all is blocked before any DB read", async () => {
    const result = await gateGrowthSend({
      db: fakeDbThatThrows(), channel: "sms", phone: null, consentStatus: "customer", now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: false, reason: "no_phone" });
  });
});

describe("gateGrowthSend — calling hours (§0/§1.1: hold, don't drop)", () => {
  it("holds (does not block terminally) outside the 9-19 ET Mon-Sat window", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(0), channel: "sms", phone: "8624239396",
      consentStatus: "opt_in", now: OUTSIDE_HOURS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("outside_calling_hours");
      expect(result.holdUntil).toBeInstanceOf(Date);
      expect(result.holdUntil!.getTime()).toBeGreaterThan(OUTSIDE_HOURS.getTime());
    }
  });
});

describe("gateGrowthSend — per-contact per-campaign caps (§0/§11)", () => {
  it("blocks the 3rd sms attempt for the same cadence (max 3 texts)", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(3), channel: "sms", phone: "8624239396",
      consentStatus: "opt_in", cadenceId: 1, now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: false, reason: "cap_reached" });
  });

  it("allows the 2nd sms attempt (count=1, under the cap of 3)", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(1), channel: "sms", phone: "8624239396",
      consentStatus: "opt_in", cadenceId: 1, now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: true });
  });

  it("blocks the 3rd call attempt for the same cadence (max 2 calls)", async () => {
    const result = await gateGrowthSend({
      db: fakeDbWithAttemptCount(2), channel: "call", phone: "8624239396",
      consentStatus: "customer", cadenceId: 1, now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: false, reason: "cap_reached" });
  });

  it("skips the cap check entirely when no cadenceId is given (one-off sends, e.g. review engine)", async () => {
    const result = await gateGrowthSend({
      db: fakeDbThatThrows(), channel: "sms", phone: "8624239396", consentStatus: "customer", now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("gateGrowthSend — fails closed on a DB error", () => {
  it("blocks (never sends) when the cap check throws", async () => {
    const result = await gateGrowthSend({
      db: fakeDbThatThrows(), channel: "sms", phone: "8624239396",
      consentStatus: "opt_in", cadenceId: 1, now: INSIDE_HOURS,
    });
    expect(result).toEqual({ ok: false, reason: "db_error" });
  });
});

describe("isTerminalGrowthBlock", () => {
  it("consent_unknown, national_dnc, and no_phone are terminal", () => {
    expect(isTerminalGrowthBlock("consent_unknown")).toBe(true);
    expect(isTerminalGrowthBlock("national_dnc")).toBe(true);
    expect(isTerminalGrowthBlock("no_phone")).toBe(true);
  });
  it("outside_calling_hours, cap_reached, and db_error are NOT terminal (retry later)", () => {
    expect(isTerminalGrowthBlock("outside_calling_hours")).toBe(false);
    expect(isTerminalGrowthBlock("cap_reached")).toBe(false);
    expect(isTerminalGrowthBlock("db_error")).toBe(false);
  });
});
