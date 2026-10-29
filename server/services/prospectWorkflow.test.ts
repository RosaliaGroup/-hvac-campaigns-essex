import { describe, expect, it, vi } from "vitest";
vi.mock("../integrations/google/calendar", () => ({ googleCalendarProvider: { getValidAccessToken: vi.fn() } }));
import { runCycle, followUpBody, type CycleStore, type QueueRow, type HoldReason } from "./prospectCycle";
import { GmailStopError, GmailIncompleteError, type ProspectMailbox, type ThreadState } from "./prospectGmail";
import { introduction } from "../../shared/prospectWorkflow";

const DAY = 86_400_000;
const WED_11AM = new Date("2026-10-28T15:02:00Z");
const SAT_11AM = new Date("2026-10-31T15:02:00Z");
const WED_5PM = new Date("2026-10-28T21:02:00Z");

let nextId = 1;
function followUp(over: Partial<QueueRow> = {}): QueueRow {
  const introAt = new Date(WED_11AM.getTime() - 20 * DAY);
  return {
    id: nextId++, email: `p${nextId}@acme${nextId}.com`, name: "Jane Smith", company: `Acme ${nextId}`, title: "Property Manager",
    state: "waiting", touchCount: 1, threadId: `t${nextId}`, emailBody: "intro", ownerId: 7, leadId: 50 + nextId,
    externalContactId: 80 + nextId, followUpAt: new Date(introAt.getTime() + DAY), nextTouchAt: introAt,
    verificationUrl: "https://example.com/team", ...over,
  };
}
function intro(over: Partial<QueueRow> = {}): QueueRow {
  return followUp({ state: "queued", touchCount: 0, threadId: null, followUpAt: null, nextTouchAt: new Date(0), emailBody: "Hello intro", ...over });
}

function makeStore(rows: QueueRow[], opts: { enabled?: boolean; claimed?: Set<string>; suppressed?: string[]; holds?: Record<string, HoldReason>; crmReadback?: boolean; research?: () => QueueRow[] } = {}) {
  const claimed = opts.claimed ?? new Set<string>();
  const log: { suppressions: string[]; notifications: string[]; summaries: string[]; logged: string[]; researchCalls: number; tasks: string[]; cancelled: string[]; needed?: number } =
    { suppressions: [], notifications: [], summaries: [], logged: [], researchCalls: 0, tasks: [], cancelled: [] };
  const store: CycleStore = {
    claimHour: async hour => (claimed.has(hour) ? false : (claimed.add(hour), true)),
    config: async () => ({ enabled: opts.enabled ?? true, ownerId: 7 }),
    followUpPool: async () => rows.filter(r => ["waiting", "nurture"].includes(r.state) && r.touchCount >= 1 && r.touchCount <= 4 && r.followUpAt),
    queuedIntros: async limit => rows.filter(r => r.state === "queued").slice(0, limit),
    research: async (_owner: number, needed: number) => { log.researchCalls++; log.needed = needed; const added = opts.research?.() ?? []; rows.push(...added); return added.length; },
    isSuppressed: async e => (opts.suppressed ?? []).includes(e),
    recordSuppression: async e => { log.suppressions.push(e); },
    relationshipHold: async row => opts.holds?.[row.email] ?? null,
    existingLeadFor: async () => null,
    update: async (id, patch, expect) => {
      const row = rows.find(r => r.id === id)!;
      if (expect && row.state !== expect) return false;
      Object.assign(row, patch);
      return true;
    },
    ensureCrmRecords: async row => ({ contactId: row.externalContactId ?? 1, leadId: row.leadId ?? 2 }),
    logSent: async (row, sent) => { log.logged.push(sent.id); return opts.crmReadback ?? true; },
    notifyOwner: async (_r, title) => { log.notifications.push(title); },
    scheduleHumanTasks: async row => { log.tasks.push(row.email); return 5; },
    cancelHumanTasks: async email => { log.cancelled.push(email); },
    saveRunSummary: async (_h, _n, summary) => { log.summaries.push(summary); },
  };
  return { store, log, rows };
}

