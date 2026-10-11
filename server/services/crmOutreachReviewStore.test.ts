import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ getDb: vi.fn(), selectRows: vi.fn(), updateRows: vi.fn(), insertRows: vi.fn(), execute: vi.fn() }));
vi.mock("../db", () => ({ getDb: m.getDb }));
import { decideReviewDraft, queueReviewedCandidate } from "./crmOutreachReviewStore";
beforeEach(() => {
  vi.clearAllMocks();
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => m.selectRows(),
    update: () => ({ set: () => ({ where: () => m.updateRows() }) }),
    insert: () => ({ values: () => ({ onDuplicateKeyUpdate: () => m.insertRows() }) }),
    execute: m.execute,
  };
  m.getDb.mockResolvedValue(chain);
  m.execute.mockResolvedValue([]);
});
describe("outreach draft review decisions", () => {
  it("saves an approval and verifies database readback", async () => {
    m.selectRows.mockResolvedValueOnce([{ id: 4, status: "needs_human_approval" }])
      .mockResolvedValueOnce([{ id: 4, status: "approved" }]);
    m.updateRows.mockResolvedValue([{ affectedRows: 1 }]);
    expect((await decideReviewDraft(4, "approved")).status).toBe("approved");
  });
  it("rejects stale or concurrent decisions", async () => {
    m.selectRows.mockResolvedValue([{ id: 4, status: "needs_human_approval" }]);
    m.updateRows.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(decideReviewDraft(4, "rejected")).rejects.toThrow("concurrently");
  });
  it("does not overwrite previously reviewed drafts", async () => {
    m.selectRows.mockResolvedValue([{ id: 4, status: "approved" }]);
    await expect(decideReviewDraft(4, "rejected")).rejects.toThrow("already been reviewed");
    expect(m.updateRows).not.toHaveBeenCalled();
  });
  it("persists an intake draft and reads it back without sending", async () => {
    m.insertRows.mockResolvedValue([{ affectedRows: 1 }]);
    m.selectRows.mockResolvedValueOnce([{
      id: 8, email: "prospect@example.com", status: "needs_human_approval",
    }]);
    const queued = await queueReviewedCandidate({
      email: "Prospect@Example.com", company: "Example Properties",
      decisionMaker: "Facilities Manager", sourceUrl: "https://example.com",
      draftSubject: "HVAC introduction", draftBody: "Hello there",
      verifiedAt: new Date("2026-10-10T12:00:00Z"),
    });
    expect(queued.email).toBe("prospect@example.com");
    expect(queued.status).toBe("needs_human_approval");
    expect(m.insertRows).toHaveBeenCalledTimes(1);
    expect(m.updateRows).not.toHaveBeenCalled();
  });
  it("supports rejection with verified readback", async () => {
    m.selectRows.mockResolvedValueOnce([{ id: 8, status: "needs_human_approval" }])
      .mockResolvedValueOnce([{ id: 8, status: "rejected" }]);
    m.updateRows.mockResolvedValue([{ affectedRows: 1 }]);
    expect((await decideReviewDraft(8, "rejected")).status).toBe("rejected");
  });
});
