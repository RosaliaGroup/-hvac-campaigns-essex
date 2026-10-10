import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), suppressed: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.db }));
vi.mock("./outreachSuppression", () => ({ isOutreachSuppressed: mocks.suppressed }));
import { checkOutreachReviewCandidate, type ReviewCandidate } from "./crmOutreachReviewQueue";
const candidate: ReviewCandidate = {
  email: "Prospect@Example.com", company: "Example Properties",
  decisionMaker: "Facilities Director", sourceUrl: "https://example.com/team",
  draftSubject: "HVAC service", draftBody: "Hello, we'd like to introduce our service.",
  verifiedAt: new Date("2026-10-10T12:00:00Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.mockResolvedValue({});
  mocks.suppressed.mockResolvedValue(false);
});
describe("CRM outreach review eligibility", () => {
  it("requires human approval for verified new candidates", async () => {
    expect(await checkOutreachReviewCandidate(candidate, async () => false, async () => false))
      .toEqual({ eligible: true, normalizedEmail: "prospect@example.com", state: "needs_human_approval" });
  });
  it("rejects suppressed recipients before checking other sources", async () => {
    mocks.suppressed.mockResolvedValue(true);
    expect((await checkOutreachReviewCandidate(candidate, async () => false, async () => false)).eligible).toBe(false);
  });
  it("rejects previous outreach and unsubscribes", async () => {
    expect((await checkOutreachReviewCandidate(candidate, async () => true, async () => false)).eligible).toBe(false);
    expect((await checkOutreachReviewCandidate(candidate, async () => false, async () => true)).eligible).toBe(false);
  });
  it("rejects incomplete verification and drafts", async () => {
    expect((await checkOutreachReviewCandidate({ ...candidate, sourceUrl: "" }, async () => false, async () => false)).eligible).toBe(false);
    expect((await checkOutreachReviewCandidate({ ...candidate, draftBody: "" }, async () => false, async () => false)).eligible).toBe(false);
  });
});
