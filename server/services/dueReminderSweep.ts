/**
 * Hourly due-date reminders: checklist tasks (assigned, due within 24h or overdue)
 * and bids (bidDueAt within 48h or overdue, still open). One reminder per person
 * per item per ~20h, deduped against the notifications table itself.
 */
import { and, eq, gt, isNotNull, lt, notInArray } from "drizzle-orm";
import { getDb } from "../db";
import { opportunities, opportunityChecklistItems, opportunityMembers, notifications } from "../../drizzle/schema";
import { notify } from "../routers/notifications";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const HOUR = 3600_000;

async function alreadyReminded(db: Db, teamMemberId: number, type: string, entityId: number): Promise<boolean> {
  const since = new Date(Date.now() - 20 * HOUR);
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(
      eq(notifications.teamMemberId, teamMemberId),
      eq(notifications.type, type),
      eq(notifications.entityId, entityId),
      gt(notifications.createdAt, since),
    ))
    .limit(1);
  return rows.length > 0;
}

async function sweep(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // 1) Assigned checklist tasks due within 24h (or overdue), not complete.
  const soonTasks = new Date(Date.now() + 24 * HOUR);
  const tasks = await db
    .select()
    .from(opportunityChecklistItems)
    .where(and(
      eq(opportunityChecklistItems.isComplete, false),
      isNotNull(opportunityChecklistItems.assigneeId),
      isNotNull(opportunityChecklistItems.dueAt),
      lt(opportunityChecklistItems.dueAt, soonTasks),
    ));
  for (const t of tasks) {
    const assignee = t.assigneeId;
    if (assignee == null || t.dueAt == null) continue;
    if (await alreadyReminded(db, assignee, "task_due", t.id)) continue;
    const overdue = t.dueAt < new Date();
    await notify(db, {
      teamMemberIds: [assignee],
      type: "task_due",
      title: (overdue ? "OVERDUE task: " : "Task due soon: ") + t.label,
      body: "Due " + t.dueAt.toDateString(),
      entityType: "task",
      entityId: t.id,
      link: `/opportunities/${t.opportunityId}`,
    });
  }

  // 2) Bids with a deadline inside 48h (or passed), still open — remind the bid team.
  const soonBids = new Date(Date.now() + 48 * HOUR);
  const bids = await db
    .select()
    .from(opportunities)
    .where(and(
      isNotNull(opportunities.bidDueAt),
      lt(opportunities.bidDueAt, soonBids),
      notInArray(opportunities.stage, ["won", "lost"]),
    ));
  for (const b of bids) {
    if (b.bidDueAt == null) continue;
    const members = await db
      .select({ teamMemberId: opportunityMembers.teamMemberId })
      .from(opportunityMembers)
      .where(eq(opportunityMembers.opportunityId, b.id));
    const overdue = b.bidDueAt < new Date();
    for (const m of members) {
      if (m.teamMemberId == null) continue;
      if (await alreadyReminded(db, m.teamMemberId, "bid_due", b.id)) continue;
      await notify(db, {
        teamMemberIds: [m.teamMemberId],
        type: "bid_due",
        title: (overdue ? "Bid deadline PASSED: " : "Bid due soon: ") + (b.title ?? "bid"),
        body: "Bid due " + b.bidDueAt.toDateString(),
        entityType: "opportunity",
        entityId: b.id,
        link: `/opportunities/${b.id}`,
      });
    }
  }
}

/** Start the hourly reminder sweep (first pass ~2 minutes after boot). */
export function startDueReminderSweep(): void {
  const run = async () => {
    try { await sweep(); } catch (e) { console.warn("[reminders] sweep failed:", (e as Error).message); }
  };
  setTimeout(run, 2 * 60_000);
  setInterval(run, HOUR);
  console.log("[reminders] due-date reminder sweep scheduled (hourly)");
}
