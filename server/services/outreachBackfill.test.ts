import { describe, expect, it, vi } from "vitest";
vi.mock("./contactProfile/store", () => ({ addVerifiedSocialLink: vi.fn(async () => ({})) }));
vi.mock("./crm30DayAssignee", () => ({ resolveCadenceAssignee: vi.fn(async () => ({ user: { id: 7 } })) }));
const tasks = vi.hoisted(() => ({ inserted: [] as any[], cancelled: [] as string[] }));
vi.mock("./crm30DayTasks", async orig => ({
  ...(await orig<typeof import("./crm30DayTasks")>()),
  insert30DayTask: vi.fn(async (t: any) => { tasks.inserted.push(t); return true; }),
  cancelOpen30DayTasks: vi.fn(async (e: string) => { tasks.cancelled.push(e); return 3; }),
}));
import { runOutreachBackfill } from "./outreachBackfill";
import { addVerifiedSocialLink } from "./contactProfile/store";

const lead = (over: any = {}) => ({ id: 1, email: "jane@acme.com", name: "Jane Smith", title: "PM", company: "Acme",
  state: "waiting", touchCount: 1, externalContactId: 5, emailMessageId: "m1", threadId: "t1",
  followUpAt: new Date("2026-10-31T19:00:00Z"), nextTouchAt: null, createdAt: new Date("2026-10-30T19:00:00Z"),
  verificationUrl: "https://www.linkedin.com/in/jane", ...over });

function fakeDb(introduced: any[], open: any[], alreadyRan = false) {
  let selects = 0;
  const chain: any = {
    select: () => chain, from: () => chain, leftJoin: () => chain, where: () => chain,
    limit: async () => (selects++ === 0 ? introduced : open),
  };
  return { ...chain, execute: vi.fn(async (q: any) => (JSON.stringify(q).includes("INSERT IGNORE INTO crmBackfillRuns") ? [{ affectedRows: alreadyRan ? 0 : 1 }] : [{}])) };
}

describe("one-time outreach catch-up", () => {
  it("adds missing tasks, saves LinkedIn and queues research for CRM-introduced leads", async () => {
    tasks.inserted.length = 0; tasks.cancelled.length = 0;
    const store = { scheduleHumanTasks: vi.fn(async () => 6) };
    const queueResearch = vi.fn(async () => ({}));
    const s = await runOutreachBackfill(fakeDb([lead()], []) as any, { store: store as any, queueResearch });
    expect(store.scheduleHumanTasks).toHaveBeenCalledTimes(1);
    expect((store.scheduleHumanTasks.mock.calls[0] as any)[2].toISOString()).toBe("2026-10-30T19:00:00.000Z");
    expect(addVerifiedSocialLink).toHaveBeenCalledWith(5, expect.objectContaining({ platform: "LinkedIn", url: "https://www.linkedin.com/in/jane" }));
    expect(queueResearch).toHaveBeenCalledWith(5);
    expect(s).toMatchObject({ introducedLeads: 1, tasksCreated: 6, linkedinSaved: 1, researchQueued: 1 });
  });
  it("cancels public bodies and adds a follow task for older open-cadence leads", async () => {
    tasks.inserted.length = 0; tasks.cancelled.length = 0;
    const open = [
      { email: "fm@essexcountynj.gov", contactId: 1, introMessageId: "a", introThreadId: "a", introAt: new Date(), name: "A B", company: "Essex County", title: "x" },
      { email: "pm@private.com", contactId: 2, introMessageId: "b", introThreadId: "b", introAt: new Date(), name: "C D", company: "Private Co", title: "PM" },
      { email: "pm@private.com", contactId: 2, introMessageId: "b", introThreadId: "b", introAt: new Date(), name: "C D", company: "Private Co", title: "PM" },
    ];
    const s = await runOutreachBackfill(fakeDb([], open) as any, { store: { scheduleHumanTasks: vi.fn() } as any, queueResearch: vi.fn() });
    expect(tasks.cancelled).toEqual(["fm@essexcountynj.gov"]);
    expect(tasks.inserted).toHaveLength(1);
    expect(tasks.inserted[0]).toMatchObject({ email: "pm@private.com", touchNumber: 1, kind: "human" });
    expect(s).toMatchObject({ openCadenceContacts: 2, publicCancelled: 3, followTasksForOlderLeads: 1 });
  });
  it("never runs twice", async () => {
    const store = { scheduleHumanTasks: vi.fn() };
    expect(await runOutreachBackfill(fakeDb([lead()], [], true) as any, { store: store as any, queueResearch: vi.fn() })).toBeNull();
    expect(store.scheduleHumanTasks).not.toHaveBeenCalled();
  });
});
