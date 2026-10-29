/**
 * ONE hourly outreach cycle for the single automated HVAC email sender.
 *
 * Execution order (Mon–Fri ET; 9–16 send, 17 report-only):
 *   1. CRM access + ownership checks available (native DB — no browser session).
 *   2. Verify Gmail sender identity (sales@ only).
 *   3. Count this Eastern hour's Sent outreach (manual + automated, full pagination).
 *   4. Inspect up to 5 overdue follow-ups, oldest due first, one at a time.
 *   5. Send each eligible follow-up in its ORIGINAL thread (oldest unsent step only).
 *   6. Hold ineligible/unverifiable candidates with precise reasons.
 *   7. If no further follow-ups are ready, research new prospects when the queue is low.
 *   8–9. Inspect up to 5 queued introductions; send eligible ones within the allowance.
 *  10. Save + read back CRM communications.
 *  11. Send the administrative hourly report (deduplicated, provider readback).
 *
 * Any Gmail 401/403/429 stops ALL outbound activity for the run immediately.
 * Pure orchestration: every side effect goes through `CycleStore` / `ProspectMailbox`.
 */
import {
  MAX_CANDIDATES_PER_PHASE, MAX_INTRO_CANDIDATES, introsPerHour, cycleHour, easternHourStartEpochSec, hourlyCap,
  nextFollowUpDue, normalizeCompany, remainingAllowance, replySubject, reportSubject, sendingHour,
} from "../../shared/prospectCadence";
import { isExcludedProspect } from "./outreachProspectRules";
import { GmailIncompleteError, GmailStopError, type ProspectMailbox, type ThreadState } from "./prospectGmail";
import { CRM_MAILBOX } from "./gmailCrm";

export const INTRO_SUBJECT = "HVAC service partnership — Mechanical Enterprise";
const DAY = 86_400_000;
/** Keep this many researched prospects waiting: about half are stopped by safety checks, so 20 feeds 10 introductions. */
export const QUEUE_TARGET = 20;
/** Extra searches allowed in the same hour when the first pass falls short of the intro target. */
export const TOP_UP_SEARCHES = 2;

export type QueueRow = {
  id: number; email: string; name: string; company: string; title: string;
  state: string; touchCount: number; threadId: string | null; emailBody: string;
  ownerId: number; leadId: number | null; externalContactId: number | null;
  followUpAt: Date | null; nextTouchAt: Date | null; verificationUrl: string;
  phone?: string | null;
};
export type HoldReason =
  | "appointment_scheduled" | "existing_customer" | "active_opportunity" | "company_engaged" | null;

export interface CycleStore {
  claimHour(hour: string, now: Date): Promise<boolean>;
  config(): Promise<{ enabled: boolean; ownerId: number | null }>;
  /** Cadence-active rows (waiting/nurture, 1 ≤ touchCount ≤ 4), prefiltered nextTouchAt ≤ now. */
  followUpPool(now: Date): Promise<QueueRow[]>;
  queuedIntros(limit: number): Promise<QueueRow[]>;
  /** Research until about `needed` new prospects are queued (bounded searches). Returns how many were added. */
  research(ownerId: number, needed: number, opts?: { attempts?: number; startAttempt?: number }): Promise<number>;
  isSuppressed(email: string): Promise<boolean>;
  recordSuppression(email: string, reason: "hard_bounce" | "opt_out"): Promise<void>;
  relationshipHold(row: QueueRow, phase: "follow_up" | "intro"): Promise<HoldReason>;
  existingLeadFor(email: string): Promise<number | null>;
  /** Conditional update; returns false when the row is no longer in `expectState`. */
  update(id: number, patch: Partial<QueueRow> & { lastError?: string | null; emailMessageId?: string }, expectState?: string): Promise<boolean>;
  ensureCrmRecords(row: QueueRow): Promise<{ contactId: number; leadId: number }>;
  /** Logs the outbound communication and reads it back. Returns false on readback failure. */
  logSent(row: QueueRow, sent: { id: string; threadId: string }, subject: string, body: string, kind: "intro" | "follow_up", now: Date): Promise<boolean>;
  notifyOwner(row: QueueRow, title: string): Promise<void>;
  /** Human call tasks (30-day cadence call steps) for a prospect just introduced. Returns how many were created. */
  scheduleHumanTasks(row: QueueRow, sent: { id: string; threadId: string }, introAt: Date): Promise<number>;
  /** Cancel open human tasks when a prospect replies, opts out, bounces or becomes human-owned. */
  cancelHumanTasks(email: string, reason: string): Promise<void>;
  saveRunSummary(hour: string, sentCount: number, summary: string, now: Date): Promise<void>;
}