function makeMailbox(over: Partial<Record<keyof ProspectMailbox, any>> & { thread?: Partial<ThreadState> } = {}) {
  const sends: any[] = [];
  let n = 0;
  const mb = {
    verifyIdentity: vi.fn(async () => "sales@mechanicalenterprise.com"),
    outreachSentSince: vi.fn(async () => 0),
    hasSent: vi.fn(async () => false),
    hasInboundFrom: vi.fn(async () => false),
    hasBounce: vi.fn(async () => false),
    threadState: vi.fn(async (_t: string, _e: string): Promise<ThreadState> => ({
      outboundCount: 1, replied: false, bounced: false, lastMessageIdHeader: "<orig@mail>", originalSubject: "HVAC service partnership — Mechanical Enterprise", ...over.thread,
    })),
    send: vi.fn(async (input: any) => { sends.push(input); n++; return { id: `g${n}`, threadId: input.threadId ?? `nt${n}` }; }),
    findSentBySubject: vi.fn(async () => null),
    isInSent: vi.fn(async () => true),
    ...over,
  } as unknown as ProspectMailbox;
  return { mb, sends };
}
const outreach = (sends: any[]) => sends.filter(s => s.to !== "sales@mechanicalenterprise.com");
const reports = (sends: any[]) => sends.filter(s => s.to === "sales@mechanicalenterprise.com");

describe("schedule restrictions", () => {
  it("never runs on weekends", async () => {
    const { store } = makeStore([followUp()]);
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, SAT_11AM);
    expect(r.skipped).toBe("outside_weekday_9_17_ET");
    expect(sends).toHaveLength(0);
  });
  it("5 PM is a read-only closing report: no outreach, one report", async () => {
    const { store } = makeStore([followUp(), intro()]);
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_5PM);
    expect(r.mode).toBe("report_only");
    expect(outreach(sends)).toHaveLength(0);
    expect(reports(sends)).toHaveLength(1);
    expect(reports(sends)[0].subject).toBe("Mechanical Enterprise Hourly Outreach Report — 2026-10-28 17:00 ET");
  });
  it("only one cycle per Eastern hour (no overlapping or catch-up runs)", async () => {
    const claimed = new Set<string>();
    const { store } = makeStore([followUp()], { claimed });
    const { mb, sends } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    const again = await runCycle(store, async () => mb, new Date(WED_11AM.getTime() + 20 * 60_000));
    expect(again.skipped).toBe("hour_already_run");
    expect(outreach(sends)).toHaveLength(1);
  });
  it("does nothing when the workflow is disabled", async () => {
    const { store } = makeStore([followUp()], { enabled: false });
    const { mb, sends } = makeMailbox();
    expect((await runCycle(store, async () => mb, WED_11AM)).skipped).toBe("disabled_or_owner_missing");
    expect(sends).toHaveLength(0);
  });
});

describe("follow-ups", () => {
  it("sends the oldest unsent step in the ORIGINAL thread; prior intro does not disqualify", async () => {
    const row = followUp();
    const { store, log } = makeStore([row]);
    const { mb, sends } = makeMailbox({ hasSent: vi.fn(async () => true) });
    const r = await runCycle(store, async () => mb, WED_11AM);
    const [s] = outreach(sends);
    expect(s.threadId).toBe(row.threadId);
    expect(s.inReplyTo).toBe("<orig@mail>");
    expect(s.subject).toBe("Re: HVAC service partnership — Mechanical Enterprise");
    expect(row.touchCount).toBe(2);
    expect(row.state).toBe("nurture");
    expect(row.nextTouchAt!.getTime()).toBeGreaterThan(WED_11AM.getTime());
    expect(r.sent[0]).toMatchObject({ kind: "follow_up", gmailId: "g1", crmSaved: true });
    expect(log.logged).toEqual(["g1"]);
  });
  it("is not sent before its day-4 business-day step", async () => {
    const introAt = new Date(WED_11AM.getTime() - 2 * DAY);
    const { store } = makeStore([followUp({ followUpAt: new Date(introAt.getTime() + DAY), nextTouchAt: introAt })]);
    const { mb, sends } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
  });
  it("stops on a human reply and notifies the owner", async () => {
    const row = followUp();
    const { store, log } = makeStore([row]);
    const { mb, sends } = makeMailbox({ thread: { replied: true } });
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.state).toBe("replied");
    expect(log.notifications[0]).toMatch(/replied/);
  });
  it("bounce permanently suppresses the exact address", async () => {
    const row = followUp();
    const { store, log } = makeStore([row]);
    const { mb, sends } = makeMailbox({ hasBounce: vi.fn(async () => true) });
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.state).toBe("delivery_failed");
    expect(log.suppressions).toEqual([row.email]);
  });
  it("idempotent: a step already present in the thread is resynced, never resent", async () => {
    const row = followUp();
    const { store } = makeStore([row]);
    const { mb, sends } = makeMailbox({ thread: { outboundCount: 2 } });
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.touchCount).toBe(2);
  });
  it("holds when the Gmail check is incomplete and continues with the next candidate", async () => {
    const a = followUp(), b = followUp();
    const { store } = makeStore([a, b]);
    const { mb, sends } = makeMailbox({ hasBounce: vi.fn().mockRejectedValueOnce(new GmailIncompleteError("bounded")).mockResolvedValue(false) });
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends).map(s => s.to)).toEqual([b.email]);
    expect(r.held[0].reason).toBe("bounded");
  });
  it("inspects at most five candidates per run", async () => {
    const rows = Array.from({ length: 8 }, () => followUp());
    const { store } = makeStore(rows);
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(5);
    expect(r.pending).toBe(3);
  });
});

