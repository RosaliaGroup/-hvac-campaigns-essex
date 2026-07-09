/**
 * Follow-up automation for QuickBooks-sourced opportunities.
 *
 * When a sales document is Sent/Pending we open a short close loop:
 *   - a same-day CALL task (worked by a human — never auto-dispatched),
 *   - EMAIL + TEXT touches at day 0, day 1, and day 3.
 *
 * SAFETY: text (SMS) touches are created with status "gated" and are NEVER
 * dispatched until 10DLC is approved — i.e. until SMS_FOLLOWUPS_ENABLED=true.
 * Email touches and the human call task are unaffected by the gate.
 */
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "../../db";
import {
  opportunities,
  opportunityEvents,
  opportunityTasks,
  customers,
  type InsertOpportunityTask,
} from "../../../drizzle/schema";
import { sendEmail } from "../../services/emailService";
import { sendTelnyxSms } from "../../services/telnyxSms";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Text-message follow-ups stay gated until 10DLC registration is approved. */
export function smsFollowupsEnabled(): boolean {
  return process.env.SMS_FOLLOWUPS_ENABLED === "true";
}

/** End-of-day (local-ish, UTC) for the same-day call task due time. */
function endOfDay(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCHours(23, 59, 0, 0);
  return d;
}

export interface FollowupDocContext {
  docNumber: string | null;
  amount: string | null;
  documentLink: string | null;
  customerName: string | null;
}

/**
 * Build the follow-up task set for one opportunity (pure — no I/O).
 * `smsEnabled` decides whether text touches are "open" (dispatchable) or
 * "gated". Email/call touches are always "open".
 */
export function buildFollowupPlan(
  opportunityId: number,
  customerId: number | null,
  ctx: FollowupDocContext,
  now: Date,
  smsEnabled: boolean,
): InsertOpportunityTask[] {
  const label = ctx.docNumber ? `estimate ${ctx.docNumber}` : "estimate";
  const linkLine = ctx.documentLink ? `\nView it here: ${ctx.documentLink}` : "";
  const who = ctx.customerName ?? "there";
  const emailBody =
    `Hi ${who}, following up on your ${label}${ctx.amount ? ` for $${ctx.amount}` : ""}. ` +
    `We'd love to answer any questions and get you scheduled.${linkLine}`;
  const textBody = `Hi ${who}, checking in on your ${label} from Mechanical Enterprise.${linkLine} Reply here with any questions.`;
  const textStatus = smsEnabled ? ("open" as const) : ("gated" as const);

  const tasks: InsertOpportunityTask[] = [
    {
      opportunityId,
      customerId,
      type: "call",
      title: `Call customer about ${label} (same day)`,
      dueAt: endOfDay(now),
      status: "open",
      loopStep: 0,
    },
  ];

  // Day 0 / 1 / 3 email + text touches — the 3-day close loop.
  for (const step of [0, 1, 3]) {
    const dueAt = new Date(now.getTime() + step * DAY_MS);
    tasks.push({
      opportunityId,
      customerId,
      type: "email",
      title: `Email follow-up on ${label}${step ? ` (day ${step})` : ""}`,
      body: emailBody,
      dueAt,
      status: "open",
      loopStep: step,
    });
    tasks.push({
      opportunityId,
      customerId,
      type: "text",
      title: `Text follow-up on ${label}${step ? ` (day ${step})` : ""}`,
      body: textBody,
      dueAt,
      status: textStatus,
      loopStep: step,
    });
  }
  return tasks;
}

/**
 * Idempotently open the follow-up loop for an opportunity. No-op (returns 0) if
 * this opportunity already has any tasks — so calling it on every sync is safe.
 * Returns the number of tasks created.
 */
export async function ensureFollowupsForOpportunity(args: {
  opportunityId: number;
  customerId: number | null;
  doc: FollowupDocContext;
  now?: Date;
  db?: Db;
}): Promise<number> {
  const db = args.db ?? (await getDb());
  if (!db) return 0;
  const now = args.now ?? new Date();

  const existing = await db
    .select({ id: opportunityTasks.id })
    .from(opportunityTasks)
    .where(eq(opportunityTasks.opportunityId, args.opportunityId))
    .limit(1);
  if (existing.length) return 0;

  const plan = buildFollowupPlan(args.opportunityId, args.customerId, args.doc, now, smsFollowupsEnabled());
  await db.insert(opportunityTasks).values(plan);

  // Surface the earliest actionable step on the opportunity for the dashboard.
  const nextCall = plan.find(t => t.type === "call");
  await db
    .update(opportunities)
    .set({ nextAction: nextCall?.title ?? "Follow up", nextActionDueAt: nextCall?.dueAt ?? now })
    .where(eq(opportunities.id, args.opportunityId));

  const gated = plan.filter(t => t.type === "text" && t.status === "gated").length;
  await db.insert(opportunityEvents).values({
    opportunityId: args.opportunityId,
    type: "followup_queued",
    message: `Opened close loop: ${plan.length} tasks (${gated} SMS gated pending 10DLC).`,
    metadata: { total: plan.length, gatedSms: gated },
  });
  return plan.length;
}