export type SentEntry = { kind: "intro" | "follow_up"; to: string; company: string; subject: string; gmailId: string; threadId: string; crmSaved: boolean };
export type HeldEntry = { email: string; company: string; reason: string };
export type CycleResult = {
  hour: string | null;
  skipped?: string;
  mode?: "send" | "report_only";
  crm: "ok" | "unavailable";
  crmError?: string;
  gmail: "ok" | "not_checked" | GmailStopError["kind"];
  gmailError?: string;
  cap?: number;
  sentBefore?: number | null;
  sent: SentEntry[];
  held: HeldEntry[];
  stopped: HeldEntry[];
  pending: number;
  researched: number;
  humanTasks: number;
  introTarget?: number;
  introsSent?: number;
  topUpSearched?: boolean;
  researchError?: string;
  overdueBacklog: number;
  report?: { subject: string; status: "sent" | "already_sent" | "not_sent"; gmailId?: string; readback?: boolean; reason?: string };
};

export function followUpBody(row: Pick<QueueRow, "name" | "company">, step: number): string {
  const first = row.name.split(" ")[0];
  const openers = [
    `Following up on my note about HVAC support for ${row.company}.`,
    `Checking back in case HVAC service, preventive maintenance or replacement planning is on your list for ${row.company}.`,
    `Wanted to share that we often help property teams with seasonal maintenance and equipment replacement planning — happy to be a resource for ${row.company}.`,
    `I'll close the loop here so I don't crowd your inbox. If ${row.company} ever needs HVAC service or a second opinion on equipment, I'm glad to help.`,
  ];
  return `Hi ${first},\n\n${openers[Math.min(step, openers.length) - 1]}\n\nWould a quick call be useful, or is there someone else who oversees HVAC?\n\nAna Haynes\nPresident | Mechanical Enterprise LLC\nsales@mechanicalenterprise.com | (862) 423-9396\nIf you prefer no further outreach, reply and I'll remove you from our list.`;
}

/** Legacy + current rows: the intro timestamp is followUpAt − 1 day (set at intro send). */
export const introAtOf = (row: Pick<QueueRow, "followUpAt">) => row.followUpAt ? new Date(row.followUpAt.getTime() - DAY) : null;

export function dueAt(row: QueueRow): Date | null {
  const introAt = introAtOf(row);
  if (!introAt) return null;
  const cadence = nextFollowUpDue(introAt, row.touchCount, introAt);
  if (!cadence) return null;
  return row.nextTouchAt && row.nextTouchAt > cadence ? row.nextTouchAt : cadence;
}

