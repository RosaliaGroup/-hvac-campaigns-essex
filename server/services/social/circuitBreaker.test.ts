import { describe, it, expect } from "vitest";
import { evaluateSocialCircuitBreakerSignals } from "./circuitBreaker";

describe("evaluateSocialCircuitBreakerSignals", () => {
  it("pauses on 2+ vetoes in 7 days", () => {
    const result = evaluateSocialCircuitBreakerSignals({ vetoesInLast7Days: 2, authFailureDetected: false, complaintFlaggedComment: false, metaPolicyWarning: false });
    expect(result.shouldPause).toBe(true);
  });

  it("does not pause on a single veto", () => {
    const result = evaluateSocialCircuitBreakerSignals({ vetoesInLast7Days: 1, authFailureDetected: false, complaintFlaggedComment: false, metaPolicyWarning: false });
    expect(result.shouldPause).toBe(false);
  });

  it("pauses on an auth failure", () => {
    const result = evaluateSocialCircuitBreakerSignals({ vetoesInLast7Days: 0, authFailureDetected: true, complaintFlaggedComment: false, metaPolicyWarning: false });
    expect(result.shouldPause).toBe(true);
  });

  it("pauses on a complaint-flagged comment", () => {
    const result = evaluateSocialCircuitBreakerSignals({ vetoesInLast7Days: 0, authFailureDetected: false, complaintFlaggedComment: true, metaPolicyWarning: false });
    expect(result.shouldPause).toBe(true);
  });

  it("pauses on a Meta policy warning", () => {
    const result = evaluateSocialCircuitBreakerSignals({ vetoesInLast7Days: 0, authFailureDetected: false, complaintFlaggedComment: false, metaPolicyWarning: true });
    expect(result.shouldPause).toBe(true);
  });

  it("does not pause with a clean signal set", () => {
    const result = evaluateSocialCircuitBreakerSignals({ vetoesInLast7Days: 0, authFailureDetected: false, complaintFlaggedComment: false, metaPolicyWarning: false });
    expect(result.shouldPause).toBe(false);
    expect(result.reason).toBeNull();
  });
});
