import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  send: vi.fn(),
  hasSent: vi.fn(),
  stopped: vi.fn(),
  sms: vi.fn(),
}));
vi.mock("./prospectGmail", () => ({
  prospectMailbox: async () => ({
    send: m.send,
    hasSent: m.hasSent,
    recipientStopped: m.stopped,
  }),
}));
vi.mock("./growth/circuitBreaker", () => ({
  checkGrowthCircuitBreaker: async () => ({
    emailPaused: false,
    smsPaused: false,
  }),
}));
vi.mock("./growth/sms", () => ({ sendGrowthSms: m.sms }));
vi.mock("./growth/cadenceEngine", () => ({ growthSmsEnabled: () => true }));
vi.mock("./crmCommunications", () => ({
  logCommunication: vi.fn(),
  upsertExternalContact: vi.fn(),
}));
vi.mock("./growth/touchLedger", () => ({ recordGrowthTouch: vi.fn() }));
vi.mock("./saveVerifiedProspect", () => ({ saveVerifiedProspect: vi.fn() }));
import { dispatchProspects } from "./prospectWorkflow";
import {
  prospectWorkflowSettings,
  prospectWorkflowQueue,
} from "../../drizzle/schema";
const base = {
  id: 1,
  name: "Jane Smith",
  company: "Example PM",
  title: "Property Manager",
  email: "jane@example.com",
  state: "queued",
  externalContactId: 2,
  leadId: 3,
  ownerId: 4,
  touchCount: 0,
  emailBody: "Hello",
  threadId: null,
  smsConsent: false,
  smsState: "consent_required",
};
function fakeDb(row: any) {
  const patches: any[] = [];
  let queueReads = 0;
  return {
    patches,
    db: {
      select: () => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () =>
              table === prospectWorkflowQueue
                ? queueReads++ === 0
                  ? [row]
                  : []
                : [],
            then: (resolve: any) =>
              resolve(
                table === prospectWorkflowSettings ? [{ enabled: true }] : []
              ),
          }),
        }),
      }),
      update: () => ({
        set: (patch: any) => ({
          where: async () => {
            patches.push(patch);
            return [{ affectedRows: 1 }];
          },
        }),
      }),
      insert: () => ({ values: async () => [{ insertId: 1 }] }),
    } as any,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.stopped.mockResolvedValue(null);
  m.hasSent.mockResolvedValue(false);
  m.send.mockResolvedValue({ id: "sent-1", threadId: "thread-1" });
});
describe("CRM dispatch safeguards", () => {
  it("never sends a second introduction to an address in Gmail Sent", async () => {
    m.hasSent.mockResolvedValue(true);
    const f = fakeDb(base);
    await dispatchProspects(f.db, new Date());
    expect(m.send).not.toHaveBeenCalled();
    expect(f.patches).toContainEqual(
      expect.objectContaining({ state: "duplicate" })
    );
  });
  it("hands a reply to a human without sending or nurturing", async () => {
    m.stopped.mockResolvedValue("replied");
    const f = fakeDb(base);
    await dispatchProspects(f.db, new Date());
    expect(m.send).not.toHaveBeenCalled();
    expect(f.patches).toContainEqual(
      expect.objectContaining({ state: "replied", nextTouchAt: null })
    );
  });
  it("does not text cold prospects without recorded consent", async () => {
    const f = fakeDb({ ...base, state: "waiting", phone: "+19735551234" });
    await dispatchProspects(f.db, new Date());
    expect(m.sms).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it("leaves an ambiguous Gmail send claimed for manual review, not retry", async () => {
    m.send.mockRejectedValue(new Error("timeout"));
    const f = fakeDb(base);
    await dispatchProspects(f.db, new Date());
    expect(f.patches).toContainEqual(
      expect.objectContaining({ state: "email_sending" })
    );
    expect(f.patches).toContainEqual({ lastError: "timeout" });
    expect(f.patches.some(p => p.state === "queued")).toBe(false);
  });
  it("records provider-confirmed intro and assigns tomorrow follow-up", async () => {
    const f = fakeDb(base);
    const now = new Date("2026-10-09T14:00:00Z");
    await dispatchProspects(f.db, now);
    expect(f.patches).toContainEqual(
      expect.objectContaining({
        state: "waiting",
        emailMessageId: "sent-1",
        followUpAt: new Date(now.getTime() + 86400000),
      })
    );
  });
});
