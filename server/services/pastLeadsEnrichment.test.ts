import { describe, expect, it, vi } from "vitest";
vi.mock("./contactProfile/store", () => ({ addVerifiedSocialLink: vi.fn(async () => ({})) }));
vi.mock("./crm30DayAssignee", () => ({ resolveCadenceAssignee: vi.fn(async () => ({ user: { id: 7 } })) }));
const tasks = vi.hoisted(() => ({ inserted: [] as any[] }));
vi.mock("./crm30DayTasks", async orig => ({
  ...(await orig<typeof import("./crm30DayTasks")>()),
  insert30DayTask: vi.fn(async (t: any) => { tasks.inserted.push(t); return true; }),
}));
import { pastLeadsInGoodStanding, runPastLeadsCatchUp, runPastLeadsApollo, pastLeadsApolloWindow } from "./pastLeadsEnrichment";
import { addVerifiedSocialLink } from "./contactProfile/store";

const row = (over: any = {}) => ({ email: "pm@private.com", contactId: 2, introMessageId: "m", introThreadId: "t",
  introAt: new Date("2026-09-01T14:00:00Z"), status: "done", outcome: "attempted_no_answer", touchNumber: 2,
  name: "Chris Doe", company: "Private Co", title: "PM", ...over });

function fakeDb(rows: any[], opts: { alreadyRan?: boolean; looked?: string[]; linked?: number[]; contactPhone?: string | null; usedToday?: number } = {}) {
  const executed: string[] = [];
  const updates: any[] = [];
  const chain: any = {
    select: () => chain, from: () => chain, leftJoin: () => chain, where: () => chain,
    limit: async (n: number) => (n === 1 ? [{ phone: opts.contactPhone ?? null, name: "x", title: "y" }] : rows),
    update: () => ({ set: (v: any) => ({ where: async () => { updates.push(v); } }) }),
  };
  return { ...chain, executed, updates, execute: vi.fn(async (q: any) => {
    const text = JSON.stringify(q);
    executed.push(text);
    if (text.includes("INSERT IGNORE INTO crmBackfillRuns")) return [{ affectedRows: opts.alreadyRan ? 0 : 1 }];
    if (text.includes("SELECT email FROM crmApolloEmailLookups")) return [(opts.looked ?? []).map(email => ({ email }))];
    if (text.includes("SELECT contactId FROM crmContactProfiles")) return [(opts.linked ?? []).map(contactId => ({ contactId }))];
    if (text.includes("UPDATE crmContactEnrichmentJobs")) return [{ affectedRows: 1 }];
    if (text.includes("COUNT(*) AS n FROM crmApolloEmailLookups")) return [[{ n: opts.usedToday ?? 0 }]];
    return [{}];
  }) };
}

