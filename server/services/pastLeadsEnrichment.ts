/**
 * Past commercial outreach leads (owner, Oct 30): apply this week's changes to EVERY past
 * outreach recipient, not only leads with open cadence tasks.
 *
 *  1. One-time catch-up (runPastLeadsCatchUp):
 *     - "Follow on social" task for every past lead still in good standing (no reply/opt-out/
 *       bounce cancellation, not "not interested", not suppressed, not a public body), spread
 *       20 per business day so the task list stays workable;
 *     - contact research (company, social, published business phone) queued again for leads
 *       whose earlier research never matched (attempts were often used up on days the
 *       research allowance had run out).
 *  2. Daily Apollo lookup (runPastLeadsApollo): after the 5 PM report on weekdays, or any time
 *     on weekends, look up to PAST_LEADS_APOLLO_PER_DAY past leads by their work email and save
 *     the LinkedIn profile, plus the company's main phone if the contact has none. Each lead is
 *     looked up once; reveals share the APOLLO_DAILY_REVEALS cap, so new prospecting goes first.
 *
 * Homeowners are deliberately excluded: they are private individuals from a purchased list.
 * Sends no email.
 */
import { eq, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { crmExternalContacts } from "../../drizzle/schema";
import { crm30DayTasks, insert30DayTask } from "./crm30DayTasks";
import { resolveCadenceAssignee } from "./crm30DayAssignee";
import { isPublicBidEntity, isExcludedProspect } from "./outreachProspectRules";
import { addVerifiedSocialLink } from "./contactProfile/store";
import { addBusinessDays, easternParts } from "../../shared/prospectCadence";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const PAST_LEADS_NAME = "past-leads-catch-up-2026-10-30";
export const FOLLOW_TASKS_PER_DAY = 20;

const runsTable = sql`CREATE TABLE IF NOT EXISTS crmBackfillRuns (
  name varchar(64) NOT NULL PRIMARY KEY, ranAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, summary text NULL)`;
async function claim(db: Db, name: string) {
  await db.execute(runsTable);
  const r = await db.execute(sql`INSERT IGNORE INTO crmBackfillRuns (name) VALUES (${name})`);
  return Number((r as any)?.[0]?.affectedRows ?? 0) === 1;
}

type TaskRow = {
  email: string; contactId: number | null; introMessageId: string; introThreadId: string; introAt: Date;
  status: string; outcome: string | null; touchNumber: number;
  name: string | null; company: string | null; title: string | null;
};
export type PastLead = Omit<TaskRow, "status" | "outcome" | "touchNumber"> & { hasFollowTask: boolean };

/** One entry per past recipient still in good standing (pure; exported for tests). */
export function pastLeadsInGoodStanding(rows: TaskRow[]) {
  const by = new Map<string, TaskRow[]>();
  for (const r of rows) {
    const k = r.email.trim().toLowerCase();
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const keep: PastLead[] = [];
  let publicBodies = 0, stopped = 0;
  for (const [email, list] of Array.from(by)) {
    const first = list.find(r => r.contactId) ?? list[0];
    if (isPublicBidEntity({ email, company: first.company })) { publicBodies++; continue; }
    // Cancelled tasks mean a reply, opt-out, bounce or exclusion; "not interested" is final.
    if (isExcludedProspect({ email, name: first.name ?? "", company: first.company ?? "" })
      || list.some(r => r.status === "cancelled" || r.outcome === "not_interested")) { stopped++; continue; }
    keep.push({ email, contactId: first.contactId, introMessageId: first.introMessageId,
      introThreadId: first.introThreadId, introAt: first.introAt, name: first.name,
      company: first.company, title: first.title, hasFollowTask: list.some(r => r.touchNumber === 1) });
  }
  return { keep, publicBodies, stopped, total: by.size };
}

async function allTaskRows(db: Db): Promise<TaskRow[]> {
  return await db.select({
    email: crm30DayTasks.recipientEmail, contactId: crm30DayTasks.externalContactId,
    introMessageId: crm30DayTasks.introMessageId, introThreadId: crm30DayTasks.introThreadId,
    introAt: crm30DayTasks.introAt, status: crm30DayTasks.status, outcome: crm30DayTasks.outcome,
    touchNumber: crm30DayTasks.touchNumber,
    name: crmExternalContacts.name, company: crmExternalContacts.company, title: crmExternalContacts.title,
  }).from(crm30DayTasks)
    .leftJoin(crmExternalContacts, eq(crmExternalContacts.id, crm30DayTasks.externalContactId))
    .limit(50000) as TaskRow[];
}

export type PastLeadsSummary = {
  pastLeads: number; inGoodStanding: number; publicBodies: number; stopped: number; suppressed: number;
  followTasksAdded: number; researchQueued: number; researchRequeued: number; errors: number;
};

export async function runPastLeadsCatchUp(db: Db, deps: {
  isSuppressed: (email: string) => Promise<boolean>;
  queueResearch: (contactId: number) => Promise<unknown>;
  now?: Date;
}): Promise<PastLeadsSummary | null> {
  if (!(await claim(db, PAST_LEADS_NAME))) return null;
  const now = deps.now ?? new Date();
  const { keep, publicBodies, stopped, total } = pastLeadsInGoodStanding(await allTaskRows(db));
  const s: PastLeadsSummary = { pastLeads: total, inGoodStanding: 0, publicBodies, stopped, suppressed: 0,
    followTasksAdded: 0, researchQueued: 0, researchRequeued: 0, errors: 0 };
  const { user } = await resolveCadenceAssignee().catch(() => ({ user: null as { id: number } | null }));
  for (const lead of keep) {
    try {
      if (await deps.isSuppressed(lead.email)) { s.suppressed++; continue; }
      s.inGoodStanding++;
      if (!lead.hasFollowTask && lead.contactId) {
        const dueAt = addBusinessDays(now, Math.floor(s.followTasksAdded / FOLLOW_TASKS_PER_DAY));
        const who = [lead.name && !lead.name.includes("@") ? lead.name : null, lead.title, lead.company].filter(Boolean).join(", ") || lead.email;
        if (await insert30DayTask({
          contactId: lead.contactId!, email: lead.email, introMessageId: lead.introMessageId,
          introThreadId: lead.introThreadId, introAt: lead.introAt, touchNumber: 1, kind: "human", dueAt,
          assignedToUserId: user?.id ?? null, status: "open",
          note: `Follow on social — ${who}. Open the contact's Social section for verified profiles (person and company), follow from the Mechanical Enterprise accounts, then click "Mark followed". Past-lead catch-up.`,
        })) s.followTasksAdded++;
      }
      if (lead.contactId) {
        await deps.queueResearch(lead.contactId);
        s.researchQueued++;
        // Research that never matched (often because attempts ran out on days the
        // allowance was used up) gets a fresh set of attempts.
        const r = await db.execute(sql`UPDATE crmContactEnrichmentJobs
          SET status = 'pending', attempts = 0, nextAttemptAt = CURRENT_TIMESTAMP, reason = 'Past-lead catch-up: research again'
          WHERE contactId = ${lead.contactId} AND status IN ('review', 'pending')
            AND NOT EXISTS (SELECT 1 FROM crmContactProfiles p WHERE p.contactId = ${lead.contactId}
              AND JSON_UNQUOTE(JSON_EXTRACT(p.profile, '$.status')) = 'matched')`);
        if (Number((r as any)?.[0]?.affectedRows ?? 0) > 0) s.researchRequeued++;
      }
    } catch (e) {
      s.errors++;
      console.warn("[past-leads]", (e as Error).message.slice(0, 160));
    }
  }
  await db.execute(sql`UPDATE crmBackfillRuns SET summary = ${JSON.stringify(s)} WHERE name = ${PAST_LEADS_NAME}`);
  return s;
}

// ── Daily Apollo lookup for past leads ───────────────────────────────────────
type ApolloMatch = {
  email?: string | null; email_status?: string | null; linkedin_url?: string | null;
  name?: string | null; title?: string | null;
  organization?: { name?: string | null; phone?: string | null } | null;
} | null;

export function pastLeadsApolloPerDay(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.PAST_LEADS_APOLLO_PER_DAY ?? 40);
  return Number.isInteger(n) && n >= 0 && n <= 150 ? n : 40;
}
/** Weekdays after the 5 PM report, or any time on weekends — never during sending hours. */
export function pastLeadsApolloWindow(now: Date) {
  const p = easternParts(now);
  return p.weekday === "Sat" || p.weekday === "Sun" || p.hour >= 17;
}
const tenDigits = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
};

