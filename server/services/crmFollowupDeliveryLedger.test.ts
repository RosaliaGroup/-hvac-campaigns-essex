import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
import { claimFollowupDelivery, confirmFollowupDelivery, quarantineFollowupDelivery } from "./crmFollowupDeliveryLedger";

type Entry = { taskId: number; state: string; gmailMessageId: string | null; gmailThreadId: string | null; note: string | null };
let entries: Map<number, Entry>;
let lastId: number;
beforeEach(() => {
  entries = new Map();
  lastId = 0;
  const db = {
    execute: vi.fn().mockResolvedValue([]),
    insert: () => ({ values: (row: { taskId: number; state: string }) => ({
      onDuplicateKeyUpdate: async () => {
        if (entries.has(row.taskId)) return [{ affectedRows: 0 }];
        entries.set(row.taskId, { ...row, gmailMessageId: null, gmailThreadId: null, note: null });
        return [{ affectedRows: 1 }];
      },
    }) }),
    select: () => ({ from: () => ({ where: () => ({
      limit: async () => [entries.get(lastId)].filter(Boolean),
    }) }) }),
    update: () => ({ set: (patch: Partial<Entry>) => ({ where: async () => {
      const row = entries.get(lastId);
      if (!row || row.state !== "claimed") return [{ affectedRows: 0 }];
      entries.set(lastId, { ...row, ...patch });
      return [{ affectedRows: 1 }];
    } }) }),
  };
  mocks.getDb.mockResolvedValue(db);
});
describe("CRM follow-up delivery ledger", () => {
  it("refuses invalid task IDs before database access", async () => {
    await expect(claimFollowupDelivery(-1)).rejects.toThrow("Invalid task ID");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("allows exactly one claim for the same task", async () => {
    lastId = 12;
    const results = await Promise.all(Array.from({ length: 8 }, () => claimFollowupDelivery(12)));
    expect(results.filter(r => r.claimed)).toHaveLength(1);
    expect(entries.size).toBe(1);
  });
  it("requires a real Gmail message ID and preserves confirmation", async () => {
    lastId = 14;
    await claimFollowupDelivery(14);
    await expect(confirmFollowupDelivery(14, "")).rejects.toThrow("Gmail message ID required");
    const result = await confirmFollowupDelivery(14, "gmail-message-14", "thread-14");
    expect(result.state).toBe("sent_confirmed");
    expect(result.gmailMessageId).toBe("gmail-message-14");
    expect((await claimFollowupDelivery(14)).claimed).toBe(false);
    await expect(confirmFollowupDelivery(14, "another-id")).rejects.toThrow("not in confirmable state");
  });
  it("quarantines an uncertain outcome and never reclaims it", async () => {
    lastId = 16;
    await claimFollowupDelivery(16);
    await quarantineFollowupDelivery(16, "Gmail response timed out");
    expect(entries.get(16)?.state).toBe("needs_reconciliation");
    expect((await claimFollowupDelivery(16)).claimed).toBe(false);
  });
});
