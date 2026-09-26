/**
 * Guardrail test (docs/growth-system-spec.md §11): "complaint rate > 0.3% or
 * bounce > 5% pauses the channel." Pure evaluator — no DB.
 */
import { describe, it, expect } from "vitest";
import { evaluateGrowthCircuitBreakerSignals } from "./circuitBreaker";

describe("evaluateGrowthCircuitBreakerSignals", () => {
  it("does not pause with no volume", () => {
    const r = evaluateGrowthCircuitBreakerSignals({ smsSentLast7d: 0, smsStopLast7d: 0, emailSentLast7d: 0, emailFailedLast7d: 0 });
    expect(r.smsPaused).toBe(false);
    expect(r.emailPaused).toBe(false);
  });

  it("pauses SMS when the STOP rate exceeds 0.3%", () => {
    // 2/500 = 0.4% > 0.3%
    const r = evaluateGrowthCircuitBreakerSignals({ smsSentLast7d: 500, smsStopLast7d: 2, emailSentLast7d: 0, emailFailedLast7d: 0 });
    expect(r.smsPaused).toBe(true);
    expect(r.smsReason).toMatch(/0.3%/);
  });

  it("does not pause SMS exactly at the boundary (1/500 = 0.2%)", () => {
    const r = evaluateGrowthCircuitBreakerSignals({ smsSentLast7d: 500, smsStopLast7d: 1, emailSentLast7d: 0, emailFailedLast7d: 0 });
    expect(r.smsPaused).toBe(false);
  });

  it("pauses email when the failure rate exceeds 5%", () => {
    // 6/100 = 6% > 5%
    const r = evaluateGrowthCircuitBreakerSignals({ smsSentLast7d: 0, smsStopLast7d: 0, emailSentLast7d: 94, emailFailedLast7d: 6 });
    expect(r.emailPaused).toBe(true);
    expect(r.emailReason).toMatch(/5%/);
  });

  it("does not pause email at 5% or below", () => {
    const r = evaluateGrowthCircuitBreakerSignals({ smsSentLast7d: 0, smsStopLast7d: 0, emailSentLast7d: 95, emailFailedLast7d: 5 });
    expect(r.emailPaused).toBe(false);
  });

  it("sms and email breakers are independent", () => {
    const r = evaluateGrowthCircuitBreakerSignals({ smsSentLast7d: 500, smsStopLast7d: 5, emailSentLast7d: 100, emailFailedLast7d: 0 });
    expect(r.smsPaused).toBe(true);
    expect(r.emailPaused).toBe(false);
  });
});
