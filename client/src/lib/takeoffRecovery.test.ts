import { describe, expect, it, vi } from "vitest";
import { runBatchWithRecovery, halve, type RecoveryDeps } from "./takeoffRecovery";

type P = { pageNum: number };
const pages = (...n: number[]): P[] => n.map((pageNum) => ({ pageNum }));
const timeoutErr = () =>
  new Error(
    "The server returned a non-JSON response (HTTP 504, text/html) (empty response). The API gateway did not return a response — please try again.",
  );
const isTimeout = (e: unknown) => e instanceof Error && /HTTP 50[234]|gateway/i.test(e.message);

function deps(send: RecoveryDeps<P>["send"], onEvent?: RecoveryDeps<P>["onEvent"]): RecoveryDeps<P> {
  return { send, isTimeout, subdivide: halve, onEvent };
}

describe("runBatchWithRecovery", () => {
  it("returns immediately on success (single send)", async () => {
    const send = vi.fn(async () => "ok");
    const parts = await runBatchWithRecovery(pages(1, 2), false, deps(send));
    expect(parts).toEqual([{ pages: pages(1, 2), text: "ok", strong: false }]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reuses a late completion by retrying the SAME batch once — no subdivide, no rebill", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(timeoutErr()) // proxy 504 while server still running
      .mockResolvedValueOnce("late-cached"); // retry (same id) → server cache hit
    const events: string[] = [];
    const parts = await runBatchWithRecovery(
      pages(1, 2),
      false,
      deps(send as any, (e) => events.push(e.type)),
    );
    expect(parts).toEqual([{ pages: pages(1, 2), text: "late-cached", strong: false }]);
    expect(send).toHaveBeenCalledTimes(2);
    // Both attempts used the SAME pages → same deterministic id → cache reuse.
    expect(send.mock.calls[0][0]).toEqual(pages(1, 2));
    expect(send.mock.calls[1][0]).toEqual(pages(1, 2));
    expect(events).toEqual(["timeout-retry"]);
  });

  it("subdivides once (new ids) when the retry also times out", async () => {
    const send = vi.fn(async (ps: P[]) => {
      if (ps.length === 2) throw timeoutErr(); // full 2-page batch always times out
      return `sub-${ps[0].pageNum}`; // 1-page sub-batches succeed
    });
    const events: Array<{ type: string; parts?: number }> = [];
    const parts = await runBatchWithRecovery(pages(1, 2), false, deps(send, (e) => events.push(e)));
    expect(parts.map((p) => p.text)).toEqual(["sub-1", "sub-2"]);
    expect(parts.every((p) => p.strong)).toBe(true); // retries use stronger compression
    expect(send).toHaveBeenCalledTimes(4); // full x2 + sub x2
    expect(events).toContainEqual({ type: "subdivide", parts: 2 });
  });

  it("gives up when a single page keeps timing out (cannot subdivide)", async () => {
    const send = vi.fn(async () => {
      throw timeoutErr();
    });
    const events: string[] = [];
    await expect(
      runBatchWithRecovery(pages(7), false, deps(send, (e) => events.push(e.type))),
    ).rejects.toThrow(/504|gateway/);
    expect(send).toHaveBeenCalledTimes(2); // attempt + one retry, then no split possible
    expect(events).toEqual(["timeout-retry", "give-up"]);
  });

  it("bubbles a non-timeout error without retrying", async () => {
    const send = vi.fn(async () => {
      throw new Error("The AI service is out of credits.");
    });
    await expect(runBatchWithRecovery(pages(1, 2), false, deps(send))).rejects.toThrow(/out of credits/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never exceeds one recovery cycle (a sub-batch timeout is not recovered again)", async () => {
    const send = vi.fn(async () => {
      throw timeoutErr(); // everything times out
    });
    await expect(runBatchWithRecovery(pages(1, 2), false, deps(send))).rejects.toThrow(/504|gateway/);
    // full attempt + full retry (2) + first sub-batch attempt (1) then propagate = 3
    expect(send).toHaveBeenCalledTimes(3);
  });
});

describe("halve", () => {
  it("splits a multi-page batch into two halves", () => {
    expect(halve(pages(1, 2)).map((g) => g.map((p) => p.pageNum))).toEqual([[1], [2]]);
    expect(halve(pages(1, 2, 3, 4)).map((g) => g.map((p) => p.pageNum))).toEqual([[1, 2], [3, 4]]);
  });
  it("returns [] for a single page (not splittable)", () => {
    expect(halve(pages(9))).toEqual([]);
  });
});
