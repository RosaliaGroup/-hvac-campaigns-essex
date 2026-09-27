import { describe, it, expect, vi, beforeEach } from "vitest";

const rows: Record<number, any> = {
  1: { id: 1, reportId: 100, status: "accepted", targetQueue: "meta_lane", executedBatchId: 55, dismissReason: null },
  2: { id: 2, reportId: 100, status: "accepted", targetQueue: "page_pr_backlog", executedBatchId: 77, dismissReason: null },
  3: { id: 3, reportId: 100, status: "accepted", targetQueue: "content_queue", executedBatchId: null, dismissReason: null },
};

function makeDb() {
  return {
    select: () => ({
      from: () => ({
        where: (..._args: unknown[]) => ({
          limit: async () => {
            // naive: return whichever row was most recently "selected" via a shared cursor
            return [currentRow];
          },
          orderBy: async () => Object.values(rows).filter((r) => r.status === "accepted").sort((a, b) => b.id - a.id),
        }),
      }),
    }),
    update: () => ({ set: (patch: any) => ({ where: async () => { Object.assign(currentRow, patch); } }) }),
  };
}

let currentRow: any;

vi.mock("../../../db", () => ({ getDb: vi.fn(async () => makeDb()) }));
vi.mock("../bulkApprove", () => ({ revertBatch: vi.fn(async () => ({})) }));
vi.mock("./pagePr", () => ({ revertPagePRBatch: vi.fn(async () => ({})) }));
vi.mock("../auditLog", () => ({ logAudit: vi.fn(async () => {}) }));

import { revertBatch } from "../bulkApprove";
import { revertPagePRBatch } from "./pagePr";
import { revertItem } from "./revert";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revertItem dispatch (§3d: revert reuses the lane that executed the item)", () => {
  it("calls bulkApprove.revertBatch for a meta-lane-executed item", async () => {
    currentRow = { ...rows[1] };
    await revertItem(1, "not_now", null);
    expect(revertBatch).toHaveBeenCalledWith(55, null);
    expect(revertPagePRBatch).not.toHaveBeenCalled();
    expect(currentRow.status).toBe("expired");
  });

  it("calls pagePr.revertPagePRBatch for a page-PR-executed item", async () => {
    currentRow = { ...rows[2] };
    await revertItem(2, "not_now", null);
    expect(revertPagePRBatch).toHaveBeenCalledWith(77, null);
    expect(revertBatch).not.toHaveBeenCalled();
  });

  it("touches no lane for a content-queue-only item (nothing to revert beyond the row)", async () => {
    currentRow = { ...rows[3] };
    await revertItem(3, "not_now", null);
    expect(revertBatch).not.toHaveBeenCalled();
    expect(revertPagePRBatch).not.toHaveBeenCalled();
    expect(currentRow.status).toBe("expired");
  });
});