export async function runPastLeadsApollo(db: Db, deps: {
  match: (email: string) => Promise<ApolloMatch>;
  reserveReveal: () => Promise<boolean>;
  normalize: (url: string | null | undefined) => string | null;
  isSuppressed: (email: string) => Promise<boolean>;
  now?: Date;
  perDay?: number;
}) {
  const now = deps.now ?? new Date();
  const perDay = deps.perDay ?? pastLeadsApolloPerDay();
  if (perDay === 0 || !pastLeadsApolloWindow(now)) return null;
  if (running) return null;
  running = true;
  try {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS crmApolloEmailLookups (
    email varchar(320) NOT NULL PRIMARY KEY, lookedUpAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, result varchar(32) NOT NULL)`);
  // The allowance is counted from recorded lookups (rolling 24 hours), so a restart mid-run
  // simply resumes where it stopped instead of losing the day.
  const usedRes = await db.execute(sql`SELECT COUNT(*) AS n FROM crmApolloEmailLookups
    WHERE lookedUpAt >= ${new Date(now.getTime() - 24 * 3_600_000)}`);
  const left = perDay - Number((usedRes as any)?.[0]?.[0]?.n ?? 0);
  if (left <= 0) return null;
  const done = new Set((((await db.execute(sql`SELECT email FROM crmApolloEmailLookups`)) as any)?.[0] ?? [])
    .map((r: any) => String(r.email).toLowerCase()));
  const withLinkedIn = new Set((((await db.execute(sql`SELECT contactId FROM crmContactProfiles
    WHERE JSON_SEARCH(profile, 'one', 'https://%linkedin.com/in/%') IS NOT NULL`)) as any)?.[0] ?? [])
    .map((r: any) => Number(r.contactId)));
  const { keep } = pastLeadsInGoodStanding(await allTaskRows(db));
  const out = { checked: 0, linkedinSaved: 0, phonesSaved: 0, notFound: 0, capped: false, errors: 0 };
  for (const lead of keep) {
    if (out.checked >= left) break;
    if (!lead.contactId || done.has(lead.email) || withLinkedIn.has(lead.contactId)) continue;
    if (await deps.isSuppressed(lead.email)) continue;
    if (!(await deps.reserveReveal())) { out.capped = true; break; }
    out.checked++;
    let result = "not_found";
    try {
      const person = await deps.match(lead.email);
      // Only a person whose verified work email IS this lead's address counts as a match.
      const same = person?.email?.trim().toLowerCase() === lead.email && person?.email_status === "verified";
      const url = same ? deps.normalize(person?.linkedin_url) : null;
      if (same) {
        result = "matched";
        const who = [person?.name, person?.title, person?.organization?.name].filter(Boolean).join(", ");
        if (url) {
          await addVerifiedSocialLink(lead.contactId, { platform: "LinkedIn", url, source: url,
            evidence: `Apollo.io match for verified work email ${lead.email}${who ? ` (${who})` : ""}` });
          await db.execute(sql`UPDATE crmOutreach30DayTasks SET note = CONCAT(note, ${` LinkedIn: ${url}`})
            WHERE recipientEmail = ${lead.email} AND touchNumber = 1 AND status = 'open' AND note NOT LIKE '%linkedin.com/in/%'`);
          out.linkedinSaved++;
        }
        const phone = tenDigits(person?.organization?.phone);
        if (phone) {
          const [c] = await db.select({ phone: crmExternalContacts.phone, name: crmExternalContacts.name, title: crmExternalContacts.title })
            .from(crmExternalContacts).where(eq(crmExternalContacts.id, lead.contactId)).limit(1);
          if (c && (c.phone ?? "").replace(/\D/g, "").length < 10) {
            await db.update(crmExternalContacts).set({ phone }).where(eq(crmExternalContacts.id, lead.contactId));
            // Company main line; type stays "unknown" (never implies SMS consent).
            await db.execute(sql`INSERT INTO crmContactPhoneMetadata (contactId, phone, type, sourceUrl)
              VALUES (${lead.contactId}, ${phone}, 'unknown', ${`Apollo.io company phone for ${person?.organization?.name ?? lead.company ?? lead.email}`})
              ON DUPLICATE KEY UPDATE phone = VALUES(phone), type = 'unknown', sourceUrl = VALUES(sourceUrl), verifiedAt = NULL`);
            out.phonesSaved++;
          }
        }
      } else out.notFound++;
    } catch (e) {
      out.errors++;
      console.warn("[past-leads-apollo]", (e as Error).message.slice(0, 160));
      // Not recorded, so the lead is tried again another day; stop on key, plan or rate problems.
      if ([401, 402, 403, 422, 429].includes(Number((e as { status?: number }).status))) break;
      continue;
    }
    await db.execute(sql`INSERT IGNORE INTO crmApolloEmailLookups (email, result) VALUES (${lead.email}, ${result})`);
  }
  return out.checked || out.capped ? out : null;
  } finally { running = false; }
}
let running = false;
