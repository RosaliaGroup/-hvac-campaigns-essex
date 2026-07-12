/**
 * AI Content Generator
 * Generates HVAC-related social media content using LLM
 */

import { invokeLLM } from "../_core/llm";

export type ContentType = 
  | "hvac_tip"
  | "rebate_alert"
  | "seasonal_advice"
  | "before_after"
  | "customer_testimonial"
  | "faq"
  | "energy_savings"
  | "maintenance_reminder";

export interface GeneratedContent {
  content: string;
  hashtags: string[];
  callToAction: string;
  imagePrompt?: string;
  /**
   * True when the content could not be fully validated (e.g. the model
   * returned malformed JSON and we fell back to the raw payload). The caller
   * MUST have a human review before publishing.
   */
  unverified?: boolean;
  /** True specifically when JSON parsing failed. */
  parseError?: boolean;
}

/**
 * Hard factual guardrails. HVAC marketing for a real company must never invent
 * customer-specific or regulated claims — doing so is a compliance/legal risk.
 */
export const FACTUAL_RULES = `STRICT FACTUAL RULES — you MUST follow these:
- NEVER invent or imply a customer identity, name, direct quote, or testimonial.
- NEVER invent dollar savings, energy-savings percentages, equipment make/model, tonnage, rebate eligibility/amounts for a specific job, warranty terms, or a job outcome.
- Use ONLY facts explicitly provided under "Verified job facts". If a detail was not provided, do not state it as fact.
- When a template would normally include such a specific and it was NOT provided, write an editable placeholder in square brackets (e.g. "[add verified savings]") instead of a number, and never present a placeholder as a fact.
- General, non-job-specific educational statements about HVAC are fine.`;

/**
 * Parse the model's JSON response safely. On malformed JSON, preserve the raw
 * payload as the content and flag it unverified rather than throwing — the
 * workflow must not crash on a bad model response.
 */
export function parseGeneratedContent(raw: string): GeneratedContent {
  try {
    const g = JSON.parse(raw) as Partial<GeneratedContent>;
    return {
      content: typeof g.content === "string" ? g.content : String(g.content ?? ""),
      hashtags: Array.isArray(g.hashtags) ? g.hashtags.map(String) : [],
      callToAction: typeof g.callToAction === "string" ? g.callToAction : "",
      imagePrompt: g.imagePrompt ? String(g.imagePrompt) : undefined,
    };
  } catch {
    // Malformed JSON — keep the raw payload for debugging/human review.
    return {
      content: raw,
      hashtags: [],
      callToAction: "",
      imagePrompt: undefined,
      unverified: true,
      parseError: true,
    };
  }
}

export interface GenerateSocialPostOptions {
  /**
   * Verified, caller-supplied job/customer facts the model may use. Anything
   * outside this is off-limits (see FACTUAL_RULES). Required in practice for
   * testimonial / before-after content.
   */
  facts?: string;
  /** Injection seam for testing. Defaults to the real LLM. */
  invoke?: typeof invokeLLM;
}

/**
 * Build the system prompt (exported for testing the factual guardrails).
 */
export function buildSystemPrompt(platform: string): string {
  return `You are a social media content creator for Mechanical Enterprise, an HVAC company in New Jersey specializing in VRF/VRV systems, heat pumps, and energy-efficient upgrades.

Company details:
- WMBE/SBE Certified
- 4000+ residential installations
- 2.6M sq ft commercial space served
- Up to $16K rebates for residential
- Up to 80% rebates for commercial
- Phone: (862) 423-9396
- Serving 15 counties in NJ

Create engaging, professional content that:
- Educates homeowners/businesses about HVAC
- Highlights rebate opportunities
- Builds trust and expertise
- Includes clear call-to-action
- Uses appropriate tone for ${platform}

${FACTUAL_RULES}`;
}

/**
 * Generate social media post content using AI
 */
