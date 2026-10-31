import { describe, expect, it, vi } from "vitest";
const st = vi.hoisted(() => ({ inserted: [] as any[], upserts: [] as any[], suppressed: false }));
vi.mock("./crmCommunications", () => ({ upsertExternalContact: vi.fn(async (_db: any, c: any) => { st.upserts.push(c); return { id: 42 }; }) }));
vi.mock("./crm30DayTasks", () => ({ insert30DayTask: vi.fn(async (t: any) => { st.inserted.push(t); return true; }) }));
vi.mock("./crm30DayAssignee", () => ({ resolveCadenceAssignee: vi.fn(async () => ({ user: { id: 7 } })) }));
vi.mock("./outreachSuppression", () => ({ isOutreachSuppressed: vi.fn(async () => st.suppressed) }));
import { createHomeownerCallTask, backfillHomeownerCallTasks } from "./homeownerCallTask";

const db = (phone: string | null, replied: any[] = []) => {
  const chain: any = { select: () => chain, from: () => chain, where: () => chain, limit: async () => [{ phone, displayName: "Maria Lopez" }] };
  return { ...chain, execute: vi.fn(async (q: any) => {
    const t = JSON.stringify(q);
    if (t.includes("INSERT IGNORE INTO crmBackfillRuns")) return [{ affectedRows: 1 }];
    if (t.includes("FROM homeownerEmailSends")) return [replied];
    return [{}];
  }) };
};

describe("homeowner reply call tasks", () => {
  it("creates an owner call task with the phone, no research source", async () => {
    st.inserted.length = 0; st.upserts.length = 0; st.suppressed = false;
    expect(await createHomeownerCallTask(db("(973) 555-0100") as any, { customerId: 9, email: "Maria@Example.com", displayName: "Maria", threadId: "t1" })).toBe(true);
    expect(st.upserts[0]).toMatchObject({ email: "maria@example.com", phone: "(973) 555-0100", source: "homeowner-reply", customerId: 9 });
    expect(st.inserted[0]).toMatchObject({ contactId: 42, touchNumber: 2, kind: "human", assignedToUserId: 7, introThreadId: "t1" });
    expect(st.inserted[0].note).toContain("call them personally at (973) 555-0100");
  });
  it("skips suppressed homeowners", async () => {
    st.inserted.length = 0; st.suppressed = true;
    expect(await createHomeownerCallTask(db(null) as any, { customerId: 9, email: "x@y.com", displayName: "X" })).toBe(false);
    expect(st.inserted).toHaveLength(0);
  });
  it("backfills homeowners who already replied", async () => {
    st.inserted.length = 0; st.suppressed = false;
    const out = await backfillHomeownerCallTasks(db(null, [{ customerId: 1, email: "a@b.com", threadId: "t", displayName: "A" }, { customerId: 2, email: "c@d.com", threadId: "u", displayName: "C" }]) as any);
    expect(out).toEqual({ replied: 2, tasksCreated: 2, errors: 0 });
    expect(st.inserted[0].note).toContain("no phone on file");
  });
});
