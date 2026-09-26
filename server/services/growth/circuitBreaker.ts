/**
 * Growth-system circuit breaker (docs/growth-system-spec.md §11): "complaint rate
 * > 0.3% or bounce > 5% pauses the channel; a review-engine complaint pauses
 * reviews; owner resumes." Modeled after server/services/seo/circuitBreaker.ts's
 * split of a pure evaluator + a thin DB-reading wrapper, but simplified: this
 * evaluates FRESH on every poll rather than persisting a paused flag across
 * restarts (there is no growth-specific state table — see the build report for
 * why that was judged unnecessary for this scope). A poller (cadenceEngine.ts)
 * calls checkGrowthCircuitBreaker() once per run and skips sends on that channel
 * for the whole run if paused; it is not a substitute for a persisted admin
 * pause/resume workflow, which would need its own table if reintroduced.
 *
 * Complaint rate proxy: STOP replies (smsInboxMessages.isOptOut) in the last 7
 * days ÷ growth SMS sent in the last 7 days. Bounce rate proxy: failed growth
 * email touches ÷ sent+failed growth email touches in the last 7 days. Both are
 * documented approximations (no carrier-level complaint feed or Resend bounce
 * webhook is wired into this repo today).
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { growthTouches, smsInboxMessages } from "../../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const COMPLAINT_RATE_THRESHOLD = 0.003; // 0.3%
const BOUNCE_RATE_THRESHOLD = 0.05; // 5%

export type GrowthChannelName = "sms" | "call" | "email" | "reviews";

export interface GrowthCircuitBreakerSignals {
  smsSentLast7d: number;
  smsStopLast7d: number;
  emailSentLast7d: number;
  emailFailedLast7d: number;
}

export interface GrowthCircuitBreakerResult {
  smsPaused: boolean;
  smsReason: string | null;
  emailPaused: boolean;
  emailReason: string | null;
}

/** Pure — no I/O. */
export function evaluateGrowthCircuitBreakerSignals(signals: GrowthCircuitBreakerSignals): GrowthCircuitBreakerResult {
  let smsPaused = false;
  let smsReason: string | null = null;
  if (signals.smsSentLast7d > 0) {
    const complaintRate = signals.smsStopLast7d / signals.smsSentLast7d;
    if (complaintRate > COMPLAINT_RATE_THRESHOLD) {
      smsPaused = true;
      smsReason = `SMS complaint (STOP) rate ${(complaintRate * 100).toFixed(2)}% over the last 7 days exceeds 0.3%.`;
    }
  }

  let emailPaused = false;
  let emailReason: string | null = null;
  const emailAttempts = signals.emailSentLast7d + signals.emailFailedLast7d;
  if (emailAttempts > 0) {
    const bounceRate = signals.emailFailedLast7d / emailAttempts;
    if (bounceRate > BOUNCE_RATE_THRESHOLD) {
      emailPaused = true;
      emailReason = `Email failure/bounce-proxy rate ${(bounceRate * 100).toFixed(2)}% over the last 7 days exceeds 5%.`;
    }
  }

  return { smsPaused, smsReason, emailPaused, emailReason };
}

/** Fetch real signals from the last 7 days and evaluate. */
export async function checkGrowthCircuitBreaker(db: Db, now: Date = new Date()): Promise<GrowthCircuitBreakerResult> {
  const since = new Date(now.getTime() - SEVEN_DAYS_MS);

  const [smsSentRow] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(growthTouches)
    .where(and(eq(growthTouches.channel, "sms"), eq(growthTouches.status, "sent"), gte(growthTouches.createdAt, since)));
  const [smsStopRow] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(smsInboxMessages)
    .where(and(eq(smsInboxMessages.direction, "inbound"), eq(smsInboxMessages.isOptOut, true), gte(smsInboxMessages.createdAt, since)));
  const [emailSentRow] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(growthTouches)
    .where(and(eq(growthTouches.channel, "email"), eq(growthTouches.status, "sent"), gte(growthTouches.createdAt, since)));
  const [emailFailedRow] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(growthTouches)
    .where(and(eq(growthTouches.channel, "email"), eq(growthTouches.status, "failed"), gte(growthTouches.createdAt, since)));

  return evaluateGrowthCircuitBreakerSignals({
    smsSentLast7d: Number(smsSentRow?.n ?? 0),
    smsStopLast7d: Number(smsStopRow?.n ?? 0),
    emailSentLast7d: Number(emailSentRow?.n ?? 0),
    emailFailedLast7d: Number(emailFailedRow?.n ?? 0),
  });
}
