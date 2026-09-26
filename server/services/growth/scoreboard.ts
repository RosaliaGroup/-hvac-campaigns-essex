/**
 * §10 growth scoreboard — leads MTD vs 80 target, run-rate, by source/type,
 * qualified/booked rate, speed-to-lead median, cadence response rates, reviews
 * this week, quotes open/won/lost (deferred — see note below), and a one-line
 * "gap plan" heuristic.
 *
 * No sibling market-intel report page exists on `main` yet (checked: only
 * docs/market-intel-spec.md, no implementation) — this is a STANDALONE surface
 * (server/routers/growth.ts `scoreboard` procedure + a CRM page), per the spec's
 * fallback instruction ("build standalone if it's not on main").
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { leads, leadCaptures, growthTouches, growthCadences } from "../../../drizzle/schema";
import { listUnifiedLeadsSince } from "./leadAdapter";
import { reviewStatsSince } from "./reviewEngine";
import { isVapiOutboundConfigured } from "./outboundCall";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const MONTHLY_LEAD_TARGET = 80;

function monthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface ScoreboardResult {
  leadsMtd: number;
  target: typeof MONTHLY_LEAD_TARGET;
  runRatePerDay: number;
  projectedMonthEnd: number;
  bySource: Array<{ source: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  qualifiedRate: number | null;
  bookedRate: number | null;
  speedToLeadMedianSeconds: number | null;
  cadenceResponseRate: number | null;
  reviewsThisWeek: { asked: number; responded: number; average: number | null };
  quotes: { open: number; won: number; lost: number } | null;
  quotesDeferredReason: string | null;
  gapPlan: string | null;
  /** False in production today: VAPI_API_KEY / VAPI_OUTBOUND_ASSISTANT_ID /
   *  VAPI_PHONE_NUMBER_ID are unset, so every cadence call step falls back to
   *  SMS/email only. See server/services/growth/outboundCall.ts. */
  callsConfigured: boolean;
}

/** Speed-to-lead median: time from lead creation to the first "sent" SMS touch
 *  tagged campaignType="lead_cadence" step=0, joined by cadence -> lead createdAt. */
async function speedToLeadMedianSeconds(db: Db, since: Date): Promise<number | null> {
  const rows = await db
    .select({ cadenceCreatedAt: growthCadences.createdAt, touchCreatedAt: growthTouches.createdAt })
    .from(growthTouches)
    .innerJoin(growthCadences, eq(growthTouches.cadenceId, growthCadences.id))
    .where(and(eq(growthTouches.channel, "sms"), eq(growthTouches.step, 0), eq(growthTouches.status, "sent"), gte(growthCadences.createdAt, since)));
  if (!rows.length) return null;
  const deltas = rows.map((r) => (r.touchCreatedAt.getTime() - r.cadenceCreatedAt.getTime()) / 1000).sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  return deltas.length % 2 === 0 ? (deltas[mid - 1] + deltas[mid]) / 2 : deltas[mid];
}

/** Cadence response rate: cadences that reached status "replied" or "booked" ÷
 *  all cadences enrolled since `since`. */
async function cadenceResponseRate(db: Db, since: Date): Promise<number | null> {
  const rows = await db.select({ status: growthCadences.status }).from(growthCadences).where(gte(growthCadences.createdAt, since));
  if (!rows.length) return null;
  const responded = rows.filter((r) => r.status === "replied" || r.status === "booked").length;
  return responded / rows.length;
}

