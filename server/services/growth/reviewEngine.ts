/**
 * Review engine (docs/growth-system-spec.md §5).
 *
 * Trigger: a job is marked complete (server/routers/jobs.ts completeJob) OR an
 * appointment's status is set to "completed" (server/routers.ts appointments.updateStatus).
 * Idempotent per job/appointment (reviewRequests has a UNIQUE index on each) —
 * calling ensureReviewRequestForJob/ForAppointment twice is a safe no-op, mirroring
 * ensureFollowupsForOpportunity's pattern.
 *
 * T+2h SMS: "How did we do? Reply 1-5." A numeric 1-5 reply on a pending review
 * request (matched by phone in handleReviewReply, called from the SMS webhook) is
 * NOT a general opt-in for automated contact — reviewRequests carries its own phone
 * and this flow never enrolls the contact in any other campaign. Reply 4-5 -> GBP
 * link + thank-you. Reply 1-3 -> owner alert (never public) + a follow-up-call
 * task. No reply -> one reminder at T+3 days, WITH the link for everyone
 * (spec §5: "recommended: yes, to stay clearly within Google's policy" — implemented
 * as the default here).
 *
 * REVIEWS_ENABLED (default TRUE) gates sending the initial ask; REVIEWS_AUTOREPLY
 * (default FALSE, unrelated to sending) gates auto-posting review responses, which
 * this build does not implement (no review-reply drafting/posting exists yet — see
 * the build report). The weekly digest below is the "response drafts" summary
 * placeholder: it reports counts/average, not drafted replies (deferred — no
 * GBP review-content API integration exists in this codebase).
 */
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { getDb } from "../../db";
import { reviewRequests, customers, jobs, appointments } from "../../../drizzle/schema";
import { sendGrowthSms } from "./sms";
import { notify } from "../../routers/notifications";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const CAMPAIGN_TYPE = "review_engine";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function reviewsEnabled(): boolean {
  return process.env.REVIEWS_ENABLED !== "false"; // default TRUE
}
export function reviewsAutoReplyEnabled(): boolean {
  return process.env.REVIEWS_AUTOREPLY === "true"; // default FALSE
}
function gbpReviewLink(): string | null {
  return process.env.GBP_REVIEW_LINK?.trim() || null;
}

/** Job completion trigger. Idempotent (UNIQUE jobId). */
export async function ensureReviewRequestForJob(db: Db, jobId: number): Promise<void> {
  try {
    const existing = await db.select({ id: reviewRequests.id }).from(reviewRequests).where(eq(reviewRequests.jobId, jobId)).limit(1);
    if (existing.length) return;
    const [job] = await db.select({ customerId: jobs.customerId }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job?.customerId) return;
    const [customer] = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, job.customerId)).limit(1);
    if (!customer?.phone) return;
    await db.insert(reviewRequests).values({ jobId, customerId: job.customerId, phone: customer.phone, status: "pending" });
  } catch (err) {
    console.error("[growth] ensureReviewRequestForJob failed:", err);
  }
}

/** Appointment-completed trigger. Idempotent (UNIQUE appointmentId). */
export async function ensureReviewRequestForAppointment(db: Db, appointmentId: number): Promise<void> {
  try {
    const existing = await db.select({ id: reviewRequests.id }).from(reviewRequests).where(eq(reviewRequests.appointmentId, appointmentId)).limit(1);
    if (existing.length) return;
    const [appt] = await db.select({ phone: appointments.phone, customerId: appointments.customerId }).from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!appt?.phone) return;
    await db.insert(reviewRequests).values({ appointmentId, customerId: appt.customerId ?? null, phone: appt.phone, status: "pending" });
  } catch (err) {
    console.error("[growth] ensureReviewRequestForAppointment failed:", err);
  }
}

/** Poll: send the T+2h ask for pending requests old enough, and the T+3d reminder
 *  for sent-but-unanswered requests. `createdAt`/`sentAt` drive the timing. */
