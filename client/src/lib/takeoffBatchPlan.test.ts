import { describe, expect, it } from "vitest";
import { planTakeoffBatches, type PlannedBatch } from "./takeoffBatchPlan";

type P = { pageNum: number };
const pages = (...nums: number[]): P[] => nums.map((pageNum) => ({ pageNum }));
const nums = (b: PlannedBatch<P>) => b.pages.map((p) => p.pageNum);

/** Injected measure: request size = overhead + Σ per-page cost (base or strong). */
function measurer(base: Record<number, number>, strong: Record<number, number>, overhead = 0) {
  return (ps: P[], useStrong: boolean) =>
    overhead + ps.reduce((s, p) => s + (useStrong ? strong[p.pageNum] : base[p.pageNum]), 0);
}
const flat = (v: number) => new Proxy({}, { get: () => v }) as Record<number, number>;

describe("planTakeoffBatches", () => {
  it("keeps 4 pages in one batch when the request is under budget", async () => {
    const plan = await planTakeoffBatches(pages(1, 2, 3, 4), {
      budgetBytes: 100,
      measure: measurer(flat(10), flat(10)),
    });
    expect(plan).toHaveLength(1);
    expect(nums(plan[0])).toEqual([1, 2, 3, 4]);
    expect(plan[0].strong).toBe(false);
  });

  it("splits a too-large 4-page group into 2-page batches", async () => {
    const plan = await planTakeoffBatches(pages(1, 2, 3, 4), {
      budgetBytes: 100,
      measure: measurer(flat(30), flat(30)), // 4×30=120 > 100, 2×30=60 ≤ 100
    });
    expect(plan.map(nums)).toEqual([[1, 2], [3, 4]]);
    expect(plan.every((b) => !b.strong)).toBe(true);
  });

  it("retries an oversized 2-page batch with stronger compression", async () => {
    const plan = await planTakeoffBatches(pages(1, 2, 3, 4), {
      budgetBytes: 100,
      measure: measurer(flat(60), flat(40)), // 2×60=120 > 100 base; 2×40=80 ≤ 100 strong
    });
    expect(plan.map(nums)).toEqual([[1, 2], [3, 4]]);
    expect(plan.every((b) => b.strong)).toBe(true);
  });

  it("falls back to single-page batches when 2 pages don't fit even compressed", async () => {
    const plan = await planTakeoffBatches(pages(1, 2), {
      budgetBytes: 100,
      measure: measurer(flat(60), flat(60)), // pair=120 both; single=60 ≤ 100
    });
    expect(plan.map(nums)).toEqual([[1], [2]]);
    expect(plan.every((b) => b.strong)).toBe(true);
  });

  it("fails clearly when a single page exceeds budget even strongly compressed", async () => {
    await expect(
      planTakeoffBatches(pages(7), {
        budgetBytes: 100,
        measure: measurer(flat(200), flat(150)), // single strong=150 > 100
      }),
    ).rejects.toThrow(/Page 7 is too large/);
  });

  it("respects group size for non-multiples of 4", async () => {
    const plan = await planTakeoffBatches(pages(1, 2, 3, 4, 5), {
      budgetBytes: 100,
      measure: measurer(flat(10), flat(10)),
    });
    expect(plan.map(nums)).toEqual([[1, 2, 3, 4], [5]]);
  });

  it("Quick mode (groupSize 2): pages 1–4 produce exactly two 2-page batches", async () => {
    const plan = await planTakeoffBatches(pages(1, 2, 3, 4), {
      budgetBytes: 100,
      groupSize: 2,
      measure: measurer(flat(10), flat(10)),
    });
    expect(plan.map(nums)).toEqual([[1, 2], [3, 4]]);
    expect(plan.every((b) => !b.strong)).toBe(true);
  });

  it("analyzes only the pages it is given (selection is the input)", async () => {
    const plan = await planTakeoffBatches(pages(3, 4), {
      budgetBytes: 100,
      groupSize: 2,
      measure: measurer(flat(10), flat(10)),
    });
    expect(plan.flatMap(nums)).toEqual([3, 4]);
  });

  it("handles fewer than a full group", async () => {
    const plan = await planTakeoffBatches(pages(1, 2), {
      budgetBytes: 100,
      measure: measurer(flat(10), flat(10)),
    });
    expect(plan.map(nums)).toEqual([[1, 2]]);
  });

  it("mixes strategies within a document", async () => {
    // pages 1–4 small (fit as a quad); pages 5–6 huge (need singles, strong).
    const base = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 90, 6: 90 };
    const strong = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 90, 6: 90 };
    const plan = await planTakeoffBatches(pages(1, 2, 3, 4, 5, 6), {
      budgetBytes: 100,
      measure: measurer(base, strong),
    });
    expect(plan.map(nums)).toEqual([[1, 2, 3, 4], [5], [6]]);
    expect(plan[0].strong).toBe(false);
    expect(plan[1].strong).toBe(true);
    expect(plan[2].strong).toBe(true);
  });
});
