/** Gmail-labeled prospecting messages -> 30-day CRM cadence. No automatic sends. */
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { gmailCrmStatus, parseGmailMessage, CRM_MAILBOX, type GmailMessage } from "./gmailCrm";
import { upsertExternalContact } from "./crmCommunications";
import { ensureSentEmailContact } from "./sentEmailContact";
import { GMAIL_SUPPRESSION_LABEL_NAMES, KNOWN_OUTREACH_SUPPRESSIONS, isOutreachSuppressed, seedKnownOutreachSuppressions } from "./outreachSuppression";
import { startJob } from "./asyncLaneJob";
import { cadenceExcluded, cadenceDueAt, THIRTY_DAY_STEPS } from "./crm30DayRules";
import { insert30DayTask, cadenceDatabase, crm30DayTasks, list30DayTasks, cancelOpen30DayTasks, cancelTasksWithInboundReplies, assignAll30DayTasks } from "./crm30DayTasks";
import { resolveCadenceAssignee } from "./crm30DayAssignee";

type Candidate = {
  email: string; introAt: Date; messageId: string; threadId: string;
};

/** @slow Gmail API scan: invoke through async job, never inline in a mutation. */
export async function sync30DayFromGmail(
  lookbackDays: 10 | 35 = 10,
  fetchImpl: typeof fetch = fetch,
) {
  const status = await gmailCrmStatus();
  if (!status.connected || !status.hasReadPermission ||
      status.accountEmail?.toLowerCase() !== CRM_MAILBOX) {
    throw new Error("Connect sales@mechanicalenterprise.com with Gmail read access in CRM Integrations.");
  }
  const db = await cadenceDatabase();
  await seedKnownOutreachSuppressions(db);
  let cancelled = 0;
  for (const entry of KNOWN_OUTREACH_SUPPRESSIONS) {
    cancelled += await cancelOpen30DayTasks(entry.email, "Delivery failure or explicit do-not-contact request.");
  }
  const { accessToken } = await googleCalendarProvider.getValidAccessToken();
  async function read(path: string) {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (response.status !== 429 && response.status < 500) break;
        if (attempt === 2) break;
      } catch (error) {
        if (attempt === 2) {
          throw new Error(`CRM Gmail follow-up transport failed after 3 attempts (path=${path}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!response) throw new Error(`CRM Gmail follow-up transport returned no response (path=${path})`);
    if (!response.ok) throw new Error(`CRM Gmail follow-up scan failed (HTTP ${response.status})`);
    return response.json();
  }

  const labels = await read("labels");
  const labelId = (labels.labels ?? []).find(
    (label: { name?: string }) => label.name === "Outreach/Prospecting Sent"
  )?.id as string | undefined;
  if (!labelId) return {
    scanned: 0, created: 0, cancelled, skipped: 0,
    hasMore: false, note: "Outreach/Prospecting Sent label not found",
  };
  // Do not create reminders for messages already suppressed by bounce/DNC hygiene.
  const suppressionLabels = new Set((labels.labels ?? [])
    .filter((label: { name?: string }) => GMAIL_SUPPRESSION_LABEL_NAMES.has(label.name ?? ""))
    .map((label: { id: string }) => label.id));

  const candidates = new Map<string, Candidate>();
  const suppressed = new Set<string>();
  let pageToken: string | undefined;
  let scanned = 0, skipped = 0;
  // A bounded rolling window; manual 35-day backfill covers older introductions.
  for (let pageNumber = 0; pageNumber < 6; pageNumber++) {
    const params = new URLSearchParams({
      labelIds: labelId, maxResults: "100",
      q: `in:sent from:${CRM_MAILBOX} newer_than:${lookbackDays}d`,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await read(`messages?${params.toString()}`);
    for (const item of page.messages ?? []) {
      scanned++;
      const remote = await read(`messages/${encodeURIComponent(item.id)}?format=full`) as GmailMessage;
      if (!remote.labelIds?.includes("SENT") || !remote.labelIds?.includes(labelId)) {
        skipped++; continue;
      }
      const parsed = parseGmailMessage(remote);
      if (!parsed || parsed.direction !== "outbound") { skipped++; continue; }
      if (remote.labelIds.some(id => suppressionLabels.has(id))) {
        for (const email of parsed.contacts) suppressed.add(email.toLowerCase());
        skipped++; continue;
      }
      for (const email of parsed.contacts) {
        const normalized = email.toLowerCase();
        if (cadenceExcluded({ email: normalized }) || await isOutreachSuppressed(db, normalized)) {
          suppressed.add(normalized); skipped++; continue;
        }
        const current = candidates.get(normalized);
        if (!current || parsed.occurredAt < current.introAt) {
          candidates.set(normalized, {
            email: normalized, introAt: parsed.occurredAt,
            messageId: parsed.providerMessageId, threadId: parsed.providerThreadId,
          });
        }
      }
    }
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  for (const email of Array.from(suppressed)) {
    cancelled += await cancelOpen30DayTasks(email, "Suppressed due to failed delivery or do-not-contact Gmail label.");
  }
  const { user: assignee, source: assigneeSource } = await resolveCadenceAssignee();
  let created = 0;
  for (const candidate of Array.from(candidates.values())) {
    if (suppressed.has(candidate.email) || await isOutreachSuppressed(db, candidate.email)) {
      cancelled += await cancelOpen30DayTasks(candidate.email, "CRM outreach suppression.");
      skipped++; continue;
    }
    const [existing] = await db.select().from(crmExternalContacts)
      .where(eq(crmExternalContacts.email, candidate.email)).limit(1);
    if (cadenceExcluded({
      email: candidate.email, name: existing?.name, company: existing?.company, notes: existing?.notes,
    })) {
      cancelled += await cancelOpen30DayTasks(candidate.email, "Contact excluded or opted out.");
      skipped++; continue;
    }
    const contact = existing ?? await upsertExternalContact(db, {
      name: candidate.email, email: candidate.email, source: "gmail-prospecting",
    });
    if (!contact.customerId) await ensureSentEmailContact(db, contact);
    // A reply (inbound contact communication) stops nurture. Unanswered outgoing
    // call attempts do not stop the cadence; they count only when logged.
    const [reply] = await db.select({ id: crmCommunications.id })
      .from(crmCommunications)
      .where(and(
        eq(crmCommunications.externalContactId, contact.id),
        eq(crmCommunications.direction, "inbound"),
        gt(crmCommunications.occurredAt, candidate.introAt),
      )).limit(1);
    for (const step of THIRTY_DAY_STEPS) {
      const note = reply
        ? "Inbound response received. Cadence stopped; hand over to Ana."
        : `Touch ${step.touch}/10, day ${step.day}: ${step.label}. ` +
          (step.kind === "human"
            ? "Log actual call attempt and outcome; an unanswered attempt does not stop the sequence."
            : "Review Gmail and CRM before emailing. This reminder never sends an email.");
      const inserted = await insert30DayTask({
        contactId: contact.id, email: candidate.email,
        introMessageId: candidate.messageId, introThreadId: candidate.threadId,
        introAt: candidate.introAt, touchNumber: step.touch, kind: step.kind,
        dueAt: cadenceDueAt(candidate.introAt, step.touch),
        assignedToUserId: assignee?.id ?? null,
        status: reply ? "cancelled" : "open", note,
      });
      if (inserted) created++;
    }
    if (reply) {
      const result = await db.update(crm30DayTasks)
        .set({ status: "cancelled", note: "Inbound response received. Hand off to Ana." })
        .where(and(eq(crm30DayTasks.recipientEmail, candidate.email), eq(crm30DayTasks.status, "open")));
      cancelled += Number((result as any)?.[0]?.affectedRows ?? 0);
    }
  }
  // Reconcile replies for older prospects outside the rolling Gmail intro window.
  cancelled += await cancelTasksWithInboundReplies();
  // Reconcile previously created open reminders, without changing tasks already
  // assigned to a human. No guessed login or implicit transfer of ownership.
  const assignment = assignee
    ? await assignAll30DayTasks(assignee.id, assignee.name?.trim() || "Ana Haynes")
    : null;
  const [ownership] = await db.select({
    open: sql<number>`count(*)`,
    unassigned: sql<number>`sum(case when ${crm30DayTasks.assignedToUserId} is null then 1 else 0 end)`,
  }).from(crm30DayTasks).where(eq(crm30DayTasks.status, "open"));
  const remainingUnassigned = Number(ownership?.unassigned ?? 0);
  const openCount = Number(ownership?.open ?? 0);
  return {
    scanned, created, cancelled, skipped,
    hasMore: Boolean(pageToken),
    autoAssigned: assignment?.assigned ?? 0,
    remainingUnassigned,
    alreadyAssigned: openCount - remainingUnassigned,
    assignmentSource: assigneeSource,
    note: assignee
      ? "Open unassigned tasks reconciled to a verified CRM user."
      : remainingUnassigned === 0
        ? "Existing open tasks are assigned. Automatic owner lookup remains unresolved for new tasks."
        : "Some open tasks remain unassigned; automatic owner lookup is unresolved. Existing assignments were preserved.",
  };
}

export function start30DayCadenceScheduler() {
  if (process.env.NODE_ENV !== "production" ||
      process.env.CRM_30_DAY_SYNC_ENABLED === "false") return;
  const run = () => {
    startJob({
      kind: "crm-30-day", key: "crm-30-day-sync",
      fn: async () => {
        try {
          const result = await sync30DayFromGmail(10);
          const openTasks = await list30DayTasks({ status: "open" });
          console.info("[CRM 30-Day] Scan:", JSON.stringify({
            ...result, openTasksVisible: openTasks.length,
          }));
          return result;
        }
        catch (error) {
          console.error("[CRM 30-Day] Sync failed:", error instanceof Error ? error.message : "Unknown error");
          throw error;
        }
      },
    });
  };
  // First scan after boot; then refresh twice an hour.
  const first = setTimeout(run, 30_000);
  first.unref();
  const interval = setInterval(run, 30 * 60 * 1000);
  interval.unref();
}