describe("suppression and ownership", () => {
  it("DNC / opt-out / known bounce is suppressed before any Gmail read", async () => {
    const row = followUp({ email: "dmcconnell@cresa.com" });
    const { store } = makeStore([row], { suppressed: ["dmcconnell@cresa.com"] });
    const { mb, sends } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.state).toBe("suppressed");
    expect((mb.threadState as any).mock.calls).toHaveLength(0);
  });
  it.each([
    ["Dennis McConnell", "Cresa", "dennis@cresa-other.com"],
    ["Jhana Silva", "Carriage Club", "jsilva@carriageclub.org"],
    ["Pat Jones", "Onyx Equities", "pjones@onyx-eq.com"],
    ["Gabriel Lopes", "X", "glopes@x.com"],
    ["Ann Lee", "Giga Holdings", "alee@gigaholdings.com"],
  ])("permanent exclusion: %s", async (name, company, email) => {
    const row = intro({ name, company, email });
    const { store } = makeStore([row]);
    const { mb, sends } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.state).toBe("suppressed");
  });
  it("human-owned CRM relationships (appointment/customer/opportunity) stop automation", async () => {
    const row = followUp();
    const { store } = makeStore([row], { holds: { [row.email]: "appointment_scheduled" } });
    const { mb, sends } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.state).toBe("human_owned");
  });
  it("never emails two contacts from the same company in one run", async () => {
    const a = followUp({ company: "Acme Property Group LLC" }), b = followUp({ company: "ACME Property Group" });
    const { store } = makeStore([a, b]);
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(1);
    expect(r.held.some(h => /same company|this company/.test(h.reason))).toBe(true);
  });
});

describe("shared hourly cap", () => {
  it("counts manual + automated Sent this hour: 19 already sent → only 1 more in catch-up", async () => {
    const { store } = makeStore([followUp(), followUp(), followUp()]);
    const { mb, sends } = makeMailbox({ outreachSentSince: vi.fn(async () => 19) });
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.cap).toBe(20);
    expect(outreach(sends)).toHaveLength(1);
  });
  it("returns to 10/hour once the backlog is reconciled", async () => {
    const { store } = makeStore([intro()]);
    const { mb, sends } = makeMailbox({ outreachSentSince: vi.fn(async () => 10) });
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.cap).toBe(10);
    expect(outreach(sends)).toHaveLength(0);
  });
  it("unknown Sent count fails closed (no outreach, report still sent)", async () => {
    const { store } = makeStore([followUp()]);
    const { mb, sends } = makeMailbox({ outreachSentSince: vi.fn().mockRejectedValue(new GmailIncompleteError("x")) });
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(reports(sends)).toHaveLength(1);
  });
  it("admin reports do not count toward the allowance", async () => {
    const { store } = makeStore([intro()]);
    const { mb } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    // One Sent count per run; the report is sent after counting and is excluded by subject in the query.
    expect((mb.outreachSentSince as any).mock.calls).toHaveLength(1);
  });
});

