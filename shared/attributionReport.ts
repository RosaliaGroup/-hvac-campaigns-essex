/**
 * Revenue-attribution reporting core (SEO / revenue-attribution workstream).
 *
 * PURE and DB-agnostic so the correctness guards are unit-testable without a
 * database. The server router (server/routers/attribution.ts) is a thin adapter
 * that loads rows and calls buildRevenueAttribution().
 *
 * ── Why this is tiered, and why that matters ─────────────────────────────────
 * In this CRM every opportunity is created from a QuickBooks sales document with
 * source = "quickbooks"; nothing links a web lead to a deal automatically. So a
 * naive customer → opportunity join would credit organic search for revenue that
 * originated in QuickBooks (walk-ins, phone calls, repeat business, deals that
 * predate the website lead). That is the #1 way attribution goes wrong. To
 * prevent it, every won opportunity lands in exactly ONE tier:
 *
 *   confirmed    — opportunities.sourceLeadCaptureId is set (an explicit,
 *                  auditable human/rule link). This is the number to trust.
 *   inferred     — no explicit link, but the customer has a lead whose capture
 *                  date falls within [wonAt - window, wonAt]. Heuristic and
 *                  LOW confidence; reported separately, never folded into the
 *                  confirmed/organic headline.
 *   unattributed — everything else. Reported explicitly with its dollar total;
 *                  revenue is never silently dropped or spread across pages.
 *
 * The inference window (default 180d) + per-opportunity attribution prevent a
 * single old lead from claiming a customer's entire lifetime of QBO revenue.
 */

import type { Channel } from "./attribution";
import { CHANNELS, normalizePath } from "./attribution";

/** One lead-capture touch, reduced to attribution-relevant fields. */
export interface LeadTouch {
  id: number;
  customerId: number | null;
  channel: Channel;
  /** firstTouchLandingPath from capture (re-normalized here defensively). */
  landingPath: string | null;
  captureType: string | null;
  /** epoch ms */
  createdAt: number;
}

/** One WON opportunity, reduced to attribution-relevant fields. */
export interface WonOpportunity {
  id: number;
  customerId: number | null;
  sourceLeadCaptureId: number | null;
  /** won opportunity value in dollars */
  amount: number;
  /** epoch ms — closedAt if present else createdAt */
  wonAt: number;
}

/** Optional organic-traffic context per page (from seoPages), for revenue-by-page. */
export interface PageTraffic {
  page: string;
  clicks: number;
  impressions: number;
}

export interface AttributionOptions {
  /** Inference window in days; 0 disables inference entirely (confirmed-only). Default 180. */
  inferenceWindowDays?: number;
  /**
   * captureTypes that do NOT count as a "qualified" HVAC lead (newsletters,
   * gated downloads, careers, partnerships). Everything else is qualified.
   */
  nonQualifiedCaptureTypes?: string[];
  /** "now" in epoch ms, for the trailing-7-day qualified-leads metric. */
  nowMs?: number;
  /** Weekly qualified-lead goal (business objective). Default 20. */
  weeklyLeadGoal?: number;
}

const DEFAULT_WINDOW_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NON_QUALIFIED = [
  "newsletter",
  "download_gate",
  "pseg_checklist_download",
  "rebate_guide",
  "lp_rebate_guide",
  "career_application",
  "partnership_inquiry",
];

export type AttributionTier = "confirmed" | "inferred" | "unattributed";

export interface OpportunityAttribution {
  opportunityId: number;
  tier: AttributionTier;
  leadCaptureId: number | null;
  channel: Channel | null;
  landingPath: string | null;
  amount: number;
}

export interface RevenueBucket {
  key: string; // channel name or normalized page path
  leads: number;
  qualifiedLeads: number;
  /** organic GSC clicks for this page (by-page report only; 0 for by-channel). */
  organicClicks: number;
  confirmedWon: number;
  inferredWon: number;
  confirmedRevenue: number;
  inferredRevenue: number;
}

