/**
 * Autonomous Campaign Engine — Mechanical Enterprise
 * 
 * This engine:
 * 1. Reports actual appointment counts separately from the 80 qualified-leads goal.
 * 2. Uses AI (LLM) for READ-ONLY recommendations, never campaign writes.
 * 3. Labels CRM-verified monthly unique leads UNKNOWN until deduplicated source
 *    attribution is available; appointments and Google Ads events are not leads.
 * 4. Does not assume Google Ads is paused, Meta is connected, or budgets are free.
 * 5. Produces a weekly diagnostic plan without inventing conversion outcomes.
 */

import { gte } from "drizzle-orm";
import { leadCaptures } from "../../drizzle/schema";
import * as db from "../db";

const WEEKLY_GOAL = 20; // appointments; a separate operational metric, NOT the lead count
const QUALIFIED_LEAD_GOAL_MONTHLY = 80;

export interface CampaignAnalysis {
  /** Unique qualified HVAC inquiries per calendar month, NOT appointments. */
  qualifiedLeadGoalMonthly: number;
  /** Null until CRM dedupe + eligibility + source attribution are verified. */
  verifiedQualifiedLeadsMonthly: null;
  qualifiedLeadAttributionStatus: "unknown";
  /** Operational appointment metric, never represented as unique qualified leads. */
  weeklyGoal: number;
  thisWeekCount: number;
  gapToGoal: number;
  percentToGoal: number;
  trend: "on_track" | "behind" | "critical" | "exceeding";
  weeklyTrend: { week: string; count: number; goal: number }[];
  recommendations: AIRecommendation[];
  generatedAt: string;
}

export interface AIRecommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "budget" | "targeting" | "creative" | "new_campaign" | "jessica" | "seo";
  title: string;
  description: string;
  expectedImpact: string;
  action: string;
  actionType: "push_to_google_ads" | "update_script" | "adjust_budget" | "create_campaign" | "manual";
  campaignData?: GeneratedCampaign | null;
}