describe("Gmail rate limits", () => {
  it("a 403 rate limit on send stops ALL outbound activity, restores the row, and skips the email report", async () => {
    const a = followUp(), b = followUp();
    const { store, log } = makeStore([a, b]);
    const { mb, sends } = makeMailbox({ send: vi.fn(async () => { throw new GmailStopError("rate_limited", 403); }) });
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect((mb.send as any).mock.calls).toHaveLength(1);
    expect(sends).toHaveLength(0);
    expect(a.state).toBe("waiting");
    expect(r.gmail).toBe("rate_limited");
    expect(r.report?.status).toBe("not_sent");
    expect(log.summaries[0]).toMatch(/rate_limited/);
  });
  it("a permission error during identity check sends nothing", async () => {
    const { store } = makeStore([followUp()]);
    const { mb, sends } = makeMailbox({ verifyIdentity: vi.fn(async () => { throw new GmailStopError("wrong_mailbox", 0); }) });
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(sends).toHaveLength(0);
    expect(r.gmail).toBe("wrong_mailbox");
  });
});

describe("introductions", () => {
  it("only after the follow-up cohort has nothing more ready; researches when the queue is low", async () => {
    const { store, log } = makeStore([followUp()], { research: () => [intro()] });
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.sent.map(s => s.kind)).toEqual(["follow_up", "intro"]);
    expect(log.researchCalls).toBe(1);
    expect(outreach(sends)[1].threadId).toBeUndefined();
  });
  it("skips addresses already in Gmail Sent (exact-address duplicate prevention)", async () => {
    const row = intro();
    const { store } = makeStore([row]);
    const { mb, sends } = makeMailbox({ hasSent: vi.fn(async () => true) });
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(0);
    expect(row.state).toBe("duplicate");
  });
  it("records thread, cadence start and CRM save after sending", async () => {
    const row = intro();
    const { store } = makeStore([row]);
    const { mb } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(row.state).toBe("waiting");
    expect(row.touchCount).toBe(1);
    expect(row.threadId).toBe("nt1");
    expect(row.followUpAt!.getTime()).toBe(WED_11AM.getTime() + DAY);
  });
});

describe("CRM sync and reports", () => {
  it("reports CRM readback failures instead of claiming success", async () => {
    const { store } = makeStore([followUp()], { crmReadback: false });
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.sent[0].crmSaved).toBe(false);
    expect(reports(sends)[0].body).toMatch(/CRM readback failures: 1/);
  });
  it("never duplicates a confirmed report", async () => {
    const { store } = makeStore([]);
    const { mb, sends } = makeMailbox({ findSentBySubject: vi.fn(async () => "existing123") });
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(reports(sends)).toHaveLength(0);
    expect(r.report).toMatchObject({ status: "already_sent", gmailId: "existing123" });
  });
  it("reads back the actual Gmail SENT id for the report", async () => {
    const { store } = makeStore([]);
    const { mb } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.report).toMatchObject({ status: "sent", gmailId: "g1", readback: true });
    expect(r.report?.subject).toBe("Mechanical Enterprise Hourly Outreach Report — 2026-10-28 11:00 ET");
  });
  it("reports qualified leads and ad spend as UNKNOWN rather than inventing totals", async () => {
    const { store } = makeStore([]);
    const { mb, sends } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(reports(sends)[0].body).toMatch(/toward 80: UNKNOWN/);
  });
});

describe("signature", () => {
  it("uses the current customer-facing phone (862) 423-9396 everywhere", () => {
    for (let step = 1; step <= 4; step++) expect(followUpBody({ name: "Jane Smith", company: "Acme" }, step)).toContain("423-9396");
    expect(introduction({ name: "Jane Smith", company: "Acme", title: "PM" })).toContain("423-9396");
    for (const old of ["419-1763"]) {
      expect(followUpBody({ name: "J", company: "A" }, 1)).not.toContain(old);
      expect(introduction({ name: "J", company: "A", title: "PM" })).not.toContain(old);
    }
  });
});

