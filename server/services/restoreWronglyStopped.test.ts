import { describe, expect, it, vi } from "vitest";
vi.mock("../db", () => ({ getDb: vi.fn() }));
import { restoreRows, type RestoreDeps, type RestoreRow } from "./restoreWronglyStopped";

const DAY = 86_400_000;
const NOW = new Date("2026-11-11T17:30:00Z");
let n = 1;
function row(over: Partial<RestoreRow> = {}): RestoreRow {
  const introAt = new Date(NOW.getTime() - 10 * DAY);
  n++;
  return { id: n, email: `pm${n}@realco${n}.com`, name: "Pat Lee", company: `RealCo ${n}`, title: "Property Manager",
    state: "human_owned", touchCount: 1, threadId: `t${n}`, emailMessageId: `m${n}`, emailBody: "intro", ownerId: 7,
    leadId: 50 + n, externalContactId: 80 + n, followUpAt: new Date(introAt.getTime() + DAY), nextTouchAt: null,
    verificationUrl: "https://example.com/team", ...over } as RestoreRow;
}
function deps(over: Partial<RestoreDeps["store"]> = {}) {
  const states: Record<number, { state: string; next: Date | null }> = {};
  const removed: string[] = [];
  const d: RestoreDeps = {
    store: { relationshipHold: async () => null, isSuppressed: async () => false, scheduleHumanTasks: async () => 6, ...over },
    removeWronglyCancelledTasks: async e => { removed.push(e); return 6; },
    setState: async (id, state, next) => { states[id] = { state, next }; },
  };
  return { d, states, removed };
}

describe("restore prospects wrongly stopped as existing_customer", () => {
  it("puts a mid-cadence prospect back into follow-ups and recreates its tasks", async () => {
    const r = row();
    const { d, states, removed } = deps();
    const s = await restoreRows([r], d, NOW);
    expect(states[r.id].state).toBe("nurture");
    expect(states[r.id].next).toBeInstanceOf(Date);
    expect(removed).toEqual([r.email]);
    expect(s).toMatchObject({ restored: 1, toNurture: 1, tasksRecreated: 6 });
  });
  it("a prospect stopped before its introduction goes back to the queue", async () => {
    const r = row({ touchCount: 0, threadId: null, emailMessageId: null, followUpAt: null });
    const { d, states } = deps();
    const s = await restoreRows([r], d, NOW);
    expect(states[r.id].state).toBe("queued");
    expect(s.tasksRecreated).toBe(0);
  });
  it("a finished 30-day cadence is marked complete, not re-emailed", async () => {
    const r = row({ touchCount: 5 });
    const { d, states } = deps();
    await restoreRows([r], d, NOW);
    expect(states[r.id].state).toBe("complete");
  });
  it("keeps real customers, opt-outs and public bodies stopped", async () => {
    const cust = row(), optout = row(), school = row({ company: "Township of Example", email: "facilities@townofexample.org" });
    const { d, states } = deps({
      relationshipHold: async x => (x.email === cust.email ? "existing_customer" : null),
      isSuppressed: async e => e === optout.email,
    });
    const s = await restoreRows([cust, optout, school], d, NOW);
    expect(Object.keys(states)).toHaveLength(0);
    expect(s.heldReasons).toEqual({ existing_customer: 1, suppressed: 1, public_body: 1 });
  });
});