export async function buildScoreboard(db: Db, now: Date = new Date()): Promise<ScoreboardResult> {
  const since = monthStart(now);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const unified = await listUnifiedLeadsSince(db, since);
  const leadsMtd = unified.length;
  const runRatePerDay = dayOfMonth > 0 ? leadsMtd / dayOfMonth : 0;
  const projectedMonthEnd = Math.round(runRatePerDay * daysInMonth);

  const bySourceMap = new Map<string, number>();
  const byTypeMap = new Map<string, number>();
  for (const l of unified) {
    const src = l.source ?? "unknown";
    bySourceMap.set(src, (bySourceMap.get(src) ?? 0) + 1);
    const type = l.table === "leads" ? "manual_lead" : "web_capture";
    byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + 1);
  }

  // "Qualified" (spec §0: reached + confirmed need + in service area) has no
  // dedicated boolean field on either table today — approximated by "reached a
  // non-'new' pipeline stage", the closest existing signal (see the function doc).
  const qualifiedRate = leadsMtd > 0 ? await approximateQualifiedRate(db, since, leadsMtd) : null;
  const bookedRate = leadsMtd > 0 ? await approximateBookedRate(db, since, leadsMtd) : null;

  const [medianSeconds, responseRate, reviewStats] = await Promise.all([
    speedToLeadMedianSeconds(db, since),
    cadenceResponseRate(db, since),
    reviewStatsSince(db, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
  ]);

  const gapPlan = buildGapPlan({ runRatePerDay, dayOfMonth, target: MONTHLY_LEAD_TARGET, daysInMonth, responseRate });

  return {
    leadsMtd,
    target: MONTHLY_LEAD_TARGET,
    runRatePerDay: Number(runRatePerDay.toFixed(2)),
    projectedMonthEnd,
    bySource: Array.from(bySourceMap, ([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    byType: Array.from(byTypeMap, ([type, count]) => ({ type, count })),
    qualifiedRate,
    bookedRate,
    speedToLeadMedianSeconds: medianSeconds,
    cadenceResponseRate: responseRate,
    reviewsThisWeek: { asked: reviewStats.askedThisWeek, responded: reviewStats.respondedThisWeek, average: reviewStats.averageScoreThisWeek },
    quotes: null,
    quotesDeferredReason:
      "Deferred — this build's cadence/import/scoreboard scope did not include a quote/proposal open-won-lost aggregation. " +
      "`opportunities`/`estimates` carry stage/status data that COULD answer this, but wiring it needs its own mapping of " +
      "opportunity stages -> open/won/lost that stays consistent with shared/stageMeta.ts; out of scope for this PR.",
    gapPlan,
    callsConfigured: isVapiOutboundConfigured(),
  };
}

/** Approximates §0's "qualified" (reached + need confirmed + in service area) as
 *  "left the 'new' stage" — the closest existing signal on either table. */
async function approximateQualifiedRate(db: Db, since: Date, leadsMtd: number): Promise<number> {
  const [leadRows, captureRows] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)` }).from(leads).where(and(gte(leads.createdAt, since), sql`${leads.status} <> 'new'`)),
    db.select({ n: sql<number>`COUNT(*)` }).from(leadCaptures).where(and(gte(leadCaptures.createdAt, since), sql`${leadCaptures.status} <> 'new'`)),
  ]);
  const qualified = Number(leadRows[0]?.n ?? 0) + Number(captureRows[0]?.n ?? 0);
  return leadsMtd > 0 ? qualified / leadsMtd : 0;
}

/** Booked = reached "won" (leads) or "booked"/"assessment_scheduled"+ (leadCaptures). */
async function approximateBookedRate(db: Db, since: Date, leadsMtd: number): Promise<number> {
  const [leadRows, captureRows] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)` }).from(leads).where(and(gte(leads.createdAt, since), eq(leads.status, "won"))),
    db.select({ n: sql<number>`COUNT(*)` }).from(leadCaptures).where(and(gte(leadCaptures.createdAt, since), sql`${leadCaptures.status} IN ('booked','assessment_scheduled','assessment_completed','won')`)),
  ]);
  const booked = Number(leadRows[0]?.n ?? 0) + Number(captureRows[0]?.n ?? 0);
  return leadsMtd > 0 ? booked / leadsMtd : 0;
}

/** One-line heuristic pointing at the weakest lever (spec §10: "not over-built"). */
function buildGapPlan(args: { runRatePerDay: number; dayOfMonth: number; target: number; daysInMonth: number; responseRate: number | null }): string | null {
  const expectedByNow = (args.target / args.daysInMonth) * args.dayOfMonth;
  const projected = args.runRatePerDay * args.daysInMonth;
  if (projected >= args.target) return null;
  if (args.responseRate != null && args.responseRate < 0.15) {
    return `Behind pace (projected ${Math.round(projected)}/${args.target}) — cadence response rate is low (${(args.responseRate * 100).toFixed(0)}%); consider an A/B test on the day-1/day-14 SMS value line before adding spend.`;
  }
  return `Behind pace: ${Math.round(projected)} projected vs ${args.target} target (expected ~${Math.round(expectedByNow)} by day ${args.dayOfMonth}). Consider more LSA/ad budget (§8, not yet configured) or running a reactivation segment (§4, not yet built).`;
}
