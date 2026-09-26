/**
 * The growth-system touch ledger — growthTouches is the append-only record of
 * every outbound call/sms/email the growth system sends (§0/§10/§11). This module
 * is the read+write surface for it: recording a touch, counting per-contact
 * per-campaign attempts (the §0/§11 caps), and checking the §0/§4 30-day
 * cross-campaign suppression rule.
 *
 * FAILS CLOSED: every read here that feeds a compliance decision returns a value
 * that makes the CALLER stop sending when the read itself fails (see each
 * function's doc). A thrown error from these functions must never be swallowed
 * into "allow the send".
 */
import { and, eq, gte, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { growthTouches, type InsertGrowthTouch } from "../../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type GrowthChannel = "sms" | "call" | "email";
export type GrowthTouchStatus = "sent" | "failed" | "blocked" | "held";

export interface RecordGrowthTouchArgs {
  channel: GrowthChannel;
  contactPhone?: string | null;
  contactEmail?: string | null;
  leadTable?: "leads" | "leadCaptures" | "imported" | "customer" | null;
  leadId?: number | null;
  campaignType: string;
  cadenceId?: number | null;
  step?: number | null;
  status: GrowthTouchStatus;
  blockedReason?: string | null;
  subject?: string | null;
  body?: string | null;
  providerMessageId?: string | null;
}

/** Insert one row. Never throws — a logging failure must not fail the send/decision it records. */
export async function recordGrowthTouch(db: Db, args: RecordGrowthTouchArgs): Promise<void> {
  try {
    const values: InsertGrowthTouch = {
      channel: args.channel,
      contactPhone: args.contactPhone ?? null,
      contactEmail: args.contactEmail ?? null,
      leadTable: args.leadTable ?? null,
      leadId: args.leadId ?? null,
      campaignType: args.campaignType,
      cadenceId: args.cadenceId ?? null,
      step: args.step ?? null,
      status: args.status,
      blockedReason: args.blockedReason ?? null,
      subject: args.subject ?? null,
      body: args.body ?? null,
      providerMessageId: args.providerMessageId ?? null,
    };
    await db.insert(growthTouches).values(values);
  } catch (err) {
    console.error("[growth] Failed to record touch:", err);
  }
}

const MAX_CALL_ATTEMPTS_PER_CAMPAIGN = 2;
const MAX_TEXT_ATTEMPTS_PER_CAMPAIGN = 3;

export function maxAttemptsFor(channel: GrowthChannel): number | null {
  if (channel === "call") return MAX_CALL_ATTEMPTS_PER_CAMPAIGN;
  if (channel === "sms") return MAX_TEXT_ATTEMPTS_PER_CAMPAIGN;
  return null; // no cap on email
}

/**
 * Count successful ("sent") touches for one cadence + channel — the "per contact
 * per campaign" scope is the cadence instance itself, so a later re-enrollment
 * (after the 30-day suppression window clears) gets a fresh cap. Throws on a DB
 * error rather than returning 0 — callers MUST treat a thrown error as "cannot
 * verify the cap, do not send" (fail closed), never as "cap not yet reached".
 */
export async function countCadenceChannelAttempts(db: Db, cadenceId: number, channel: GrowthChannel): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(growthTouches)
    .where(and(eq(growthTouches.cadenceId, cadenceId), eq(growthTouches.channel, channel), eq(growthTouches.status, "sent")));
  return Number(rows[0]?.n ?? 0);
}

const SUPPRESSION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * True if this contact (by phone or email) was sent ANY sms/call touch by ANY
 * campaign in the last 30 days (§0/§4: "Suppress anyone contacted in the last 30
 * days by any campaign"). Email-only touches do not count toward suppression —
 * the rule targets the higher-friction call/sms channels.
 *
 * Throws on a DB error. Callers MUST treat a thrown error as "assume touched,
 * skip enrollment" (fail closed) — see server/services/growth/compliance.ts.
 */
export async function wasContactedInLast30Days(db: Db, contact: { phone?: string | null; email?: string | null }): Promise<boolean> {
  const since = new Date(Date.now() - SUPPRESSION_WINDOW_MS);
  const phoneDigits = (contact.phone ?? "").replace(/\D/g, "");
  const email = (contact.email ?? "").trim().toLowerCase();
  if (!phoneDigits && !email) return false;

  const conds = [];
  if (phoneDigits.length >= 10) {
    conds.push(sql`RIGHT(REGEXP_REPLACE(${growthTouches.contactPhone}, '[^0-9]', ''), 10) = ${phoneDigits.slice(-10)}`);
  }
  if (email) conds.push(sql`LOWER(${growthTouches.contactEmail}) = ${email}`);
  if (conds.length === 0) return false;

  const rows = await db
    .select({ id: growthTouches.id })
    .from(growthTouches)
    .where(
      and(
        or(...conds),
        or(eq(growthTouches.channel, "sms"), eq(growthTouches.channel, "call")),
        eq(growthTouches.status, "sent"),
        gte(growthTouches.createdAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
