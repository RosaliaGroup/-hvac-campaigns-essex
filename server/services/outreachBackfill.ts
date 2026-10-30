/**
 * One-time catch-up (owner, Oct 30): apply this week's outreach changes to every existing lead.
 *
 *  A. Leads introduced by the CRM sender before the changes:
 *     - five call tasks (days 2/7/14/22/30) + the day-1 "Follow on social" task, where missing;
 *     - Apollo LinkedIn profile saved to the contact's verified social links;
 *     - contact research (company, social, published business phone) queued if never queued.
 *  B. Every lead with open cadence tasks (including leads from the retired ChatGPT task):
 *     - public bodies / schools: open tasks cancelled (public bidding);
 *     - everyone else: a "Follow on social" task, where missing.
 *
 * Idempotent: tasks are INSERT IGNORE on (email, touch); the whole run is recorded once in
 * crmBackfillRuns and never repeats. Sends no email and spends no Apollo credits.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { crmExternalContacts, prospectWorkflowQueue as queue } from "../../drizzle/schema";
import { crm30DayTasks, cancelOpen30DayTasks, insert30DayTask } from "./crm30DayTasks";
import { resolveCadenceAssignee } from "./crm30DayAssignee";
import { isPublicBidEntity } from "./outreachProspectRules";
import { addVerifiedSocialLink } from "./contactProfile/store";
import type { CycleStore, QueueRow } from "./prospectCycle";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const BACKFILL_NAME = "outreach-catch-up-2026-10-30";
const DAY = 86_400_000;
const LINKEDIN = /^https:\/\/(www\.)?linkedin\.com\/in\//i;

export type BackfillSummary = {
  introducedLeads: number; tasksCreated: number; linkedinSaved: number; researchQueued: number;
  openCadenceContacts: number; publicCancelled: number; followTasksForOlderLeads: number; errors: number;
};

export async function runOutreachBackfill(db: Db, deps: {
  store: Pick<CycleStore, "scheduleHumanTasks">;
  queueResearch: (contactId: number) => Promise<unknown>;
  now?: Date;
}): Promise<BackfillSummary | null> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS crmBackfillRuns (
    name varchar(64) NOT NULL PRIMARY KEY, ranAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, summary text NULL)`);
  const claim = await db.execute(sql`INSERT IGNORE INTO crmBackfillRuns (name) VALUES (${BACKFILL_NAME})`);
  if (Number((claim as any)?.[0]?.affectedRows ?? 0) !== 1) return null; // already ran

  const now = deps.now ?? new Date();
  const s: BackfillSummary = { introducedLeads: 0, tasksCreated: 0, linkedinSaved: 0, researchQueued: 0,
    openCadenceContacts: 0, publicCancelled: 0, followTasksForOlderLeads: 0, errors: 0 };

  // ── A. Leads introduced by the CRM sender ────────────────────────────────
  const introduced = await db.select().from(queue).where(and(
    inArray(queue.state, ["waiting", "nurture", "complete"]),
    sql`${queue.touchCount} >= 1`, isNotNull(queue.externalContactId),
    isNotNull(queue.emailMessageId), isNotNull(queue.threadId),
  )).limit(2000);
  const introducedEmails = new Set<string>();
  for (const r of introduced) {
    introducedEmails.add(r.email.toLowerCase());
    if (isPublicBidEntity(r)) continue; // handled in B and by the hourly sweep
    s.introducedLeads++;
    try {
      const row = { ...r, followUpAt: r.followUpAt ?? null, nextTouchAt: r.nextTouchAt ?? null } as QueueRow;
      const introAt = r.followUpAt ? new Date(r.followUpAt.getTime() - DAY) : r.createdAt;
      s.tasksCreated += await deps.store.scheduleHumanTasks(row, { id: r.emailMessageId!, threadId: r.threadId! }, introAt);
      if (LINKEDIN.test(r.verificationUrl)) {
        await addVerifiedSocialLink(r.externalContactId!, { platform: "LinkedIn", url: r.verificationUrl.replace(/\/$/, ""),
          source: r.verificationUrl, evidence: `Apollo.io match for ${r.name}, ${r.title} at ${r.company} (verified work email ${r.email})` });
        s.linkedinSaved++;
      }
      await deps.queueResearch(r.externalContactId!);
      s.researchQueued++;
    } catch (e) {
      s.errors++;
      console.warn("[outreach-backfill] lead", r.id, (e as Error).message.slice(0, 160));
    }
  }

  // ── B. All leads with open cadence tasks (includes the retired ChatGPT task's leads) ──
  const open = await db.select({
    email: crm30DayTasks.recipientEmail, contactId: crm30DayTasks.externalContactId,
    introMessageId: crm30DayTasks.introMessageId, introThreadId: crm30DayTasks.introThreadId, introAt: crm30DayTasks.introAt,
    name: crmExternalContacts.name, company: crmExternalContacts.company, title: crmExternalContacts.title,
  }).from(crm30DayTasks)
    .leftJoin(crmExternalContacts, eq(crmExternalContacts.id, crm30DayTasks.externalContactId))
    .where(eq(crm30DayTasks.status, "open")).limit(20000);
  const byEmail = new Map<string, (typeof open)[number]>();
  for (const t of open) if (!byEmail.has(t.email.toLowerCase())) byEmail.set(t.email.toLowerCase(), t);
  s.openCadenceContacts = byEmail.size;
  const { user } = await resolveCadenceAssignee().catch(() => ({ user: null as { id: number } | null }));
  for (const [email, t] of Array.from(byEmail)) {
    try {
      if (isPublicBidEntity({ email, company: t.company })) {
        s.publicCancelled += await cancelOpen30DayTasks(email, "Public body or school (public bidding) — excluded from outreach.");
        continue;
      }
      if (introducedEmails.has(email)) continue; // already handled in A
      const who = [t.name && !t.name.includes("@") ? t.name : null, t.title, t.company].filter(Boolean).join(", ") || email;
      const created = await insert30DayTask({
        contactId: t.contactId, email, introMessageId: t.introMessageId, introThreadId: t.introThreadId,
        introAt: t.introAt, touchNumber: 1, kind: "human", dueAt: now,
        assignedToUserId: user?.id ?? null, status: "open",
        note: `Follow on social — ${who}. Open the contact's Social section for verified profiles (person and company), follow from the Mechanical Enterprise accounts, then click "Mark followed". Added by the Oct 30 catch-up.`,
      });
      if (created) s.followTasksForOlderLeads++;
    } catch (e) {
      s.errors++;
      console.warn("[outreach-backfill] cadence", (e as Error).message.slice(0, 160));
    }
  }

  await db.execute(sql`UPDATE crmBackfillRuns SET summary = ${JSON.stringify(s)} WHERE name = ${BACKFILL_NAME}`);
  return s;
}
