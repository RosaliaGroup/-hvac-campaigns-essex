/**
 * Growth-system lead cadence engine (docs/growth-system-spec.md §1/§2) —
 * generalizes shared/followupLoop.ts + server/integrations/accounting/followups.ts's
 * task-row pattern from "opportunity close loop" to "new lead cadence":
 *   - dueAt/step rows materialized up front (growthCadenceTasks), idempotent
 *     creation (enrollLeadCadence no-ops if a cadence already exists for this lead),
 *   - dispatch-time compliance gating (gateGrowthSend / gateSmsRecipient are
 *     re-checked at SEND time, not enrollment time, so a STOP after scheduling is
 *     still honored),
 *   - terminal blocks cancel the task/cadence instead of retrying.
 *
 * Kill switches (default TRUE — owner wants live speed-to-lead): GROWTH_SMS_ENABLED,
 * GROWTH_CALLS_ENABLED. When a channel is off, its tasks are created "gated" and
 * dispatch is a no-op for that channel (belt-and-suspenders, same pattern as
 * SMS_FOLLOWUPS_ENABLED in followups.ts).
 */
import { and, eq, inArray, lte, lt } from "drizzle-orm";
import { getDb } from "../../db";
import { growthCadences, growthCadenceTasks, type InsertGrowthCadenceTask } from "../../../drizzle/schema";
import { buildCadenceSteps, normalizeLeadNeed, isB2bNeed, NURTURE_DAY, type LeadNeed } from "../../../shared/growthCadencePlan";
import type { ConsentStatus } from "../../../shared/growthConsent";
import type { UnifiedLead, CadenceSourceTable } from "../../../shared/growthLead";
import { displayFirstName } from "../../../shared/growthLead";
import { wasContactedInLast30Days } from "./touchLedger";
import { sendGrowthSms } from "./sms";
import { makeGrowthOutboundCall } from "./outboundCall";
import { sendGrowthEmail } from "./email";
import { checkGrowthCircuitBreaker } from "./circuitBreaker";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const CAMPAIGN_TYPE = "lead_cadence";

export function growthSmsEnabled(): boolean {
  return process.env.GROWTH_SMS_ENABLED !== "false"; // default TRUE
}
export function growthCallsEnabled(): boolean {
  return process.env.GROWTH_CALLS_ENABLED !== "false"; // default TRUE
}

/**
 * Enroll a lead in the §1/§2 cadence. Idempotent (no-op if this lead already has
 * a cadence row, active or otherwise) and honors the §0/§4 30-day cross-campaign
 * suppression rule — if the contact was touched by ANY campaign in the last 30
 * days, enrollment is skipped (fail-closed: if the suppression check itself
 * cannot be answered, enrollment is also skipped rather than risking a double-touch).
 */
export async function enrollLeadCadence(
  db: Db,
  args: { table: CadenceSourceTable; lead: UnifiedLead; now?: Date },
): Promise<{ cadenceId: number; skipped?: string } | { skipped: string }> {
  const now = args.now ?? new Date();
  const existing = await db
    .select({ id: growthCadences.id })
    .from(growthCadences)
    .where(and(eq(growthCadences.leadTable, args.table), eq(growthCadences.leadId, args.lead.id)))
    .limit(1);
  if (existing.length) return { skipped: "already_enrolled" };

  if (!args.lead.phone && !args.lead.email) return { skipped: "no_contact_info" };

  try {
    const suppressed = await wasContactedInLast30Days(db, { phone: args.lead.phone, email: args.lead.email });
    if (suppressed) return { skipped: "suppressed_30_day" };
  } catch (err) {
    console.warn("[growth] 30-day suppression check failed — skipping enrollment (fail closed):", (err as Error).message);
    return { skipped: "suppression_check_failed" };
  }

  const need = normalizeLeadNeed(args.lead.needRaw);
  const b2b = isB2bNeed(need);

  const insertResult = await db.insert(growthCadences).values({
    leadTable: args.table,
    leadId: args.lead.id,
    contactPhone: args.lead.phone,
    contactEmail: args.lead.email,
    firstName: displayFirstName(args.lead),
    need,
    consentStatus: args.lead.consentStatus,
    campaignType: CAMPAIGN_TYPE,
    status: "active",
    currentStep: 0,
    b2b,
  });
  const cadenceId = Number((insertResult as unknown as [{ insertId: number }])[0]?.insertId ?? 0);

  const steps = buildCadenceSteps({ firstName: displayFirstName(args.lead), need, now });
  const smsOn = growthSmsEnabled();
  const callsOn = growthCallsEnabled();
  const taskRows: InsertGrowthCadenceTask[] = steps.map((s) => {
    const enabled = s.channel === "sms" ? smsOn : s.channel === "call" ? callsOn : true;
    return {
      cadenceId,
      step: s.day,
      channel: s.channel,
      dueAt: s.dueAt,
      status: enabled ? "open" : "gated",
      body: s.channel === "call" ? (s.voicemail ?? null) : s.body,
    };
  });
  await db.insert(growthCadenceTasks).values(taskRows);

  return { cadenceId };
}