export async function processDueReviewRequests(db: Db, now: Date = new Date()): Promise<{ asked: number; reminded: number }> {
  if (!reviewsEnabled()) return { asked: 0, reminded: 0 };

  let asked = 0;
  const dueAsk = await db
    .select()
    .from(reviewRequests)
    .where(and(eq(reviewRequests.status, "pending"), lt(reviewRequests.createdAt, new Date(now.getTime() - TWO_HOURS_MS))))
    .limit(200);
  for (const r of dueAsk) {
    const result = await sendGrowthSms({
      db, phone: r.phone, consentStatus: "customer", // a just-completed job/appointment IS an existing customer relationship
      message: "How did we do? Reply with a number 1-5 (5 = excellent). Reply STOP to opt out.",
      campaignType: CAMPAIGN_TYPE, leadTable: "customer", leadId: r.customerId, step: 0,
    });
    if (result.outcome === "sent" || result.outcome === "failed") {
      await db.update(reviewRequests).set({ status: "sent", sentAt: now }).where(eq(reviewRequests.id, r.id));
      asked++;
    }
    // "held" (outside calling hours) and "blocked" leave status=pending for a later poll / or forever if terminal.
  }

  let reminded = 0;
  const dueRemind = await db
    .select()
    .from(reviewRequests)
    .where(and(eq(reviewRequests.status, "sent"), isNull(reviewRequests.respondedAt), lt(reviewRequests.sentAt, new Date(now.getTime() - THREE_DAYS_MS))))
    .limit(200);
  for (const r of dueRemind) {
    const link = gbpReviewLink();
    const message = link
      ? `Quick reminder — if you have a moment, we'd love a Google review: ${link}. Thank you!`
      : `Quick reminder — we'd love your feedback on our recent visit. Reply any time. Thank you!`;
    const result = await sendGrowthSms({
      db, phone: r.phone, consentStatus: "customer", message,
      campaignType: CAMPAIGN_TYPE, leadTable: "customer", leadId: r.customerId, step: 3,
    });
    if (result.outcome === "sent" || result.outcome === "failed") {
      await db.update(reviewRequests).set({ status: "reminded", reminderSentAt: now }).where(eq(reviewRequests.id, r.id));
      reminded++;
    }
  }

  return { asked, reminded };
}

/**
 * Handle a numeric 1-5 reply against a pending review request for this phone
 * (called from the SMS webhook's inbound handler). Returns true if a review
 * request was matched and processed.
 */
export async function handleReviewReply(db: Db, phone: string, text: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return false;
  const match = text.trim().match(/^[1-5]$/);
  if (!match) return false;
  const score = Number(match[0]);

  const candidates = await db
    .select()
    .from(reviewRequests)
    .where(and(eq(reviewRequests.status, "sent")))
    .limit(500);
  const pending = candidates.filter((r) => r.phone.replace(/\D/g, "").slice(-10) === digits).sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0];
  if (!pending) return false;

  await db.update(reviewRequests).set({ status: "responded", score, respondedAt: new Date() }).where(eq(reviewRequests.id, pending.id));

  if (score >= 4) {
    const link = gbpReviewLink();
    const thankYou = link
      ? `Thank you! We'd really appreciate a Google review: ${link}`
      : `Thank you! We really appreciate the feedback.`;
    await sendGrowthSms({ db, phone: pending.phone, consentStatus: "customer", message: thankYou, campaignType: CAMPAIGN_TYPE, leadTable: "customer", leadId: pending.customerId, step: 2 });
  } else {
    // 1-3: never a public link — route to the owner immediately (§5) + a follow-up-call task.
    await notify(db, {
      teamMemberIds: [],
      type: "growth_review_negative",
      title: `Low review score (${score}/5) — needs a call within 24h`,
      body: `${pending.phone} — job/appointment #${pending.jobId ?? pending.appointmentId}`,
    });
    await db.update(reviewRequests).set({ ownerFollowupTaskCreatedAt: new Date() }).where(eq(reviewRequests.id, pending.id));
    await sendGrowthSms({ db, phone: pending.phone, consentStatus: "customer", message: "Thanks for letting us know — someone from our team will call you shortly to make it right.", campaignType: CAMPAIGN_TYPE, leadTable: "customer", leadId: pending.customerId, step: 2 });
  }
  return true;
}

export interface ReviewScoreboardStats {
  askedThisWeek: number;
  respondedThisWeek: number;
  averageScoreThisWeek: number | null;
}

/** §10/§5 weekly digest data: count/average. Response DRAFTS are deferred — no GBP
 *  review-content API integration exists in this codebase (see module doc). */
export async function reviewStatsSince(db: Db, since: Date): Promise<ReviewScoreboardStats> {
  const rows = await db.select({ status: reviewRequests.status, score: reviewRequests.score, createdAt: reviewRequests.createdAt }).from(reviewRequests).where(gte(reviewRequests.createdAt, since));
  const asked = rows.length;
  const responded = rows.filter((r) => r.score != null);
  const avg = responded.length ? responded.reduce((s, r) => s + (r.score ?? 0), 0) / responded.length : null;
  return { askedThisWeek: asked, respondedThisWeek: responded.length, averageScoreThisWeek: avg };
}

/** Start the review-engine poller (every 10 minutes — review asks/reminders are not
 *  time-critical the way speed-to-lead is). */
export function startReviewEnginePoller(): void {
  const run = async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const result = await processDueReviewRequests(db);
      if (result.asked > 0 || result.reminded > 0) {
        console.log(`[growth] review poll: asked=${result.asked} reminded=${result.reminded}`);
      }
    } catch (e) {
      console.warn("[growth] review poll failed:", (e as Error).message);
    }
  };
  setTimeout(run, 30_000);
  setInterval(run, 10 * 60_000);
  console.log("[growth] review-engine poller scheduled (every 10 min)");
}
