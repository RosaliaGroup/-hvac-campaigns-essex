/**
 * Guardrail test: the credential-presence gate is separate from GROWTH_CALLS_ENABLED
 * and defaults to "not configured" — production has none of these three env vars
 * set today. isVapiOutboundConfigured() is the single source of truth the cadence
 * engine and the §10 scoreboard both read.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isVapiOutboundConfigured } from "./outboundCall";

const KEYS = ["VAPI_API_KEY", "VAPI_OUTBOUND_ASSISTANT_ID", "VAPI_PHONE_NUMBER_ID"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("isVapiOutboundConfigured", () => {
  it("false when none of the three env vars are set (today's production state)", () => {
    expect(isVapiOutboundConfigured()).toBe(false);
  });

  it("false when only some are set", () => {
    process.env.VAPI_API_KEY = "key";
    process.env.VAPI_OUTBOUND_ASSISTANT_ID = "assistant";
    // VAPI_PHONE_NUMBER_ID intentionally left unset
    expect(isVapiOutboundConfigured()).toBe(false);
  });

  it("false when a var is set but blank", () => {
    process.env.VAPI_API_KEY = "key";
    process.env.VAPI_OUTBOUND_ASSISTANT_ID = "assistant";
    process.env.VAPI_PHONE_NUMBER_ID = "   ";
    expect(isVapiOutboundConfigured()).toBe(false);
  });

  it("true only when all three are set and non-empty", () => {
    process.env.VAPI_API_KEY = "key";
    process.env.VAPI_OUTBOUND_ASSISTANT_ID = "assistant";
    process.env.VAPI_PHONE_NUMBER_ID = "phone-number-id";
    expect(isVapiOutboundConfigured()).toBe(true);
  });
});
