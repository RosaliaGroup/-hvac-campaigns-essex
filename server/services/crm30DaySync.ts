import { pacedGmailRead } from "./gmailReadTransport";
import { gmailQuotaRemainingMs, gmailIsRateLimited, markGmailQuotaExceeded, GmailQuotaCooldownError } from "./gmailQuotaCooldown";
/** Gmail-labeled prospecting messages -> 30-day CRM cadence. No automatic sends. */
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { gmailCrmStatus, parseGmailMessage, CRM_MAILBOX, type GmailMessage } from "./gmailCrm";
import { upsertExternalContact } from "./crmCommunications";
import { GMAIL_SUPPRESSION_LABEL_NAMES, KNOWN_OUTREACH_SUPPRESSIONS, isOutreachSuppressed, seedKnownOutreachSuppressions } from "./outreachSuppression";
import { startJob } from "./asyncLaneJob";
import { cadenceExcluded, cadenceDueAt, THIRTY_DAY_STEPS } from "./crm30DayRules";
import { insert30DayTask, cadenceDatabase, crm30DayTasks, list30DayTasks, cancelOpen30DayTasks, cancelTasksWithInboundReplies, assignAll30DayTasks } from "./crm30DayTasks";
import { resolveCadenceAssignee } from "./crm30DayAssignee";
import { queueContactEnrichment } from "./automaticContactEnrichment";

type Candidate = {
  email: string;
  introAt: Date;
  messageId: string;
  threadId: string;
};

// Resume a scan after quota/transport failures without re-reading completed messages.
// Process tasks only after the whole window is collected, preserving the earliest intro.
// A restart safely begins again; task inserts remain idempotent.
const scans = new Map<
  number,
  {
    candidates: Map<string, Candidate>;
    suppressed: Set<string>;
    pageToken?: string;
    page?: { messages?: { id: string }[]; nextPageToken?: string };
    index: number;
    scanned: number;
    skipped: number;
    startedAt: number;
    complete: boolean;
  }
>();

/** @slow Gmail API scan: invoke through async job, never inline in a mutation. */
let activeScan = false;
export async function sync30DayFromGmail(
  lookbackDays: 10 | 35 | 3650 = 10,
  fetchImpl: typeof fetch = fetch
) {
  if (activeScan)
    throw new Error("CRM cadence scan already running; retry next job.");
  activeScan = true;
  try {
    return await sync30DayBatch(lookbackDays, fetchImpl);
  } finally {
    activeScan = false;
  }
}