describe("past outreach leads", () => {
  it("keeps finished cadences, drops replies/opt-outs, not-interested, exclusions and public bodies", () => {
    const r = pastLeadsInGoodStanding([
      row(), row({ touchNumber: 3 }),
      row({ email: "replied@x.com", contactId: 3, status: "cancelled", outcome: null }),
      row({ email: "no@y.com", contactId: 4, outcome: "not_interested" }),
      row({ email: "fm@essexcountynj.gov", contactId: 5, company: "Essex County" }),
      row({ email: "dmcconnell@z.com", contactId: 6 }),
    ]);
    expect(r.total).toBe(5);
    expect(r.keep.map(k => k.email)).toEqual(["pm@private.com"]);
    expect(r.publicBodies).toBe(1);
    expect(r.stopped).toBe(3);
  });

  it("adds follow tasks spread 20 per business day and re-queues unmatched research", async () => {
    tasks.inserted.length = 0;
    const rows = Array.from({ length: 25 }, (_, i) => row({ email: `p${i}@co${i}.com`, contactId: 100 + i }));
    rows.push(row({ email: "has@follow.com", contactId: 300, touchNumber: 1, status: "open" }));
    rows.push(row({ email: "opted@out.com", contactId: 301 }));
    const queueResearch = vi.fn(async () => ({}));
    const db = fakeDb(rows);
    const s = await runPastLeadsCatchUp(db as any, { queueResearch, now: new Date("2026-10-30T20:00:00Z"),
      isSuppressed: async e => e === "opted@out.com" });
    expect(s).toMatchObject({ pastLeads: 27, inGoodStanding: 26, suppressed: 1, followTasksAdded: 25, researchQueued: 26, researchRequeued: 26 });
    expect(tasks.inserted[0]).toMatchObject({ touchNumber: 1, kind: "human", assignedToUserId: 7 });
    expect(tasks.inserted[19].dueAt.toISOString()).toBe("2026-10-30T20:00:00.000Z");
    expect(tasks.inserted[20].dueAt.getTime()).toBeGreaterThan(tasks.inserted[19].dueAt.getTime());
    expect(queueResearch).not.toHaveBeenCalledWith(301);
  });

  it("never runs the catch-up twice", async () => {
    const queueResearch = vi.fn();
    expect(await runPastLeadsCatchUp(fakeDb([row()], { alreadyRan: true }) as any, { queueResearch, isSuppressed: async () => false })).toBeNull();
    expect(queueResearch).not.toHaveBeenCalled();
  });

  it("only looks leads up in Apollo outside sending hours", () => {
    expect(pastLeadsApolloWindow(new Date("2026-10-30T14:00:00Z"))).toBe(false); // Fri 10 AM ET
    expect(pastLeadsApolloWindow(new Date("2026-10-30T21:30:00Z"))).toBe(true);  // Fri 5:30 PM ET
    expect(pastLeadsApolloWindow(new Date("2026-10-31T14:00:00Z"))).toBe(true);  // Saturday
  });

  it("saves LinkedIn and the company phone only for an exact verified email match", async () => {
    const rows = [row(), row({ email: "other@co.com", contactId: 9 }), row({ email: "done@co.com", contactId: 10 }), row({ email: "li@co.com", contactId: 11 })];
    const match = vi.fn(async (email: string) => email === "pm@private.com"
      ? { email: "pm@private.com", email_status: "verified", linkedin_url: "http://www.linkedin.com/in/chris", organization: { name: "Private Co", phone: "+1 973-555-0101" } }
      : { email: "someone.else@co.com", email_status: "verified", linkedin_url: "http://www.linkedin.com/in/wrong" });
    const db = fakeDb(rows, { looked: ["done@co.com"], linked: [11] });
    const out = await runPastLeadsApollo(db as any, { match, reserveReveal: async () => true,
      normalize: u => (u ? u.replace(/^http:/, "https:") : null), isSuppressed: async () => false,
      now: new Date("2026-10-31T14:00:00Z"), perDay: 10 });
    expect(match).toHaveBeenCalledTimes(2); // skipped: already looked up, already has LinkedIn
    expect(out).toMatchObject({ checked: 2, linkedinSaved: 1, phonesSaved: 1, notFound: 1 });
    expect(addVerifiedSocialLink).toHaveBeenCalledWith(2, expect.objectContaining({ url: "https://www.linkedin.com/in/chris" }));
    expect(db.updates).toContainEqual({ phone: "(973) 555-0101" });
  });

  it("stops at the shared Apollo cap and does nothing during sending hours", async () => {
    const match = vi.fn();
    const capped = await runPastLeadsApollo(fakeDb([row()]) as any, { match, reserveReveal: async () => false,
      normalize: () => null, isSuppressed: async () => false, now: new Date("2026-10-31T14:00:00Z") });
    expect(capped).toMatchObject({ checked: 0, capped: true });
    expect(await runPastLeadsApollo(fakeDb([row()]) as any, { match, reserveReveal: async () => true,
      normalize: () => null, isSuppressed: async () => false, now: new Date("2026-10-30T14:00:00Z") })).toBeNull();
    expect(match).not.toHaveBeenCalled();
  });

  it("resumes after a restart and stops once the day's lookups are used", async () => {
    const match = vi.fn(async () => null);
    const rows = [row(), row({ email: "b@co.com", contactId: 3 }), row({ email: "c@co.com", contactId: 4 })];
    const out = await runPastLeadsApollo(fakeDb(rows, { usedToday: 38 }) as any, { match, reserveReveal: async () => true,
      normalize: () => null, isSuppressed: async () => false, now: new Date("2026-10-31T14:00:00Z"), perDay: 40 });
    expect(out).toMatchObject({ checked: 2 });
    expect(await runPastLeadsApollo(fakeDb(rows, { usedToday: 40 }) as any, { match, reserveReveal: async () => true,
      normalize: () => null, isSuppressed: async () => false, now: new Date("2026-10-31T14:00:00Z"), perDay: 40 })).toBeNull();
  });
});