/** Dispatch one due task. Never throws — records the outcome on the task row. */
async function dispatchTask(
  db: Db,
  task: typeof growthCadenceTasks.$inferSelect,
  cadence: typeof growthCadences.$inferSelect,
): Promise<void> {
  const need = cadence.need as LeadNeed;
  try {
    if (task.channel === "sms") {
      const result = await sendGrowthSms({
        db, phone: cadence.contactPhone, message: task.body ?? "", consentStatus: cadence.consentStatus,
        campaignType: cadence.campaignType, cadenceId: cadence.id, leadTable: cadence.leadTable, leadId: cadence.leadId, step: task.step,
      });
      await applyDispatchResult(db, task, cadence, result);
    } else if (task.channel === "call") {
      const result = await makeGrowthOutboundCall({
        db, phone: cadence.contactPhone, purpose: `${cadence.campaignType}_day${task.step}`, consentStatus: cadence.consentStatus,
        campaignType: cadence.campaignType, cadenceId: cadence.id, leadTable: cadence.leadTable, leadId: cadence.leadId, step: task.step,
      });
      await applyDispatchResult(db, task, cadence, result);
    } else {
      const result = await sendGrowthEmail({
        db, to: cadence.contactEmail, subject: `Following up on your ${need} request — Mechanical Enterprise`,
        html: task.body ?? "", campaignType: cadence.campaignType, cadenceId: cadence.id, leadTable: cadence.leadTable, leadId: cadence.leadId, step: task.step,
      });
      if (result.outcome === "sent") {
        await db.update(growthCadenceTasks).set({ status: "done", dispatchedAt: new Date() }).where(eq(growthCadenceTasks.id, task.id));
      } else {
        await db.update(growthCadenceTasks).set({ lastError: result.error.slice(0, 500) }).where(eq(growthCadenceTasks.id, task.id));
      }
    }
  } catch (err) {
    await db.update(growthCadenceTasks).set({ lastError: (err as Error).message.slice(0, 500) }).where(eq(growthCadenceTasks.id, task.id));
  }
}

type DispatchOutcome =
  | { outcome: "sent"; messageId?: string; callId?: string }
  | { outcome: "failed"; error: string }
  | { outcome: "blocked"; reason: string; terminal: boolean }
  | { outcome: "held"; holdUntil: Date }
  | { outcome: "not_configured" };