export async function generateSocialPost(
  contentType: ContentType,
  platform: "facebook" | "instagram" | "google_business" | "linkedin" | "nextdoor",
  opts: GenerateSocialPostOptions = {}
): Promise<GeneratedContent> {
  const invoke = opts.invoke ?? invokeLLM;
  const systemPrompt = buildSystemPrompt(platform);

  const contentPrompts: Record<ContentType, string> = {
    hvac_tip: "Create a helpful HVAC tip that saves energy or money. Keep it practical and actionable.",
    rebate_alert: "Highlight the rebate opportunities available in NJ using only the program facts you are sure of. Create urgency without being pushy. Do not state a specific rebate amount for any individual customer.",
    seasonal_advice: "Give seasonal HVAC advice relevant to the current time of year. Focus on preparation and maintenance.",
    before_after: "Describe an HVAC upgrade project using ONLY the verified job facts provided (problem, solution, result). Do not invent metrics — use [placeholders] for any number not provided.",
    customer_testimonial: "Write a testimonial-style post using ONLY the verified facts provided. Do NOT fabricate a customer, name, quote, or result. If no customer quote is provided, do not invent one — describe the project generically and invite real customers to leave a review.",
    faq: "Answer a common HVAC question that homeowners or business owners frequently ask.",
    energy_savings: "Explain how modern HVAC systems save energy and money in general terms. Do not attribute specific savings numbers to a customer unless provided as a verified fact.",
    maintenance_reminder: "Remind followers about important HVAC maintenance tasks. Explain why it matters and what happens if neglected.",
  };

  const factsBlock = opts.facts?.trim()
    ? `\n\nVerified job facts you may use (do not go beyond these):\n${opts.facts.trim()}`
    : `\n\nNo verified job facts were provided. Do NOT include any specific customer name, quote, savings number, equipment model, rebate amount, or outcome. Keep the post general/educational and use [placeholders] for any specific detail a human should fill in.`;

  const response = await invoke({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${contentPrompts[contentType]}${factsBlock}\n\nFormat your response as JSON with these fields:\n- content: The main post text (${getPlatformCharLimit(platform)} characters max)\n- hashtags: Array of 3-5 relevant hashtags\n- callToAction: A clear CTA (e.g., "Call now", "Get your free quote")\n- imagePrompt: A brief description of an image that would complement this post` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_post",
        strict: true,
        schema: {
          type: "object",
          properties: {
            content: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
            callToAction: { type: "string" },
            imagePrompt: { type: "string" },
          },
          required: ["content", "hashtags", "callToAction", "imagePrompt"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const contentString = typeof content === 'string' ? content : JSON.stringify(content);
  return parseGeneratedContent(contentString);
}

/**
 * Generate AI response to social media comment/message
 */
export async function generateSocialResponse(
  userMessage: string,
  platform: string,
  context?: string
): Promise<string> {
  const systemPrompt = `You are a customer service representative for Mechanical Enterprise HVAC company.

Respond to customer inquiries professionally and helpfully. 

Guidelines:
- Be friendly and professional
- Answer HVAC questions accurately
- Mention rebates when relevant ($16K residential, 80% commercial)
- Encourage them to call (862) 423-9396 for quotes
- Keep responses concise (2-3 sentences for ${platform})
- Never make promises about pricing without consultation
- If technical question is complex, suggest they call for expert advice`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Customer message: "${userMessage}"\n\n${context ? `Context: ${context}\n\n` : ""}Generate a helpful response.` },
    ],
  });

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content.trim() : '';
}

/**
 * Generate automated follow-up message
 */
export async function generateFollowUpMessage(
  leadName: string,
  leadContext: string,
  daysSinceContact: number
): Promise<string> {
  const systemPrompt = `You are following up with a potential HVAC customer for Mechanical Enterprise.

Create a personalized follow-up message that:
- References their previous inquiry
- Provides additional value
- Creates gentle urgency
- Includes clear next step
- Keeps it conversational and not pushy`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Lead: ${leadName}\nContext: ${leadContext}\nDays since contact: ${daysSinceContact}\n\nGenerate a follow-up message (SMS-friendly, under 160 characters).` },
    ],
  });

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content.trim() : '';
}

/**
 * Get platform-specific character limits
 */
function getPlatformCharLimit(platform: string): number {
  const limits: Record<string, number> = {
    facebook: 63206,
    instagram: 2200,
    google_business: 1500,
    linkedin: 3000,
    nextdoor: 2000,
    twitter: 280,
  };
  
  return limits[platform] || 1000;
}

/**
 * Schedule daily automated posts
 */
export async function generateDailyPostSchedule(): Promise<Array<{
  contentType: ContentType;
  platform: string;
  scheduledTime: string;
}>> {
  // Generate a week's worth of varied content
  const schedule = [
    { contentType: "hvac_tip" as ContentType, platform: "facebook", day: 1, hour: 9 },
    { contentType: "rebate_alert" as ContentType, platform: "instagram", day: 1, hour: 14 },
    { contentType: "seasonal_advice" as ContentType, platform: "google_business", day: 2, hour: 10 },
    { contentType: "energy_savings" as ContentType, platform: "facebook", day: 2, hour: 15 },
    { contentType: "faq" as ContentType, platform: "instagram", day: 3, hour: 11 },
    { contentType: "customer_testimonial" as ContentType, platform: "facebook", day: 3, hour: 16 },
    { contentType: "maintenance_reminder" as ContentType, platform: "google_business", day: 4, hour: 9 },
    { contentType: "before_after" as ContentType, platform: "instagram", day: 4, hour: 13 },
    { contentType: "rebate_alert" as ContentType, platform: "facebook", day: 5, hour: 10 },
    { contentType: "hvac_tip" as ContentType, platform: "google_business", day: 5, hour: 14 },
  ];

  const now = new Date();
  return schedule.map((item) => {
    const scheduledDate = new Date(now);
    scheduledDate.setDate(now.getDate() + item.day);
    scheduledDate.setHours(item.hour, 0, 0, 0);
    
    return {
      contentType: item.contentType,
      platform: item.platform,
      scheduledTime: scheduledDate.toISOString(),
    };
  });
}
