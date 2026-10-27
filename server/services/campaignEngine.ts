/**
 * Autonomous Campaign Engine — Mechanical Enterprise
 * 
 * This engine:
 * 1. Analyzes weekly appointment performance vs 20/week goal
 * 2. Scores active campaigns by efficiency
 * 3. Uses AI (LLM) to generate specific recommendations
 * 4. Generates new campaign variants when below goal
 * 5. Produces a weekly action plan
 */

import { invokeLLM } from "../_core/llm";
import * as db from "../db";

const WEEKLY_GOAL = 20;

export interface CampaignAnalysis {
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
- Weekly goal: 20 appointments
- This week: ${context.thisWeekCount} appointments booked
- Gap to goal: ${context.gapToGoal} more needed
- Progress: ${context.percentToGoal}% of goal
- Status: ${context.trend.replace("_", " ").toUpperCase()}
- 4-week average: ${context.avgLast4} appointments/week
- Total all-time: ${context.totalAppointments} appointments

AVAILABLE CHANNELS:
- Google Ads — paused; do not recommend activating or spending on ads
- Unpaid Facebook/Instagram content and referrals
- Jessica (AI phone assistant) — handles inbound calls
- SMS follow-up sequences
- Google Business Profile posts
- Organic SEO

Generate exactly 5 specific, actionable ZERO-AD-SPEND recommendations to close the gap to 20 appointments/week. Do not recommend creating or activating paid campaigns, adjusting budgets, or any paid advertising. Use actionType manual or update_script and campaignData null. Do not invent results or performance lift.

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

For any recommendation with actionType "push_to_google_ads" or "create_campaign", include campaignData:
{
  "name": "Campaign name",
  "type": "search|performance_max",
  "budget": 25,
  "targetLocations": ["Essex County NJ", "Newark NJ", "Montclair NJ"],
  "keywords": ["hvac repair newark nj", "heat pump installation essex county"],
  "headlines": ["Expert HVAC in New Jersey", "Up to $16K in Rebates", "Free Consultation Today"],
  "descriptions": ["NJ's top-rated HVAC company. Heat pumps, VRV/VRF, 24/7 emergency service.", "PSE&G certified. Zero upfront cost. Call for your free rebate assessment."],
  "finalUrl": "https://mechanicalenterprise.com/lp/heat-pump-rebates",
  "callToAction": "Get Free Quote"
}

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
    ["seo", "Verify organic blog publishing", "Inspect the scheduled draft-to-live pipeline and repair blocked batches without bypassing quality checks.", "Audit drafts, PR checks, deployment and live URLs."],
    ["targeting", "Reactivate existing qualified CRM leads", "Review prior inquiries and estimates; follow up only with eligible contacts who have not opted out.", "Create owner tasks for stale qualified opportunities and track responses."],
    ["creative", "Publish organic service content", "Repurpose verified HVAC expertise into free website, Google Business Profile and social posts.", "Prepare useful service FAQs and factual posts for review."],
    ["jessica", "Recover missed inbound inquiries", "Check missed-call and form follow-up paths, respecting SMS consent and opt-outs.", "Audit callback tasks, booking links and message delivery."],
    ["targeting", "Develop referral partnerships", "Reach out personally to relevant property managers and real estate partners using verified business details.", "Create a referral follow-up queue with source attribution."]
  ];
  return ideas.map(([category,title,description,action],i) => ({
    id: "organic_fallback_" + (i+1),
    priority: i === 0 && gapToGoal > 0 ? "high" : "medium",
    category, title, description, expectedImpact: "Not yet measured",
    action, actionType: "manual", campaignData: null
  }));
}