describe("prospect search runs every sending hour", () => {
  it("searches even when the follow-up backlog is large, and still sends follow-ups first", async () => {
    const rows = Array.from({ length: 8 }, () => followUp());
    const { store, log } = makeStore(rows, { research: () => [intro()] });
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(log.researchCalls).toBe(1);
    expect(r.researched).toBe(1);
    expect(outreach(sends).every((s: any) => s.threadId)).toBe(true); // follow-ups only while backlog remains
  });
  it("does not search when 20 prospects are already waiting", async () => {
    const rows = Array.from({ length: 20 }, () => intro());
    const { store, log } = makeStore(rows);
    const { mb } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(log.researchCalls).toBe(0);
  });
  it("never searches in the 5 PM report-only hour", async () => {
    const { store, log } = makeStore([]);
    const { mb } = makeMailbox();
    await runCycle(store, async () => mb, WED_5PM);
    expect(log.researchCalls).toBe(0);
  });
  it("a failed search is reported but does not block sending", async () => {
    const { store } = makeStore([followUp()]);
    store.research = async () => { throw new Error("web search unavailable"); };
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.researchError).toMatch(/web search unavailable/);
    expect(outreach(sends)).toHaveLength(1);
    expect(reports(sends)[0].body).toMatch(/research FAILED: web search unavailable/);
  });
  it("still searches when Gmail is blocked (search never sends)", async () => {
    const { store, log } = makeStore([]);
    const { mb } = makeMailbox({ verifyIdentity: vi.fn(async () => { throw new GmailStopError("rate_limited", 429); }) });
    await runCycle(store, async () => mb, WED_11AM);
    expect(log.researchCalls).toBe(1);
  });
});

describe("CRM unavailable", () => {
  it("reports the database error instead of a bare skip", async () => {
    const { store } = makeStore([]);
    store.config = async () => { throw new Error("Table 'railway.prospectWorkflowSettings' doesn't exist"); };
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(r.skipped).toBe("crm_unavailable");
    expect(r.crmError).toMatch(/doesn't exist/);
    expect(sends).toHaveLength(0);
  });
});

describe("human call tasks", () => {
  it("each new introduction gets its call tasks and an owner notification", async () => {
    const row = intro();
    const { store, log } = makeStore([row]);
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(1);
    expect(log.tasks).toEqual([row.email]);
    expect(r.humanTasks).toBe(5);
    expect(log.notifications).toContain("New prospect emailed — call tasks scheduled");
    expect(reports(sends)[0].body).toMatch(/Human call tasks created: 5/);
  });
  it("follow-up emails do not create duplicate call tasks", async () => {
    const { store, log } = makeStore([followUp()]);
    const { mb } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(log.tasks).toHaveLength(0);
  });
  it("a reply cancels the remaining call tasks", async () => {
    const row = followUp();
    const { store, log } = makeStore([row]);
    const { mb } = makeMailbox({ thread: { replied: true } });
    await runCycle(store, async () => mb, WED_11AM);
    expect(log.cancelled).toEqual([row.email]);
  });
  it("an already-emailed duplicate keeps any existing tasks", async () => {
    const row = intro();
    const { store, log } = makeStore([row]);
    const { mb } = makeMailbox({ hasSent: vi.fn(async () => true) });
    await runCycle(store, async () => mb, WED_11AM);
    expect(row.state).toBe("duplicate");
    expect(log.cancelled).toHaveLength(0);
  });
  it("a task failure is reported but does not undo the sent introduction", async () => {
    const row = intro();
    const { store } = makeStore([row]);
    store.scheduleHumanTasks = async () => { throw new Error("CRM contact missing"); };
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(1);
    expect(row.state).toBe("waiting");
    expect(r.held.some(h => /call tasks could not be created/.test(h.reason))).toBe(true);
  });
});

describe("10 introductions per hour", () => {
  it("sends 10 introductions from a full queue, then stops", async () => {
    const rows = Array.from({ length: 25 }, () => intro());
    const { store } = makeStore(rows);
    const { mb, sends } = makeMailbox();
    const r = await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(10);
    expect(r.sent.every(s => s.kind === "intro")).toBe(true);
  });
  it("keeps going past stopped candidates to reach 10", async () => {
    const rows = Array.from({ length: 22 }, () => intro());
    const { store } = makeStore(rows);
    let n = 0;
    const { mb, sends } = makeMailbox({ hasSent: vi.fn(async () => n++ % 2 === 0) }); // every other one already emailed
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(10);
  });
  it("never exceeds the shared hourly cap (manual + homeowner sends count)", async () => {
    const rows = Array.from({ length: 25 }, () => intro());
    const { store } = makeStore(rows);
    const { mb, sends } = makeMailbox({ outreachSentSince: vi.fn(async () => 6) });
    await runCycle(store, async () => mb, WED_11AM);
    expect(outreach(sends)).toHaveLength(4);
  });
  it("asks research for enough prospects to refill the queue to 20", async () => {
    const rows = Array.from({ length: 7 }, () => intro());
    const { store, log } = makeStore(rows);
    const { mb } = makeMailbox();
    await runCycle(store, async () => mb, WED_11AM);
    expect(log.needed).toBe(13);
  });
});