async function applyDispatchResult(
  db: Db,
  task: typeof growthCadenceTasks.$inferSelect,
  cadence: typeof growthCadences.$inferSelect,
  result: DispatchOutcome,
): Promise<void> {
  if (result.outcome === "sent") {
    await db.update(growthCadenceTasks).set({ status: "done", dispatchedAt: new Date() }).where(eq(growthCadenceTasks.id, task.id));
    return;
  }
  if (result.outcome === "held") {
    // Hold, don't drop (spec §1.1) — push this task's dueAt to the next calling window.
    await db.update(growthCadenceTasks).set({ status: "held", dueAt: result.holdUntil }).where(eq(growthCadenceTasks.id, task.id));
    return;
  }
  if (result.outcome === "failed") {
    await db.update(growthCadenceTasks).set({ lastError: result.error.slice(0, 500) }).where(eq(growthCadenceTasks.id, task.id));
    return;
  }
  if (result.outcome === "not_configured") {
    // Owner requirement: fall back to SMS/email only for this step — cancel just
    // this call task (never error/crash, never stop the whole cadence). The
    // scoreboard/growth-settings surface reports `callsConfigured=false` so the
    // owner can see calling is inert until VAPI_API_KEY / VAPI_OUTBOUND_ASSISTANT_ID
    // / VAPI_PHONE_NUMBER_ID are all set.
    await db.update(growthCadenceTasks).set({ status: "cancelled", lastError: "Calls not configured (VAPI_API_KEY/VAPI_OUTBOUND_ASSISTANT_ID/VAPI_PHONE_NUMBER_ID unset)" }).where(eq(growthCadenceTasks.id, task.id));
    return;
  }
  // blocked
  await db.update(growthCadenceTasks).set({ status: "cancelled", lastError: `Blocked: ${result.reason}` }).where(eq(growthCadenceTasks.id, task.id));
  if (result.terminal && (result.reason === "opted_out" || result.reason === "consent_unknown" || result.reason === "invalid_phone")) {
    await stopCadence(db, cadence.id, `Stopped: ${result.reason}`);
  }
}

/**
 * Dispatch the day-0 SMS task for a just-enrolled cadence RIGHT NOW, rather than
 * waiting for the next 60s poll tick — this is what keeps speed-to-lead inside the
 * 60-second bound (spec §1.2). A no-op if the task is missing, already handled, or
 * gated (GROWTH_SMS_ENABLED=false).
 */
export async function dispatchDay0SmsNow(db: Db, cadenceId: number): Promise<void> {
  const [cadence] = await db.select().from(growthCadences).where(eq(growthCadences.id, cadenceId)).limit(1);
  if (!cadence) return;
  const [task] = await db
    .select()
    .from(growthCadenceTasks)
    .where(and(eq(growthCadenceTasks.cadenceId, cadenceId), eq(growthCadenceTasks.step, 0), eq(growthCadenceTasks.channel, "sms"), eq(growthCadenceTasks.status, "open")))
    .limit(1);
  if (!task) return;
  await dispatchTask(db, task, cadence);
}

/** Stop a cadence and cancel every pending task on it. */
export async function stopCadence(db: Db, cadenceId: number, reason: string, status: "stopped" | "replied" | "booked" = "stopped"): Promise<void> {
  await db.update(growthCadences).set({ status, stoppedReason: reason }).where(eq(growthCadences.id, cadenceId));
  await db
    .update(growthCadenceTasks)
    .set({ status: "cancelled" })
    .where(and(eq(growthCadenceTasks.cadenceId, cadenceId), inArray(growthCadenceTasks.status, ["open", "gated", "held"])));
}

/** Any reply → stop the cadence (spec §2). Held/pending tasks are cancelled immediately
 *  like the opportunity followup loop does for terminal blocks — belt-and-suspenders,
 *  since the dispatch-time compliance gate already re-checks STOP on every send. */
export async function stopCadenceOnReply(db: Db, phone: string): Promise<number> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return 0;
  const active = await db
    .select({ id: growthCadences.id, contactPhone: growthCadences.contactPhone })
    .from(growthCadences)
    .where(eq(growthCadences.status, "active"));
  let stopped = 0;
  for (const c of active) {
    if ((c.contactPhone ?? "").replace(/\D/g, "").slice(-10) === digits) {
      await stopCadence(db, c.id, "Lead replied — routed to human", "replied");
      stopped++;
    }
  }
  return stopped;
}

