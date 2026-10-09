/** Gmail-labeled prospecting messages -> CRM reminders. No automatic sends. */
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { crmCommunications, crmExternalContacts, users } from "../../drizzle/schema";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { gmailCrmStatus, parseGmailMessage, CRM_MAILBOX, type GmailMessage } from "./gmailCrm";
import { upsertExternalContact } from "./crmCommunications";
import { ensureSentEmailContact } from "./sentEmailContact";
import { GMAIL_SUPPRESSION_LABEL_NAMES, KNOWN_OUTREACH_SUPPRESSIONS, isOutreachSuppressed, seedKnownOutreachSuppressions } from "./outreachSuppression";
import { startJob } from "./asyncLaneJob";
import { excludeFromOutreachFollowups, followupDueAt, FOLLOWUP_STEPS } from "./crmFollowupRules";
import { addCrmFollowupTask, followupDatabase, followupTasks, listCrmFollowupTasks } from "./crmFollowupTasks";

type Candidate = {
  email: string; introAt: Date; messageId: string; threadId: string;
};

/** @slow Gmail API scan: invoke through async job, never inline in a mutation. */
export async function syncCrmFollowupsFromGmail(
  lookbackDays: 10 | 35 = 10,
  fetchImpl: typeof fetch = fetch,
) {
  const status = await gmailCrmStatus();
  if (!status.connected || !status.hasReadPermission ||
      status.accountEmail?.toLowerCase() !== CRM_MAILBOX) {
    throw new Error("Connect sales@mechanicalenterprise.com with Gmail read access in CRM Integrations.");
  }
  const db = await followupDatabase();
  await seedKnownOutreachSuppressions(db);
  let cancelled = 0;
  for (const entry of KNOWN_OUTREACH_SUPPRESSIONS) {
    const result = await db.update(followupTasks)
      .set({ status: "cancelled", note: "Known delivery failure or do-not-contact request." })
      .where(and(eq(followupTasks.recipientEmail, entry.email), eq(followupTasks.status, "open")));
    cancelled += Number((result as any)?.[0]?.affectedRows ?? 0);
  }
  const { accessToken } = await googleCalendarProvider.getValidAccessToken();
  async function read(path: string) {
    const response = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
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
        if (excludeFromOutreachFollowups({ email: normalized }) || await isOutreachSuppressed(db, normalized)) {
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

  const assigneeEmail = process.env.CRM_FOLLOWUP_ASSIGNEE_EMAIL || CRM_MAILBOX;
  const [assignee] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, assigneeEmail)).limit(1);
  let created = 0;
  for (const email of suppressed) {
    const result = await db.update(followupTasks)
      .set({ status: "cancelled", note: "Suppressed by Gmail label or CRM." })
      .where(and(eq(followupTasks.recipientEmail, email), eq(followupTasks.status, "open")));
    cancelled += Number((result as any)?.[0]?.affectedRows ?? 0);
  }
  for (const candidate of Array.from(candidates.values())) {
    if (suppressed.has(candidate.email) || await isOutreachSuppressed(db, candidate.email)) {
      const result = await db.update(followupTasks)
        .set({ status: "cancelled", note: "CRM outreach suppression." })
        .where(and(eq(followupTasks.recipientEmail, candidate.email), eq(followupTasks.status, "open")));
      cancelled += Number((result as any)?.[0]?.affectedRows ?? 0);
      skipped++; continue;
    }
    const [existing] = await db.select().from(crmExternalContacts)
      .where(eq(crmExternalContacts.email, candidate.email)).limit(1);
    if (excludeFromOutreachFollowups({
      email: candidate.email, name: existing?.name, company: existing?.company,
    })) { skipped++; continue; }
    const contact = existing ?? await upsertExternalContact(db, {
      name: candidate.email, email: candidate.email, source: "gmail-prospecting",
    });
    if (!contact.customerId) await ensureSentEmailContact(db, contact);
    const [laterTouch] = await db.select({ id: crmCommunications.id })
      .from(crmCommunications)
      .where(and(
        eq(crmCommunications.externalContactId, contact.id),
        gt(crmCommunications.occurredAt, candidate.introAt),
        or(isNull(crmCommunications.providerMessageId),
           ne(crmCommunications.providerMessageId, candidate.messageId)),
      )).limit(1);
    for (const step of FOLLOWUP_STEPS) {
      const note = laterTouch
        ? "Later communication recorded. Review before any additional outreach."
        : step.kind === "human"
          ? "Personal contact due on day 2. Check replies, calls, texts and notes first."
          : "Review current Gmail thread and CRM history first. This task never sends email.";
      const inserted = await addCrmFollowupTask({
        contactId: contact.id, email: candidate.email,
        introMessageId: candidate.messageId, introThreadId: candidate.threadId,
        introAt: candidate.introAt, kind: step.kind,
        dueAt: followupDueAt(candidate.introAt, step.kind),
        assignedToUserId: assignee?.id ?? null,
        status: laterTouch ? "cancelled" : "open", note,
      });
      if (inserted) created++;
    }
    if (laterTouch) {
      const result = await db.update(followupTasks)
        .set({ status: "cancelled", note: "Later communication recorded. Review before any additional outreach." })
        .where(and(eq(followupTasks.recipientEmail, candidate.email), eq(followupTasks.status, "open")));
      cancelled += Number((result as any)?.[0]?.affectedRows ?? 0);
    }
  }
  return {
    scanned, created, cancelled, skipped,
    hasMore: Boolean(pageToken),
    note: assignee ? "Tasks assigned to the matching CRM user." :
      "Tasks are labeled Ana Haynes; no matching CRM user email was found.",
  };
}

export function startCrmFollowupScheduler() {
  if (process.env.NODE_ENV !== "production" ||
      process.env.CRM_FOLLOWUP_SYNC_ENABLED === "false") return;
  const run = () => {
    startJob({
      kind: "crm-followup", key: "crm-followup-sync",
      fn: async () => {
        try {
          const result = await syncCrmFollowupsFromGmail(10);
          const openTasks = await listCrmFollowupTasks({ status: "open" });
          console.info("[CRM Follow-up] Scan:", JSON.stringify({
            ...result, openTasksVisible: openTasks.length,
          }));
          return result;
        }
        catch (error) {
          console.error("[CRM Follow-up] Sync failed:", error instanceof Error ? error.message : "Unknown error");
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