export async function runCycle(
  store: CycleStore,
  openMailbox: () => Promise<ProspectMailbox>,
  now: Date,
): Promise<CycleResult> {
  const hour = cycleHour(now);
  const result: CycleResult = { hour, crm: "ok", gmail: "not_checked", sent: [], held: [], stopped: [], pending: 0, researched: 0, humanTasks: 0, overdueBacklog: 0 };
  if (!hour) return { ...result, skipped: "outside_weekday_9_17_ET" };

  let config: Awaited<ReturnType<CycleStore["config"]>>;
  try { config = await store.config(); } catch (e) {
    return { ...result, crm: "unavailable", skipped: "crm_unavailable", crmError: (e as Error)?.message?.slice(0, 300) };
  }
  if (!config.enabled || !config.ownerId) return { ...result, skipped: "disabled_or_owner_missing" };
  // One cycle per Eastern clock hour across all processes and manual "Run now" clicks.
  if (!(await store.claimHour(hour, now))) return { ...result, skipped: "hour_already_run" };

  const sendAllowed = Boolean(sendingHour(now));
  result.mode = sendAllowed ? "send" : "report_only";
  let mailbox: ProspectMailbox | null = null;
  const stopRun = (e: unknown) => {
    if (e instanceof GmailStopError) { result.gmail = e.kind; result.gmailError = e.message; return true; }
    return false;
  };

  // Prospect search runs EVERY sending hour, independent of the follow-up backlog and of Gmail
  // health: it only fills the queue (and triggers contact enrichment); it never sends.
  if (sendAllowed) {
    try {
      const queued = await store.queuedIntros(QUEUE_TARGET);
      if (queued.length < QUEUE_TARGET) result.researched = await store.research(config.ownerId, QUEUE_TARGET - queued.length);
    } catch (e) {
      result.researchError = (e as Error).message.slice(0, 300);
    }
  }

  // Follow-up pool + backlog (DB only, no Gmail).
  const pool = (await store.followUpPool(now))
    .map(row => ({ row, due: dueAt(row) }))
    .filter((x): x is { row: QueueRow; due: Date } => Boolean(x.due && x.due <= now))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  result.overdueBacklog = pool.length;
  const cap = hourlyCap(pool.length);
  result.cap = cap;

  try {
    mailbox = await openMailbox();
    await mailbox.verifyIdentity();
    result.gmail = "ok";
    if (sendAllowed) {
      try {
        result.sentBefore = await mailbox.outreachSentSince(easternHourStartEpochSec(now));
      } catch (e) {
        if (!(e instanceof GmailIncompleteError)) throw e;
        result.sentBefore = null; // unknown → allowance 0 (fail closed)
      }
      let remaining = remainingAllowance(cap, result.sentBefore);
      const companiesThisRun = new Set<string>();
      const suppressedCache = new Map<string, boolean>();
      const suppressed = async (email: string) => {
        const key = email.toLowerCase();
        if (!suppressedCache.has(key)) suppressedCache.set(key, await store.isSuppressed(key));
        return suppressedCache.get(key)!;
      };
      const hold = async (row: QueueRow, reason: string) => {
        result.held.push({ email: row.email, company: row.company, reason });
        await store.update(row.id, { lastError: `Held ${hour}: ${reason}` });
      };
      const stop = async (row: QueueRow, state: string, reason: string, notify?: string) => {
        result.stopped.push({ email: row.email, company: row.company, reason });
        await store.update(row.id, { state, nextTouchAt: null, lastError: reason });
        // A reply, opt-out, bounce or human-owned relationship ends the call cadence too.
        if (state !== "duplicate") await store.cancelHumanTasks(row.email, reason).catch(() => undefined);
        if (notify) await store.notifyOwner(row, notify);
      };
      /** Shared pre-Gmail gates. Returns false when the row was held/stopped. */
      const gates = async (row: QueueRow, phase: "follow_up" | "intro") => {
        if (isExcludedProspect(row) || await suppressed(row.email)) {
          await stop(row, "suppressed", "Excluded, opted out or bounced — permanently suppressed.");
          return false;
        }
        const relation = await store.relationshipHold(row, phase);
        if (relation) {
          await stop(row, "human_owned", `Human-owned CRM relationship: ${relation}.`, "Prospect has an active CRM relationship — automation stopped");
          return false;
        }
        const company = normalizeCompany(row.company);
        if (companiesThisRun.has(company)) { await hold(row, "another contact at this company was emailed this run"); return false; }
        return true;
      };

      // ---- Phase A: follow-ups (oldest due first, max 5 inspected) ----
      let inspected = 0;
      for (const { row } of pool) {
        if (inspected >= MAX_CANDIDATES_PER_PHASE) break;
        if (remaining <= 0) break;
        inspected++;
        if (!(await gates(row, "follow_up"))) continue;
        if (!row.threadId) { await hold(row, "original Gmail thread unknown — cannot follow up in thread"); continue; }
        let state: ThreadState;
        try {
          state = await mailbox.threadState(row.threadId, row.email);
          if (state.replied || await mailbox.hasInboundFrom(row.email)) {
            await stop(row, "replied", "Prospect replied — human follow-up required.", "Prospect replied — personal follow-up needed");
            continue;
          }
          const introAt = introAtOf(row)!;
          if (state.bounced || await mailbox.hasBounce(row.email, Math.floor(introAt.getTime() / 1000))) {
            await store.recordSuppression(row.email, "hard_bounce");
            await stop(row, "delivery_failed", "Delivery failure; permanently suppressed.", "Prospect email failed — verify a replacement");
            continue;
          }
          if (state.outboundCount > row.touchCount) {
            // Idempotency: a step was already sent (manually or by an interrupted run). Resync, don't resend.
            const next = nextFollowUpDue(introAt, state.outboundCount, now);
            await store.update(row.id, { touchCount: state.outboundCount, state: next ? "nurture" : "complete", nextTouchAt: next, lastError: "Resynced touch count from Gmail thread; no resend." });
            result.held.push({ email: row.email, company: row.company, reason: "step already present in Gmail thread — resynced" });
            continue;
          }
          if (!state.lastMessageIdHeader) { await hold(row, "cannot thread safely (missing Message-ID)"); continue; }
        } catch (e) {
          if (e instanceof GmailIncompleteError) { await hold(row, e.message); continue; }
          throw e;
        }
        const prevState = row.state;
        if (!(await store.update(row.id, { state: "email_sending", lastError: null }, prevState))) continue;
        const step = row.touchCount; // 1..4
        const subject = replySubject(state.originalSubject || INTRO_SUBJECT);
        const body = followUpBody(row, step);
        let sent;
        try {
          sent = await mailbox.send({ to: row.email, subject, body, threadId: row.threadId, inReplyTo: state.lastMessageIdHeader });
        } catch (e) {
          // A definite provider rejection was not sent: restore. Ambiguous failures stay email_sending (never auto-retried).
          if (e instanceof GmailStopError) await store.update(row.id, { state: prevState, lastError: e.message }, "email_sending");
          throw e;
        }
        remaining--;
        companiesThisRun.add(normalizeCompany(row.company));
        const count = row.touchCount + 1;
        const next = nextFollowUpDue(introAtOf(row)!, count, now);
        await store.update(row.id, { state: next ? "nurture" : "complete", touchCount: count, nextTouchAt: next, emailMessageId: sent.id });
        const crmSaved = await store.logSent(row, sent, subject, body, "follow_up", now);
        result.sent.push({ kind: "follow_up", to: row.email, company: row.company, subject, gmailId: sent.id, threadId: sent.threadId, crmSaved });
      }
      const followUpsRemaining = pool.length - inspected;

      // ---- Phase B: new introductions, sent only when the follow-up cohort has nothing more ready ----
      if (remaining > 0 && followUpsRemaining <= 0) {
        const introTarget = introsPerHour();
        let introsSent = 0;
        const inspectedIds = new Set<number>();
        // Round 2 tops up: when the first pass falls short of the target, search again
        // (new segments and counties) and keep sending within the same hour.
        for (let round = 0; round < 2 && remaining > 0 && introsSent < introTarget; round++) {
        if (round > 0) {
          try {
            const added = await store.research(config.ownerId, (introTarget - introsSent) * 2, { attempts: TOP_UP_SEARCHES, startAttempt: 4 });
            result.researched += added;
            result.topUpSearched = true;
            if (!added) break;
          } catch (e) {
            result.researchError ??= (e as Error).message.slice(0, 300);
            break;
          }
        }
        const intros = (await store.queuedIntros(MAX_INTRO_CANDIDATES)).filter(r => !inspectedIds.has(r.id));
        for (const row of intros) {
          if (remaining <= 0 || introsSent >= introTarget) break;
          inspectedIds.add(row.id);
          if (!(await gates(row, "intro"))) continue;
          const existingLead = await store.existingLeadFor(row.email);
          if (existingLead && existingLead !== row.leadId) {
            await stop(row, "duplicate", "Existing CRM lead — skipped cold introduction.");
            continue;
          }
          try {
            if (await mailbox.hasSent(row.email)) { await stop(row, "duplicate", "Already present in Gmail Sent — introduction skipped."); continue; }
            if (await mailbox.hasInboundFrom(row.email)) { await stop(row, "replied", "Prior correspondence from this address — human-owned.", "Prospect has prior email history — personal follow-up needed"); continue; }
            if (await mailbox.hasBounce(row.email)) {
              await store.recordSuppression(row.email, "hard_bounce");
              await stop(row, "delivery_failed", "Prior delivery failure for this address; permanently suppressed.");
              continue;
            }
          } catch (e) {
            if (e instanceof GmailIncompleteError) { await hold(row, e.message); continue; }
            throw e;
          }
          const { contactId, leadId } = await store.ensureCrmRecords(row);
          const ready = { ...row, externalContactId: contactId, leadId };
          if (!(await store.update(row.id, { state: "email_sending", externalContactId: contactId, leadId, lastError: null }, "queued"))) continue;
          let sent;
          try {
            sent = await mailbox.send({ to: row.email, subject: INTRO_SUBJECT, body: row.emailBody });
          } catch (e) {
            if (e instanceof GmailStopError) await store.update(row.id, { state: "queued", lastError: e.message }, "email_sending");
            throw e;
          }
          remaining--;
          introsSent++;
          companiesThisRun.add(normalizeCompany(row.company));
          await store.update(row.id, {
            state: "waiting", touchCount: 1, threadId: sent.threadId, emailMessageId: sent.id,
            followUpAt: new Date(now.getTime() + DAY), nextTouchAt: nextFollowUpDue(now, 1, now),
          });
          const crmSaved = await store.logSent(ready, sent, INTRO_SUBJECT, row.emailBody, "intro", now);
          result.sent.push({ kind: "intro", to: row.email, company: row.company, subject: INTRO_SUBJECT, gmailId: sent.id, threadId: sent.threadId, crmSaved });
          // Human follow-up: call tasks on cadence days 2, 7, 14, 22 and 30, assigned in the CRM.
          try {
            result.humanTasks += await store.scheduleHumanTasks(ready, sent, now);
            await store.notifyOwner(ready, "New prospect emailed — call tasks scheduled");
          } catch (e) {
            result.held.push({ email: row.email, company: row.company, reason: `introduced, but call tasks could not be created: ${(e as Error).message.slice(0, 160)}` });
          }
        }
        }
        result.introTarget = introTarget;
        result.introsSent = introsSent;
        result.pending = Math.max(0, followUpsRemaining);
      } else {
        result.pending = Math.max(0, followUpsRemaining);
      }
    }
  } catch (e) {
    if (!stopRun(e)) {
      result.gmail = result.gmail === "not_checked" ? "not_checked" : result.gmail;
      result.gmailError = `Run aborted: ${(e as Error).message.slice(0, 300)}`;
    }
  }

  // ---- Step 11: administrative report (never counts toward the outreach cap) ----
  const subject = reportSubject(now);
  const text = renderReport(result, subject);
  if (mailbox && result.gmail === "ok") {
    try {
      const existing = await mailbox.findSentBySubject(subject);
      if (existing) result.report = { subject, status: "already_sent", gmailId: existing };
      else {
        const sent = await mailbox.send({ to: CRM_MAILBOX, subject, body: text });
        result.report = { subject, status: "sent", gmailId: sent.id, readback: await mailbox.isInSent(sent.id) };
      }
    } catch (e) {
      stopRun(e);
      result.report = { subject, status: "not_sent", reason: (e as Error).message.slice(0, 300) };
    }
  } else {
    result.report = { subject, status: "not_sent", reason: result.gmailError ?? "Gmail unavailable" };
  }
  await store.saveRunSummary(hour, (result.sentBefore ?? 0) + result.sent.length, renderReport(result, subject), now);
  return result;
}