/** A booking stops the cadence outright (spec §2: "Any booking → cadence stops"). */
export async function stopCadenceOnBooking(db: Db, phone: string): Promise<number> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return 0;
  const active = await db.select({ id: growthCadences.id, contactPhone: growthCadences.contactPhone }).from(growthCadences).where(eq(growthCadences.status, "active"));
  let stopped = 0;
  for (const c of active) {
    if ((c.contactPhone ?? "").replace(/\D/g, "").slice(-10) === digits) {
      await stopCadence(db, c.id, "Lead booked an appointment", "booked");
      stopped++;
    }
  }
  return stopped;
}

/** Day-30 terminal transition (spec §2: "Day 30: moves to nurture (monthly)").
 *  No nurture logic is built here — this only stops the cadence and tags the lead. */
export async function sweepCadencesToNurture(db: Db, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - NURTURE_DAY * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: growthCadences.id })
    .from(growthCadences)
    .where(and(eq(growthCadences.status, "active"), lt(growthCadences.createdAt, cutoff)));
  for (const c of stale) {
    await db.update(growthCadences).set({ status: "nurture" }).where(eq(growthCadences.id, c.id));
    await db
      .update(growthCadenceTasks)
      .set({ status: "cancelled" })
      .where(and(eq(growthCadenceTasks.cadenceId, c.id), inArray(growthCadenceTasks.status, ["open", "gated", "held"])));
  }
  return stale.length;
}

export interface ProcessCadenceResult {
  processed: number;
  dispatched: number;
  skippedCircuitBreaker: boolean;
  nurtured: number;
}

/** The poller: dispatch every due task across every active cadence. */
export async function processDueCadenceTasks(db: Db, now: Date = new Date()): Promise<ProcessCadenceResult> {
  const breaker = await checkGrowthCircuitBreaker(db, now).catch((err) => {
    console.warn("[growth] circuit breaker check failed — proceeding without it:", (err as Error).message);
    return { smsPaused: false, smsReason: null, emailPaused: false, emailReason: null };
  });

  const due = await db
    .select({ task: growthCadenceTasks, cadence: growthCadences })
    .from(growthCadenceTasks)
    .innerJoin(growthCadences, eq(growthCadenceTasks.cadenceId, growthCadences.id))
    .where(and(
      inArray(growthCadenceTasks.status, ["open", "held"]),
      lte(growthCadenceTasks.dueAt, now),
      eq(growthCadences.status, "active"),
    ))
    .limit(200);

  let dispatched = 0;
  for (const row of due) {
    if (row.task.channel === "sms" && breaker.smsPaused) continue;
    if (row.task.channel === "email" && breaker.emailPaused) continue;
    await dispatchTask(db, row.task, row.cadence);
    dispatched++;
    await new Promise((r) => setTimeout(r, 100));
  }

  const nurtured = await sweepCadencesToNurture(db, now);
  return { processed: due.length, dispatched, skippedCircuitBreaker: breaker.smsPaused || breaker.emailPaused, nurtured };
}

/** Start the growth cadence poller (every 60s, first pass shortly after boot — day-0
 *  SMS is also dispatched inline at enrollment, but the day-0 CALL (due at +2min) and
 *  every later step rely on this poll, so it must run more often than the opportunity
 *  followup loop's daily/hourly cadence). */
export function startGrowthCadencePoller(): void {
  const run = async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const result = await processDueCadenceTasks(db);
      if (result.dispatched > 0 || result.nurtured > 0) {
        console.log(`[growth] cadence poll: dispatched=${result.dispatched} nurtured=${result.nurtured}`);
      }
    } catch (e) {
      console.warn("[growth] cadence poll failed:", (e as Error).message);
    }
  };
  setTimeout(run, 15_000);
  setInterval(run, 60_000);
  console.log("[growth] cadence poller scheduled (every 60s)");
}
