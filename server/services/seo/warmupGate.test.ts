import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("./autopublishStateRepo", () => ({
  getAutopublishState: vi.fn(),
  updateAutopublishState: vi.fn(),
}));

import { logAudit } from "./auditLog";
import { getAutopublishState, updateAutopublishState } from "./autopublishStateRepo";
import { isWarmedUp, warmupRemaining, advanceWarmup, resetWarmupByHalf, WARMUP_DEFAULTS } from "./warmupGate";

const baseState = {
  id: 1,
  metaWarmupRemaining: 2,
  contentWarmupRemaining: 8,
  circuitBreakerPaused: false,
  circuitBreakerReason: null,
  circuitBreakerPausedAt: null,
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.mocked(logAudit).mockReset();
  vi.mocked(getAutopublishState).mockReset();
  vi.mocked(updateAutopublishState).mockReset();
});

describe("isWarmedUp / warmupRemaining", () => {
  it("meta lane is not warmed up at the default of 2", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState });
    expect(await isWarmedUp("meta")).toBe(false);
    expect(await warmupRemaining("meta")).toBe(2);
  });

  it("is warmed up once remaining hits 0", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, metaWarmupRemaining: 0 });
    expect(await isWarmedUp("meta")).toBe(true);
  });
});

describe("advanceWarmup", () => {
  it("decrements the correct lane's field and logs warmup_advanced", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, metaWarmupRemaining: 2 });
    const after = await advanceWarmup("meta", 5);
    expect(after).toBe(1);
    expect(updateAutopublishState).toHaveBeenCalledWith({ metaWarmupRemaining: 1 });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 5,
        action: "warmup_advanced",
        before: { lane: "meta", remaining: 2 },
        after: { lane: "meta", remaining: 1 },
      }),
    );
  });

  it("never goes below zero", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, contentWarmupRemaining: 0 });
    const after = await advanceWarmup("content", null);
    expect(after).toBe(0);
    expect(updateAutopublishState).toHaveBeenCalledWith({ contentWarmupRemaining: 0 });
  });
});

describe("resetWarmupByHalf", () => {
  it("meta lane: fully warmed (0) -> +1 (ceil(2/2)) after a veto", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, metaWarmupRemaining: 0 });
    const after = await resetWarmupByHalf("meta", "veto", null);
    expect(after).toBe(1);
  });

  it("content lane: at 2 remaining -> +4 (ceil(8/2)) after a revert = 6", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, contentWarmupRemaining: 2 });
    const after = await resetWarmupByHalf("content", "revert", null);
    expect(after).toBe(6);
  });

  it("never exceeds the lane's default (caps rather than overshoots)", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, metaWarmupRemaining: 2 });
    const after = await resetWarmupByHalf("meta", "veto", null);
    expect(after).toBe(WARMUP_DEFAULTS.meta); // 2 + 1 would be 3, capped at 2
  });

  it("logs warmup_reset with the reason", async () => {
    vi.mocked(getAutopublishState).mockResolvedValue({ ...baseState, contentWarmupRemaining: 0 });
    await resetWarmupByHalf("content", "revert", 9);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 9,
        action: "warmup_reset",
        before: { lane: "content", remaining: 0, reason: "revert" },
      }),
    );
  });
});