export function renderReport(r: CycleResult, subject: string): string {
  const line = (e: SentEntry) => `- [${e.kind === "intro" ? "INTRO" : "FOLLOW-UP"}] ${e.to} (${e.company}) — "${e.subject}" — Gmail ${e.gmailId} — CRM ${e.crmSaved ? "saved+read back" : "READBACK FAILED"}`;
  const hl = (h: HeldEntry) => `- ${h.email} (${h.company}): ${h.reason}`;
  const intros = r.sent.filter(s => s.kind === "intro").length;
  const used = r.sentBefore == null ? "UNKNOWN (fail closed)" : String(r.sentBefore + r.sent.length);
  const remaining = r.sentBefore == null || r.cap == null ? 0 : Math.max(0, r.cap - r.sentBefore - r.sent.length);
  return [
    subject, "",
    `Mode: ${r.mode ?? "skipped"}${r.skipped ? ` (${r.skipped})` : ""}`,
    `CRM access: ${r.crm === "ok" ? "OK — native server-side access (no browser session)" : "UNAVAILABLE"}`,
    `Gmail (sales@mechanicalenterprise.com): ${r.gmail}${r.gmailError ? ` — ${r.gmailError}` : ""}`,
    `Hourly cap: ${r.cap ?? "-"} (${(r.overdueBacklog ?? 0) > 0 ? "catch-up" : "normal"}); outreach this hour: ${used}; remaining: ${remaining}`,
    `Overdue follow-up backlog: ${r.overdueBacklog}; pending after this run: ${r.pending}`,
    "",
    `Sent this run: ${r.sent.length} (${intros} introductions, ${r.sent.length - intros} follow-ups)`,
    ...(r.introTarget ? [`Introduction target this hour: ${r.introTarget}; reached: ${intros}${intros < r.introTarget ? ` — short by ${r.introTarget - intros}${r.topUpSearched ? " after a top-up search" : ""} (not enough verified people or hourly cap)` : ""}`] : []),
    ...r.sent.map(line),
    "", `Held (${r.held.length}):`, ...r.held.map(hl),
    "", `Stopped / suppressed / replied / bounced (${r.stopped.length}):`, ...r.stopped.map(hl),
    "", `Human call tasks created: ${r.humanTasks}`,
    `New prospects researched into queue: ${r.researched}${r.researchError ? ` — research FAILED: ${r.researchError}` : ""}`,
    `CRM readback failures: ${r.sent.filter(s => !s.crmSaved).length}`,
    "Monthly unique qualified HVAC leads toward 80: UNKNOWN (no verified qualification attribution in this job)",
    "Paid-ad spend: UNKNOWN (not verifiable from this job)",
    "",
    r.mode === "report_only" ? "Closing report — no sends at 5 PM. Next cycle: next weekday 9:00 ET." : "Next cycle: top of the next Eastern hour (weekdays 9–17 ET).",
  ].join("\n");
}
