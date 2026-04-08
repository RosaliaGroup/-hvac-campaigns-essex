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
- Google Ads (Search + Performance Max) — currently running
- Facebook/Instagram Ads
- Jessica (AI phone assistant) — handles inbound calls
- SMS follow-up sequences
- Google Business Profile posts
- Organic SEO

Generate exactly 5 specific, actionable recommendations to close the gap to 20 appointments/week. For each recommendation that involves creating a new Google Ads campaign, include full campaign data.

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

Focus on what will generate the most appointments fastest given the current gap.`;

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
    return parsed.recommendations || getFallbackRecommendations(context.gapToGoal);
  } catch (err) {
    console.error("[CampaignEngine] AI recommendation error:", err);
    return getFallbackRecommendations(context.gapToGoal);
  }
}

function getFallbackRecommendations(gapToGoal: number): AIRecommendation[] {
  return [
    {
      id: "rec_fallback_1",
      priority: gapToGoal > 15 ? "critical" : "high",
      category: "budget",
      title: "Increase Google Ads daily budget by 30%",
      description: "Current campaigns are limited by budget. Increasing spend on the Heat Pump Rebates campaign will immediately generate more clicks and calls to Jessica.",
      expectedImpact: "+4 to +6 appointments/week",
      action: "Go to Google Ads → Heat Pump Rebates campaign → Budget → increase by 30%",
      actionType: "adjust_budget",
      campaignData: undefined,
    },
    {
      id: "rec_fallback_2",
      priority: "high",
      category: "new_campaign",
      title: "Launch Emergency HVAC Search Campaign",
      description: "Emergency HVAC searches have high intent and convert at 3x the rate of general searches. A dedicated emergency campaign captures callers who need service today.",
      expectedImpact: "+3 to +5 appointments/week",
      action: "Push the Emergency HVAC campaign to Google Ads with $30/day budget",
      actionType: "push_to_google_ads",
      campaignData: {
        name: "Emergency HVAC — Essex County",
        type: "search",
        budget: 30,
        targetLocations: ["Essex County NJ", "Newark NJ", "Montclair NJ", "Bloomfield NJ"],
        keywords: ["emergency hvac repair", "no heat emergency", "ac not working", "hvac emergency service newark", "24 hour hvac repair nj"],
        headlines: ["24/7 Emergency HVAC Service", "No Heat? Call Now", "Same-Day HVAC Repair New Jersey", "Emergency AC Repair Essex County", "HVAC Emergency — We Come to You"],
        descriptions: ["24/7 emergency HVAC service across New Jersey. $100 dispatch fee applied to repair. Call now.", "No heat or AC? Our technicians are on call 24/7 across Essex County and 14 other New Jersey counties."],
        finalUrl: "https://mechanicalenterprise.com/lp/emergency",
        callToAction: "Call Now",
      },
    },
    {
      id: "rec_fallback_3",
      priority: "high",
      category: "jessica",
      title: "Add missed-call SMS follow-up for Jessica",
      description: "When callers hang up before Jessica answers, an immediate SMS follow-up recovers 20-30% of those leads. Set up an automated text that fires within 60 seconds of a missed call.",
      expectedImpact: "+2 to +4 appointments/week",
      action: "Configure Vapi missed-call webhook to trigger Twilio SMS: 'Hi, this is Jessica from Mechanical Enterprise! Sorry I missed you. Reply YES to schedule your free consultation or call (862) 423-9396.'",
      actionType: "manual",
      campaignData: undefined,
    },
    {
      id: "rec_fallback_4",
      priority: "medium",
      category: "targeting",
      title: "Add Montclair, Bloomfield, and Livingston to geo-targeting",
      description: "These affluent Essex County towns have high heat pump conversion rates due to older homes and high energy costs. Adding them to targeting expands the addressable market by ~40,000 households.",
      expectedImpact: "+2 to +3 appointments/week",
      action: "In Google Ads, add Montclair NJ, Bloomfield NJ, and Livingston NJ to location targeting on all residential campaigns",
      actionType: "manual",
      campaignData: undefined,
    },
    {
      id: "rec_fallback_5",
      priority: "medium",
      category: "creative",
      title: "Add rebate dollar amounts to all ad headlines",
      description: "Ads that mention specific dollar amounts ($16,000 rebate) get 35-50% higher CTR than generic ads. Update all residential campaign headlines to include the rebate amount.",
      expectedImpact: "+15-25% CTR improvement → +2 appointments/week",
      action: "Update all residential campaign headlines to include: 'Up to $16,000 in Rebates' and 'Zero Upfront Cost'",
      actionType: "manual",
      campaignData: undefined,
    },
  ];
}