export interface RevenueAttributionReport {
  /** Per-opportunity attribution decisions (audit trail). */
  attributions: OpportunityAttribution[];
  byChannel: RevenueBucket[];
  byPage: RevenueBucket[];
  unattributed: { wonCount: number; revenue: number };
  totals: {
    leads: number;
    qualifiedLeads: number;
    wonOpportunities: number;
    confirmedRevenue: number;
    inferredRevenue: number;
    unattributedRevenue: number;
    /** revenue we can stand behind = confirmed only. */
    attributedRevenue: number;
  };
  weekly: { qualifiedLeadsLast7Days: number; goal: number; metGoal: boolean } | null;
  meta: { inferenceWindowDays: number; note: string };
}

function isQualified(captureType: string | null, nonQualified: Set<string>): boolean {
  if (!captureType) return true; // absence of type: treat as a real inbound
  return !nonQualified.has(captureType);
}

/** Decide the tier + attributed lead for a single won opportunity. */
export function attributeOpportunity(
  opp: WonOpportunity,
  leadsByCustomer: Map<number, LeadTouch[]>,
  leadById: Map<number, LeadTouch>,
  windowMs: number,
): OpportunityAttribution {
  // 1. Confirmed — explicit, auditable link wins unconditionally.
  if (opp.sourceLeadCaptureId != null) {
    const lead = leadById.get(opp.sourceLeadCaptureId);
    if (lead) {
      return {
        opportunityId: opp.id,
        tier: "confirmed",
        leadCaptureId: lead.id,
        channel: lead.channel,
        landingPath: normalizePath(lead.landingPath),
        amount: opp.amount,
      };
    }
    // A dangling link (lead row missing) must NOT silently fall through to a
    // different lead — that would fabricate attribution. Treat as unattributed.
    return { opportunityId: opp.id, tier: "unattributed", leadCaptureId: null, channel: null, landingPath: null, amount: opp.amount };
  }

  // 2. Inferred — customer match within the temporal window (last touch before won).
  if (windowMs > 0 && opp.customerId != null) {
    const candidates = (leadsByCustomer.get(opp.customerId) ?? []).filter(
      l => l.createdAt <= opp.wonAt && opp.wonAt - l.createdAt <= windowMs,
    );
    if (candidates.length) {
      // Last touch within the window (most recent lead preceding the win).
      const lead = candidates.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
      return {
        opportunityId: opp.id,
        tier: "inferred",
        leadCaptureId: lead.id,
        channel: lead.channel,
        landingPath: normalizePath(lead.landingPath),
        amount: opp.amount,
      };
    }
  }

  // 3. Unattributed — honest default.
  return { opportunityId: opp.id, tier: "unattributed", leadCaptureId: null, channel: null, landingPath: null, amount: opp.amount };
}

function emptyBucket(key: string): RevenueBucket {
  return { key, leads: 0, qualifiedLeads: 0, organicClicks: 0, confirmedWon: 0, inferredWon: 0, confirmedRevenue: 0, inferredRevenue: 0 };
}

