/**
 * Homeowner replies → a personal call task for the owner (owner, Oct 30).
 *
 * Only homeowners who WROTE BACK get a call task: they contacted us, so a personal call
 * is a response to their inquiry. Homeowners who have not replied are not called until
 * the list is checked against the Do Not Call Registry. Calls are dialed by a person;
 * nothing here places a call. No social or profile research for homeowners.
 */
import { eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { customers } from "../../drizzle/schema";
import { upsertExternalContact } from "./crmCommunications";
import { insert30DayTask } from "./crm30DayTasks";
import { resolveCadenceAssignee } from "./crm30DayAssignee";
import { isOutreachSuppressed } from "./outreachSuppression";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const HOMEOWNER_CALL_TOUCH = 2; // shows as "Personal introduction call" in CRM tasks

export async function createHomeownerCallTask(db: Db, row: {
  customerId: number; email: string; displayName: string; threadId?: string | null;
}, now = new Date()): Promise<boolean> {
  const email = row.email.trim().toLowerCase();
  if (await isOutreachSuppressed(db, email)) return false;
  const [c] = await db.select({ phone: customers.phone, displayName: customers.displayName })
    .from(customers).where(eq(customers.id, row.customerId)).limit(1);
  const contact = await upsertExternalContact(db, {
    name: c?.displayName || row.displayName || email, email, phone: c?.phone ?? null,
    source: "homeowner-reply", customerId: row.customerId,
  });
  const contactId = Number(contact.id);
  if (!Number.isSafeInteger(contactId) || contactId <= 0) throw new Error("Homeowner contact not created");
  const { user } = await resolveCadenceAssignee().catch(() => ({ user: null as { id: number } | null }));
  const thread = row.threadId ?? `homeowner-${row.customerId}`;
  return insert30DayTask({
    contactId, email, introMessageId: thread, introThreadId: thread, introAt: now,
    touchNumber: HOMEOWNER_CALL_TOUCH, kind: "human", dueAt: now,
    assignedToUserId: user?.id ?? null, status: "open",
    note: `Homeowner replied to the HVAC email — call them personally${c?.phone ? ` at ${c.phone}` : " (no phone on file: reply by email)"}. Read their reply in sales@ first.`,
  });
}

/** One-time: call tasks for homeowners who replied before this change. */
export const HOMEOWNER_CALL_BACKFILL = "homeowner-reply-calls-2026-10-30";
export async function backfillHomeownerCallTasks(db: Db, now = new Date()) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS crmBackfillRuns (
    name varchar(64) NOT NULL PRIMARY KEY, ranAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, summary text NULL)`);
  const claim = await db.execute(sql`INSERT IGNORE INTO crmBackfillRuns (name) VALUES (${HOMEOWNER_CALL_BACKFILL})`);
  if (Number((claim as any)?.[0]?.affectedRows ?? 0) !== 1) return null;
  const rows = (((await db.execute(sql`SELECT h.customerId, h.email, h.threadId, c.displayName
    FROM homeownerEmailSends h JOIN customers c ON c.id = h.customerId WHERE h.status = 'replied'`).catch(() => [[]])) as any)?.[0] ?? []) as any[];
  const out = { replied: rows.length, tasksCreated: 0, errors: 0 };
  for (const r of rows) {
    try { if (await createHomeownerCallTask(db, r, now)) out.tasksCreated++; }
    catch (e) { out.errors++; console.warn("[homeowner-calls]", (e as Error).message.slice(0, 160)); }
  }
  await db.execute(sql`UPDATE crmBackfillRuns SET summary = ${JSON.stringify(out)} WHERE name = ${HOMEOWNER_CALL_BACKFILL}`);
  return out;
}