async function sync30DayBatch(
  lookbackDays: 10 | 35 | 3650 = 10,
  fetchImpl: typeof fetch = fetch
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
    if (gmailQuotaRemainingMs() > 0) throw new GmailQuotaCooldownError(gmailQuotaRemainingMs());
    const response = await pacedGmailRead(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000),
    }, fetchImpl);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const reason = JSON.stringify(payload?.error?.errors ?? []) + " " + String(payload?.error?.status ?? "");
      if (gmailIsRateLimited(response.status, reason)) {
        markGmailQuotaExceeded(Number(response.headers.get("retry-after")));
        throw new GmailQuotaCooldownError(gmailQuotaRemainingMs());
      }
      throw new Error(`CRM Gmail follow-up scan failed (HTTP ${response.status})`);
    }
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

  let scan = scans.get(lookbackDays);
  if (!scan) {
    scan = {
      candidates: new Map(),
      suppressed: new Set(),
      index: 0,
      scanned: 0,
      skipped: 0,
      startedAt: Date.now(),
      complete: false,
    };
    scans.set(lookbackDays, scan);
  }
  const { candidates, suppressed } = scan;
  // Twenty messages per job keeps this scanner from monopolizing Gmail quota.
  for (let remaining = 20; remaining > 0 && !scan.complete; remaining--) {
    if (!scan.page) {
      const params = new URLSearchParams({
        labelIds: labelId,
        maxResults: "20",
        q: `in:sent from:${CRM_MAILBOX} after:${Math.floor(scan.startedAt / 1000) - lookbackDays * 86400} before:${Math.floor(scan.startedAt / 1000) + 1}`,
      });
      if (scan.pageToken) params.set("pageToken", scan.pageToken);
      scan.page = await read(`messages?${params.toString()}`);
      scan.index = 0;
    }
    const item = scan.page!.messages?.[scan.index];
    if (!item) {
      scan.pageToken = scan.page!.nextPageToken;
      scan.page = undefined;
      scan.complete = !scan.pageToken;
      remaining++; // Page transitions do not consume the message budget.
      continue;
    }
    const remote = (await read(
      `messages/${encodeURIComponent(item.id)}?format=full`
    )) as GmailMessage;
    try {
      scan.index++;
      scan.scanned++;
      if (
        !remote.labelIds?.includes("SENT") ||
        !remote.labelIds?.includes(labelId)
      ) {
        scan.skipped++;
        continue;
      }
      const parsed = parseGmailMessage(remote);
      if (!parsed || parsed.direction !== "outbound") {
        scan.skipped++;
        continue;
      }
      if (remote.labelIds.some(id => suppressionLabels.has(id))) {
        for (const email of parsed.contacts)
          suppressed.add(email.toLowerCase());
        scan.skipped++;
        continue;
      }
      for (const email of parsed.contacts) {
        const normalized = email.toLowerCase();
        if (
          cadenceExcluded({ email: normalized }) ||
          (await isOutreachSuppressed(db, normalized))
        ) {
          suppressed.add(normalized);
          scan.skipped++;
          continue;
        }
        const current = candidates.get(normalized);
        if (!current || parsed.occurredAt < current.introAt) {
          candidates.set(normalized, {
            email: normalized,
            introAt: parsed.occurredAt,
            messageId: parsed.providerMessageId,
            threadId: parsed.providerThreadId,
          });
        }
      }
    } catch (error) {
      scan.index--;
      scan.scanned--;
      throw error;
    }
  }
  const { scanned } = scan;
  let { skipped } = scan;
  const pageToken = scan.pageToken;
  if (!scan.complete)
    return {
      scanned,
      skipped,
      created: 0,
      cancelled,
      hasMore: true,
      note: "Scan checkpoint saved; next job resumes this window.",
    };

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
    // Only labeled, non-suppressed TASK outreach prospects qualify for
    // automatic enrichment. Never promote an email-only person to Contacts.
    const contact = existing ?? await upsertExternalContact(db, {
      name: candidate.email, email: candidate.email, source: "gmail-prospecting",
    });
    if (existing && !["gmail-prospecting","verified-hvac-prospect","crm-manual","gmail-selected","crm"].includes(existing.source??"")) {
      await db.update(crmExternalContacts)
        .set({source:"gmail-prospecting"})
        .where(eq(crmExternalContacts.id,contact.id));
    }
    const {ensureSentEmailContact}=await import("./sentEmailContact");
    await ensureSentEmailContact(db,{...contact,source:"gmail-prospecting"});
    await queueContactEnrichment(contact.id);
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
  // Assignment failures must never abort Gmail reconciliation or suppress
  // contact creation and follow-up scheduling.
  let assignment: Awaited<ReturnType<typeof assignAll30DayTasks>> | null = null;
  if(assignee){
    try {
      assignment=await assignAll30DayTasks(assignee.id,assignee.name?.trim()||"Sales");
    } catch(error) {
      console.error("[CRM 30-Day] Assignment deferred; synchronization continues",
        error instanceof Error?error.message:"unknown");
    }
  }
  const [ownership] = await db.select({
    open: sql<number>`count(*)`,
    unassigned: sql<number>`sum(case when ${crm30DayTasks.assignedToUserId} is null then 1 else 0 end)`,
  }).from(crm30DayTasks).where(eq(crm30DayTasks.status, "open"));
  const remainingUnassigned = Number(ownership?.unassigned ?? 0);
  const openCount = Number(ownership?.open ?? 0);
  scans.delete(lookbackDays);
  return {
    scanned, created, cancelled, skipped,
    hasMore: Boolean(pageToken),
    autoAssigned: assignment?.assigned ?? 0,
    remainingUnassigned,
    alreadyAssigned: openCount - remainingUnassigned,
    assignmentSource: assigneeSource,
    verifiedTeamMailboxOwner: assigneeSource==="verified-team-mailbox",
    note: assignee
      ? "Open unassigned tasks reconciled to a verified CRM user."
      : remainingUnassigned === 0
        ? "Open tasks have non-null owner IDs, but no authenticated owner has been resolved. Verify ownership before delivery."
        : "Some open tasks remain unassigned; automatic owner lookup is unresolved. Existing assignments were preserved.",
  };
}

export function start30DayCadenceScheduler() {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.CRM_30_DAY_SYNC_ENABLED === "false"
  )
    return;
  let historyComplete = false;
  const run = () => {
    if (gmailQuotaRemainingMs() > 0) return;
    startJob({
      kind: "crm-30-day",
      key: "crm-30-day-sync",
      fn: async () => {
        try {
          const historical =
            process.env.CRM_HISTORICAL_OUTREACH_BACKFILL === "true" &&
            !historyComplete;
          const result = await sync30DayFromGmail(historical ? 3650 : 10);
          if (historical && !result.hasMore) historyComplete = true;
          const openTasks = await list30DayTasks({ status: "open" });
          console.info(
            "[CRM 30-Day] Scan:",
            JSON.stringify({
              ...result,
              openTasksVisible: openTasks.length,
            })
          );
          return result;
        } catch (error) {
          console.error(
            "[CRM 30-Day] Sync failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          throw error;
        }
      },
    });
  };
  // First scan after boot; then resume small batches every five minutes.
  // Run a one-time, opt-in historical import after deployment.
  // The same labeled-outreach-only deduplication and suppression checks apply.
  const first = setTimeout(run, 30_000);
  first.unref();
  const interval = setInterval(run, 5 * 60 * 1000);
  interval.unref();
}