export function buildRevenueAttribution(
  leads: LeadTouch[],
  wonOpps: WonOpportunity[],
  pageTraffic: PageTraffic[] = [],
  options: AttributionOptions = {},
): RevenueAttributionReport {
  const windowDays = options.inferenceWindowDays ?? DEFAULT_WINDOW_DAYS;
  const windowMs = Math.max(0, windowDays) * DAY_MS;
  const nonQualified = new Set(options.nonQualifiedCaptureTypes ?? DEFAULT_NON_QUALIFIED);
  const goal = options.weeklyLeadGoal ?? 20;

  const leadById = new Map<number, LeadTouch>();
  const leadsByCustomer = new Map<number, LeadTouch[]>();
  for (const l of leads) {
    leadById.set(l.id, l);
    if (l.customerId != null) {
      const arr = leadsByCustomer.get(l.customerId) ?? [];
      arr.push(l);
      leadsByCustomer.set(l.customerId, arr);
    }
  }

  const byChannel = new Map<string, RevenueBucket>();
  const byPage = new Map<string, RevenueBucket>();
  for (const c of CHANNELS) byChannel.set(c, emptyBucket(c));

  // Lead counts (independent of any opportunity).
  for (const l of leads) {
    const ch = byChannel.get(l.channel) ?? emptyBucket(l.channel);
    ch.leads++;
    const q = isQualified(l.captureType, nonQualified);
    if (q) ch.qualifiedLeads++;
    byChannel.set(l.channel, ch);

    const pageKey = normalizePath(l.landingPath);
    const pg = byPage.get(pageKey) ?? emptyBucket(pageKey);
    pg.leads++;
    if (q) pg.qualifiedLeads++;
    byPage.set(pageKey, pg);
  }

  // Organic traffic per page (join by normalized path).
  for (const t of pageTraffic) {
    const key = normalizePath(t.page);
    const pg = byPage.get(key) ?? emptyBucket(key);
    pg.organicClicks += t.clicks;
    byPage.set(key, pg);
  }

  // Attribute won opportunities.
  const attributions: OpportunityAttribution[] = [];
  let confirmedRevenue = 0;
  let inferredRevenue = 0;
  let unattributedRevenue = 0;
  let unattributedWon = 0;

  for (const opp of wonOpps) {
    const a = attributeOpportunity(opp, leadsByCustomer, leadById, windowMs);
    attributions.push(a);
    if (a.tier === "unattributed") {
      unattributedRevenue += a.amount;
      unattributedWon++;
      continue;
    }
    const chKey = a.channel!;
    const ch = byChannel.get(chKey) ?? emptyBucket(chKey);
    const pgKey = a.landingPath ?? "/";
    const pg = byPage.get(pgKey) ?? emptyBucket(pgKey);
    if (a.tier === "confirmed") {
      ch.confirmedWon++; ch.confirmedRevenue += a.amount;
      pg.confirmedWon++; pg.confirmedRevenue += a.amount;
      confirmedRevenue += a.amount;
    } else {
      ch.inferredWon++; ch.inferredRevenue += a.amount;
      pg.inferredWon++; pg.inferredRevenue += a.amount;
      inferredRevenue += a.amount;
    }
    byChannel.set(chKey, ch);
    byPage.set(pgKey, pg);
  }

  // Trailing-7-day qualified leads (only if a clock is provided).
  let weekly: RevenueAttributionReport["weekly"] = null;
  if (options.nowMs != null) {
    const since = options.nowMs - 7 * DAY_MS;
    const count = leads.filter(l => l.createdAt >= since && isQualified(l.captureType, nonQualified)).length;
    weekly = { qualifiedLeadsLast7Days: count, goal, metGoal: count >= goal };
  }

  const qualifiedLeads = leads.filter(l => isQualified(l.captureType, nonQualified)).length;

  const sortBuckets = (m: Map<string, RevenueBucket>) =>
    Array.from(m.values()).sort((a, b) => b.confirmedRevenue + b.inferredRevenue - (a.confirmedRevenue + a.inferredRevenue) || b.leads - a.leads);

  return {
    attributions,
    byChannel: sortBuckets(byChannel),
    byPage: sortBuckets(byPage),
    unattributed: { wonCount: unattributedWon, revenue: unattributedRevenue },
    totals: {
      leads: leads.length,
      qualifiedLeads,
      wonOpportunities: wonOpps.length,
      confirmedRevenue,
      inferredRevenue,
      unattributedRevenue,
      attributedRevenue: confirmedRevenue,
    },
    weekly,
    meta: {
      inferenceWindowDays: windowDays,
      note:
        "confirmedRevenue is the only revenue backed by an explicit lead→deal link. inferredRevenue is a low-confidence customer+time heuristic (all opportunities originate in QuickBooks, so most web→revenue links are not yet established). unattributedRevenue is shown, never spread.",
    },
  };
}