/** Cancel any still-open follow-ups (used when a deal closes won/lost). Returns count. */
export async function cancelOpenFollowups(opportunityId: number, reason: string, db?: Db): Promise<number> {
  const database = db ?? (await getDb());
  if (!database) return 0;
  const open = await database
    .select({ id: opportunityTasks.id })
    .from(opportunityTasks)
    .where(
      and(
        eq(opportunityTasks.opportunityId, opportunityId),
        inArray(opportunityTasks.status, ["open", "gated", "snoozed"]),
      ),
    );
  if (!open.length) return 0;
  await database
    .update(opportunityTasks)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(opportunityTasks.opportunityId, opportunityId),
        inArray(opportunityTasks.status, ["open", "gated", "snoozed"]),
      ),
    );
  await database.insert(opportunityEvents).values({
    opportunityId,
    type: "followup_cancelled",
    message: `Cancelled ${open.length} open follow-up(s): ${reason}.`,
  });
  return open.length;
}

export interface DispatchResult {
  processed: number;
  emailsSent: number;
  textsSent: number;
  textsSkippedGated: number;
  failed: number;
}

/**
 * Dispatch due email/text follow-ups (call tasks are for humans and are never
 * auto-sent). Text sends are hard-gated behind SMS_FOLLOWUPS_ENABLED even if a
 * text task somehow reached "open" status — belt and suspenders.
 */
export async function processDueFollowups(args: { now?: Date; db?: Db } = {}): Promise<DispatchResult> {
  const db = args.db ?? (await getDb());
  const result: DispatchResult = { processed: 0, emailsSent: 0, textsSent: 0, textsSkippedGated: 0, failed: 0 };
  if (!db) return result;
  const now = args.now ?? new Date();
  const smsEnabled = smsFollowupsEnabled();

  const due = await db
    .select({
      id: opportunityTasks.id,
      type: opportunityTasks.type,
      title: opportunityTasks.title,
      body: opportunityTasks.body,
      customerId: opportunityTasks.customerId,
      email: customers.email,
      phone: customers.phone,
    })
    .from(opportunityTasks)
    .leftJoin(customers, eq(opportunityTasks.customerId, customers.id))
    .where(
      and(
        eq(opportunityTasks.status, "open"),
        inArray(opportunityTasks.type, ["email", "text"]),
        lte(opportunityTasks.dueAt, now),
      ),
    )
    .orderBy(asc(opportunityTasks.dueAt))
    .limit(200);

  for (const task of due) {
    result.processed++;
    try {
      if (task.type === "text") {
        if (!smsEnabled) {
          // Should not happen (text tasks are created "gated"), but stay safe.
          result.textsSkippedGated++;
          await db.update(opportunityTasks).set({ status: "gated" }).where(eq(opportunityTasks.id, task.id));
          continue;
        }
        if (!task.phone) throw new Error("No phone on customer");
        const r = await sendTelnyxSms(task.phone, task.body ?? task.title);
        if (!r.success) throw new Error(r.error ?? "SMS send failed");
        result.textsSent++;
      } else {
        if (!task.email) throw new Error("No email on customer");
        const ok = await sendEmail({
          to: task.email,
          subject: "Following up on your estimate — Mechanical Enterprise",
          html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.5">${(task.body ?? task.title).replace(/\n/g, "<br>")}</div>`,
        });
        if (!ok) throw new Error("Email send failed");
        result.emailsSent++;
      }
      await db
        .update(opportunityTasks)
        .set({ status: "done", dispatchedAt: now, completedAt: now, lastError: null })
        .where(eq(opportunityTasks.id, task.id));
    } catch (e) {
      result.failed++;
      // Leave "open" so the next poll retries; record why.
      await db
        .update(opportunityTasks)
        .set({ lastError: (e as Error).message.slice(0, 500) })
        .where(eq(opportunityTasks.id, task.id));
    }
    await new Promise(r => setTimeout(r, 150));
  }
  return result;
}
