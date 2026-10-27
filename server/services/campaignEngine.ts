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

import { invokeLLM } from "../_core/llm";
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

  // Calculate average over last 4 weeks
  const last4Weeks = weeklyTrend.slice(-4);
  const avgLast4 = last4Weeks.length > 0
    ? Math.round(last4Weeks.reduce((sum, w) => sum + w.count, 0) / last4Weeks.length)
    : 0;

  // Generate AI recommendations
  const recommendations = await generateAIRecommendations({
    thisWeekCount,
    gapToGoal,
    percentToGoal,
    trend,
    avgLast4,
    totalAppointments: stats.total,
    weeklyTrend,
  });

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

async function generateAIRecommendations(context: {
  thisWeekCount: number;
  gapToGoal: number;
  percentToGoal: number;
  trend: string;
  avgLast4: number;
  totalAppointments: number;
  weeklyTrend: { week: string; count: number }[];
}): Promise<AIRecommendation[]> {
  const prompt = `You are a senior HVAC marketing strategist for Mechanical Enterprise LLC, a New Jersey HVAC company specializing in heat pumps, VRV/VRF systems, and PSE&G rebate programs.

CURRENT PERFORMANCE:
- Business objective: at least 80 UNIQUE CRM-qualified, deduplicated HVAC inquiries per calendar month (working pace 20/week).
- Verified monthly qualified leads: UNKNOWN — no reconciled source/eligibility/deduplication dataset is supplied to this analysis. Never infer it from appointments, clicks, platform conversion events or emails.
- The appointment figures below are a DIFFERENT operational metric, not evidence of qualified leads.
- Weekly appointment goal: 20 appointments
- This week: ${context.thisWeekCount} appointments booked
- Gap to goal: ${context.gapToGoal} more needed
- Progress: ${context.percentToGoal}% of goal
- Status: ${context.trend.replace("_", " ").toUpperCase()}
- 4-week average: ${context.avgLast4} appointments/week
- Total all-time: ${context.totalAppointments} appointments

AVAILABLE CHANNELS:
- Google Ads — live status, campaign spend and conversions UNKNOWN in this analysis. Owner screenshots for account 783-370-2890 showed traffic in Oct 20–26, 2026; do NOT claim ads are paused, and do NOT reuse that old period as current results. Recommend a read-only live search-term/spend/CRM-quality review before any changes.
- Meta Ads — authorization and real lead delivery unverified. Do NOT claim Facebook/Instagram campaigns are running or producing leads.
- Unpaid Facebook/Instagram content and referrals
- Jessica (AI phone assistant) — handles inbound calls
- SMS follow-up sequences
- Google Business Profile posts
- Organic SEO

Generate exactly 5 specific, actionable NO-ADDITIONAL-SPEND recommendations to improve genuine qualified HVAC inquiries toward 80/month while keeping the separate appointment metric visible. You MAY recommend a READ-ONLY review of existing paid campaign search terms, verified spend, geographic fit, live conversion actions and CRM source attribution, but must NOT create/activate paid campaigns, change budgets or bids, or claim such changes have occurred. Use actionType manual or update_script and campaignData null. Do not invent results, conversion rates, lead counts or performance lift. When data is missing say UNKNOWN and specify the evidence needed.

Return ONLY valid JSON in this exact format:
{
  "recommendations": [
    {
      "id": "rec_1",
      "priority": "critical|high|medium|low",
      "category": "budget|targeting|creative|new_campaign|jessica|seo",
      "title": "Short action title",
      "description": "2-3 sentence explanation of why this will work",
      "expectedImpact": "e.g. +4 appointments/week",
      "action": "Specific step to take right now",
      "actionType": "push_to_google_ads|update_script|adjust_budget|create_campaign|manual",
      "campaignData": null
    }
  ]
}

Do not generate paid campaignData or use actionType push_to_google_ads, adjust_budget, or create_campaign. These remain in the JSON schema for backwards compatibility only.

Focus on no-additional-spend lead generation through SEO, referrals, existing CRM reactivation, opt-in follow-up and organic content. Avoid unverified rebate and service claims.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a marketing AI that returns only valid JSON. No markdown, no explanation, just the JSON object." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "campaign_recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    priority: { type: "string" },
                    category: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    expectedImpact: { type: "string" },
                    action: { type: "string" },
                    actionType: { type: "string" },
                    campaignData: {
                      anyOf: [
                        { type: "null" },
                        {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            type: { type: "string" },
                            budget: { type: "number" },
                            targetLocations: { type: "array", items: { type: "string" } },
                            keywords: { type: "array", items: { type: "string" } },
                            headlines: { type: "array", items: { type: "string" } },
                            descriptions: { type: "array", items: { type: "string" } },
                            finalUrl: { type: "string" },
                            callToAction: { type: "string" },
                          },
                          required: ["name", "type", "budget", "targetLocations", "keywords", "headlines", "descriptions", "finalUrl", "callToAction"],
                          additionalProperties: false,
                        },
                      ],
                    },
                  },
                  required: ["id", "priority", "category", "title", "description", "expectedImpact", "action", "actionType", "campaignData"],
                  additionalProperties: false,
                },
              },
            },
            required: ["recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return getFallbackRecommendations(context.gapToGoal);

    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return (Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((r: AIRecommendation) => !["adjust_budget","push_to_google_ads","create_campaign"].includes(r.actionType) && r.campaignData == null && !/\b(ads? budget|paid ads?|ad spend|google ads campaign)\b/i.test(r.action + " " + r.description)) : []).slice(0,5).length ? (parsed.recommendations as AIRecommendation[]).filter((r) => !["adjust_budget","push_to_google_ads","create_campaign"].includes(r.actionType) && r.campaignData == null && !/\b(ads? budget|paid ads?|ad spend|google ads campaign)\b/i.test(r.action + " " + r.description)).slice(0,5) : getFallbackRecommendations(context.gapToGoal);
  } catch (err) {
    console.error("[CampaignEngine] AI recommendation error:", err);
    return getFallbackRecommendations(context.gapToGoal);
  }
}

function getFallbackRecommendations(gapToGoal: number): AIRecommendation[] {
  const ideas: Array<[AIRecommendation["category"], string, string, string]> = [
    ["targeting", "Audit existing paid-search lead quality", "Read actual Google Ads search terms, spend, local targeting and conversion actions, then reconcile inbound calls/forms with CRM; do not change paid settings automatically.", "Identify irrelevant search terms and tracking gaps for owner review without changing budget or bids."],
    ["seo", "Verify organic blog publishing", "Inspect the scheduled draft-to-live pipeline and repair blocked batches without bypassing quality checks.", "Audit drafts, PR checks, independent Netlify publication and live URLs."],
    ["targeting", "Reactivate existing qualified CRM leads", "Review prior inquiries and estimates; follow up only with eligible contacts who have not opted out.", "Create owner tasks for stale qualified opportunities and track responses."],
    ["creative", "Publish organic service content", "Repurpose verified HVAC expertise into free website, Google Business Profile and social posts.", "Prepare useful service FAQs and factual posts for review."],
    ["jessica", "Recover missed inbound inquiries", "Check missed-call and form follow-up paths, respecting SMS consent and opt-outs.", "Audit callback tasks, booking links and message delivery."],
    ["targeting", "Develop referral partnerships", "Use the existing approved outreach workflow for verified property managers and GC estimators, with suppression and consent safeguards.", "Review the existing referral follow-up queue and attribute positive inbound replies."]
  ];
  return ideas.slice(0, 5).map(([category,title,description,action],i) => ({
    id: "organic_fallback_" + (i+1),
    priority: i === 0 && gapToGoal > 0 ? "high" : "medium",
    category, title, description, expectedImpact: "Not yet measured",
    action, actionType: "manual", campaignData: null
  }));
}
