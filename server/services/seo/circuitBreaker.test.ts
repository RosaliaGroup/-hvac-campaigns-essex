import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateCircuitBreakerSignals, type CircuitBreakerSignals } from "./circuitBreaker";

const clean: CircuitBreakerSignals = {
  vetoInLast7Days: false,
  revertOpenedInLast14Days: false,
  clicksDownPct: 0,
  lastTwoAutoLaneNetlifyStates: ["success", "success"],
  last3ContentDraftsCriticBlocked: [false, false, false],
};

describe("evaluateCircuitBreakerSignals (pure)", () => {
  it("does not pause when everything is clean", () => {
    expect(evaluateCircuitBreakerSignals(clean)).toEqual({ shouldPause: false, reason: null });
  });

  it("pauses on a veto in the last 7 days, before checking anything else", () => {
    const result = evaluateCircuitBreakerSignals({ ...clean, vetoInLast7Days: true });
    expect(result.shouldPause).toBe(true);
    expect(result.reason).toMatch(/veto/i);
  });

  it("pauses on a revert opened in the last 14 days", () => {
    const result = evaluateCircuitBreakerSignals({ ...clean, revertOpenedInLast14Days: true });
    expect(result.shouldPause).toBe(true);
    expect(result.reason).toMatch(/revert/i);
  });

  it("pauses when clicks are down more than 25%", () => {
    expect(evaluateCircuitBreakerSignals({ ...clean, clicksDownPct: 0.26 }).shouldPause).toBe(true);
    expect(evaluateCircuitBreakerSignals({ ...clean, clicksDownPct: 0.25 }).shouldPause).toBe(false); // exactly 25% is not "down more than 25%"
  });

  it("does not pause on a single Netlify failure — needs two in a row", () => {
    expect(evaluateCircuitBreakerSignals({ ...clean, lastTwoAutoLaneNetlifyStates: ["failure", "success"] }).shouldPause).toBe(false);
  });

  it("pauses when the last two auto-lane Netlify checks both failed", () => {
    const result = evaluateCircuitBreakerSignals({ ...clean, lastTwoAutoLaneNetlifyStates: ["failure", "failure"] });
    expect(result.shouldPause).toBe(true);
    expect(result.reason).toMatch(/netlify/i);
  });

  it("does not pause with fewer than two auto-lane batches on record yet", () => {
    expect(evaluateCircuitBreakerSignals({ ...clean, lastTwoAutoLaneNetlifyStates: ["failure"] }).shouldPause).toBe(false);
  });

  it("does not pause on 2 of 3 consecutive critic blocks — needs all 3", () => {
    expect(evaluateCircuitBreakerSignals({ ...clean, last3ContentDraftsCriticBlocked: [true, true, false] }).shouldPause).toBe(false);
  });

  it("pauses when the critic pass blocked the last 3 consecutive drafts", () => {
    const result = evaluateCircuitBreakerSignals({ ...clean, last3ContentDraftsCriticBlocked: [true, true, true] });
    expect(result.shouldPause).toBe(true);
    expect(result.reason).toMatch(/critic/i);
  });
});

vi.mock("./auditLog", () => ({ listAuditLog: vi.fn(), logAudit: vi.fn() }));
vi.mock("./autopublishStateRepo", () => ({ getAutopublishState: vi.fn(), updateAutopublishState: vi.fn() }));
vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { listAuditLog, logAudit } from "./auditLog";
import { getAutopublishState, updateAutopublishState } from "./autopublishStateRepo";
import { getDb } from "../../db";
import { checkCircuitBreakerConditions, pauseCircuitBreaker, resumeCircuitBreaker, CircuitBreakerNoteRequiredError } from "./circuitBreaker";

const cleanState = {
  id: 1,
  metaWarmupRemaining: 0,
  contentWarmupRemaining: 0,
  circuitBreakerPaused: false,
  circuitBreakerReason: null,
  circuitBreakerPausedAt: null,
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.mocked(listAuditLog).mockReset().mockResolvedValue([]);
  vi.mocked(logAudit).mockReset();
  vi.mocked(getAutopublishState).mockReset().mockResolvedValue(cleanState);
  vi.mocked(updateAutopublishState).mockReset();
  vi.mocked(getDb).mockReset().mockResolvedValue(null as never);
});

describe("checkCircuitBreakerConditions (I/O wrapper)", () => {
  it("short-circuits to the persisted reason once already paused, without re-querying signals", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...cleanState, circuitBreakerPaused: true, circuitBreakerReason: "prior reason" });
    const result = await checkCircuitBreakerConditions();
    expect(result).toEqual({ shouldPause: true, reason: "prior reason" });
    expect(listAuditLog).not.toHaveBeenCalled();
  });

  it("pauses and persists when a fresh veto is found", async () => {
    vi.mocked(listAuditLog).mockImplementation(async (filter) =>
      filter?.action === "vetoed" ? ([{ id: 1 }] as never) : [],
    );
    const result = await checkCircuitBreakerConditions();
    expect(result.shouldPause).toBe(true);
    expect(updateAutopublishState).toHaveBeenCalledWith(
      expect.objectContaining({ circuitBreakerPaused: true }),
    );
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "circuit_breaker_paused" }));
  });
});

describe("resumeCircuitBreaker", () => {
  it("requires a non-empty note", async () => {
    await expect(resumeCircuitBreaker("", 1)).rejects.toThrow(CircuitBreakerNoteRequiredError);
    await expect(resumeCircuitBreaker("   ", 1)).rejects.toThrow(CircuitBreakerNoteRequiredError);
    expect(updateAutopublishState).not.toHaveBeenCalled();
  });

  it("clears the pause and logs circuit_breaker_resumed with the note", async () => {
    await resumeCircuitBreaker("Confirmed the click-drop was a GSC reporting lag, not real.", 3);
    expect(updateAutopublishState).toHaveBeenCalledWith({
      circuitBreakerPaused: false,
      circuitBreakerReason: null,
      circuitBreakerPausedAt: null,
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 3, action: "circuit_breaker_resumed" }),
    );
  });
});