export interface GeneratedCampaign {
  name: string;
  type: "search" | "performance_max";
  budget: number;
  targetLocations: string[];
  keywords: string[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  callToAction: string;
}

export async function runCampaignAnalysis(): Promise<CampaignAnalysis> {
  // Get appointment data
  const stats = await db.getAppointmentStats();
  const weeklyTrend = await db.getWeeklyAppointmentCounts(8);

  const thisWeekCount = stats.thisWeek;
  const gapToGoal = Math.max(0, WEEKLY_GOAL - thisWeekCount);
  const percentToGoal = Math.min(100, Math.round((thisWeekCount / WEEKLY_GOAL) * 100));

  let trend: CampaignAnalysis["trend"];
  if (thisWeekCount >= WEEKLY_GOAL) trend = "exceeding";
  else if (percentToGoal >= 75) trend = "on_track";
  else if (percentToGoal >= 40) trend = "behind";
  else trend = "critical";

  // Use actual CRM intake observations to prioritize a read-only action queue.
  // No paid AI call on page load, and no implied campaign activation.
  const crmSnapshot = await readCrmIntakeSnapshot();
  const recommendations = buildEvidenceBasedRecommendations(crmSnapshot);

  return {
    qualifiedLeadGoalMonthly: QUALIFIED_LEAD_GOAL_MONTHLY,
    verifiedQualifiedLeadsMonthly: null,
    qualifiedLeadAttributionStatus: "unknown",
    weeklyGoal: WEEKLY_GOAL,
    thisWeekCount,
    gapToGoal,
    percentToGoal,
    trend,
    weeklyTrend,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Website capture records only: an operational 30-day sample, not the
 * 80/month unique qualified lead total across CRM, calls, emails and Meta.
 */
export type CrmIntakeSnapshot = {
  rawCaptures: number;
  newUnassigned: number;
  overdueFollowUps: number;
  unknownChannel: number;
  advancedStageRecords: number;
};

async function readCrmIntakeSnapshot(): Promise<CrmIntakeSnapshot | null> {
  try {
    const database = await db.getDb();
    if (!database) return null;
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await database.select({
      status: leadCaptures.status,
      assignedTo: leadCaptures.assignedTo,
      followUpAt: leadCaptures.followUpAt,
      channel: leadCaptures.channel,
    }).from(leadCaptures).where(gte(leadCaptures.createdAt, since));
    const now = Date.now();
    const advancedStages = new Set(["qualified", "assessment_scheduled", "assessment_completed", "proposal_sent", "won", "booked"]);
    return {
      rawCaptures: rows.length,
      newUnassigned: rows.filter(r => r.status === "new" && !r.assignedTo).length,
      overdueFollowUps: rows.filter(r => r.followUpAt && new Date(r.followUpAt).getTime() < now && r.status !== "won" && r.status !== "lost").length,
      unknownChannel: rows.filter(r => !r.channel || r.channel === "unknown").length,
      advancedStageRecords: rows.filter(r => advancedStages.has(r.status)).length,
    };
  } catch (err) {
    console.warn("[CampaignEngine] CRM intake unavailable; no lead count inferred:", (err as Error).message);
    return null;
  }
}

/** Pure, evidence-based priorities. No unverified conversions or invented lift. */
export function buildEvidenceBasedRecommendations(snapshot: CrmIntakeSnapshot | null): AIRecommendation[] {
  const recs: AIRecommendation[] = [];
  const add = (id: string, priority: AIRecommendation["priority"], category: AIRecommendation["category"], title: string, description: string, action: string) => {
    recs.push({ id, priority, category, title, description, action, actionType: "manual", campaignData: null, expectedImpact: "Not yet measured" });
  };

  if (snapshot?.newUnassigned) {
    add("crm_unassigned", "high", "targeting",
      `Review ${snapshot.newUnassigned} unassigned new website lead record(s)`,
      "These are CRM records in the last 30 days, not yet verified as genuine or unique. Unassigned records may delay a response.",
      "Open the existing Lead Dashboard, validate each request and assign a human owner; do not send duplicate messages.");
  }
  if (snapshot?.overdueFollowUps) {
    add("crm_overdue", "high", "jessica",
      `Review ${snapshot.overdueFollowUps} overdue website lead follow-up(s)`,
      "These CRM follow-up dates have passed. A due date does not establish that a customer was reached.",
      "Reconcile existing CRM communications and provider delivery before creating any owner callback tasks.");
  }
  if (snapshot?.unknownChannel) {
    add("crm_attribution", "high", "targeting",
      `Investigate ${snapshot.unknownChannel} website lead record(s) with unknown source`,
      "Missing campaign attribution prevents reliable lead-quality and cost-per-qualified-lead comparisons.",
      "Inspect first-touch landing URLs, gclid, UTM parameters and referrer for actual submissions; do not assign a guessed source.");
  }

  add("google_ads_audit", "high", "targeting",
    "Reconcile Google Ads clicks with genuine CRM inquiries",
    "The historical October 20–26 Google Ads screenshot showed clicks and zero Ads-reported conversions, but current live conversions and qualified lead counts remain unverified.",
    "Read the current account 783-370-2890 search terms, spend, conversion diagnostics and real inbound CRM source records before changing paid settings.");

  add("netlify_content", "medium", "seo",
    "Verify commercial HVAC blogs are public and lead forms work",
    "GitHub and Railway deployments do not confirm public Netlify publication, Google indexing or an accepted CRM inquiry.",
    "Check live Netlify URLs, titles, service-request CTAs and authenticated Search Console inspection without test leads or repeated indexing requests.");

  add("meta_auth", "medium", "creative",
    "Restore and verify Facebook / Instagram lead capture",
    "Meta authorization and Instant Form delivery were not verified after the URL Blocked error; campaign results and spend remain unknown.",
    "Complete Meta's allowed redirect URI and owner authorization, then read live account and CRM attribution before enabling any campaigns.");

  if (!snapshot) {
    add("crm_unavailable", "high", "targeting",
      "CRM intake data unavailable — qualification count unknown",
      "The marketing analyzer cannot read current website lead records. Do not substitute appointment totals or Google Ads events.",
      "Review the existing Lead Dashboard and its data connection; reconcile inbound calls and replies with deduplicated records.");
  } else if (snapshot.rawCaptures > 0 && snapshot.advancedStageRecords === 0) {
    add("crm_qualification", "medium", "targeting",
      "Review website inquiries awaiting qualification",
      `${snapshot.rawCaptures} website capture record(s) were stored in 30 days, but none currently has an advanced pipeline stage. This is not proof of zero qualified inquiries.`,
      "Review genuine HVAC intent, geography and duplicates, then update stages in the existing CRM.");
  }

  // Highest priority first; cap to five actions so the page stays focused.
  return recs.sort((a,b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.priority] - { critical: 0, high: 1, medium: 2, low: 3 }[b.priority])).slice(0,5);
}
