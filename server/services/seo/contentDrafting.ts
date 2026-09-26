/**
 * Weekly B2B content drafting (docs/seo-automation-spec.md Part 2 "Drafting
 * rules"). One Anthropic call producing a complete BlogPostData object —
 * same provider/fallback convention as server/services/seo/ai/anthropicProvider.ts,
 * but this is a separate call for a separate artifact (a full post, not a
 * title/meta pair), so it lives in its own module rather than extending that
 * provider's narrow title/meta scope.
 */
import { callAnthropicModelChain } from "../../_core/anthropic";
import type { BlogPostData } from "../../../client/src/data/blogPosts";
import type { VerifiedFacts } from "../../../shared/verifiedFacts";
import type { SeoContentQueueRow } from "../../../drizzle/schema";

const DEFAULT_MODEL = "claude-sonnet-5"; // matches this repo's existing drafting tier (anthropicProvider.ts)
const FALLBACK_MODELS = ["claude-haiku-4-5"];

function modelChain(): string[] {
  const override = process.env.SEO_AI_MODEL?.trim();
  const primary = override || DEFAULT_MODEL;
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

export class ContentDraftUnavailableError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set — content drafting is unavailable.");
    this.name = "ContentDraftUnavailableError";
  }
}
export class ContentDraftParseError extends Error {
  constructor(raw: string) {
    super(`Content draft response was not parseable as the expected JSON shape: ${raw.slice(0, 300)}`);
    this.name = "ContentDraftParseError";
  }
}

function buildContentSystemPrompt(topic: SeoContentQueueRow, facts: VerifiedFacts): string {
  return [
    "You are an SEO content writer for Mechanical Enterprise LLC, a licensed HVAC contractor in New Jersey.",
    "Write B2B content for property managers, general contractors, or commercial/multifamily building owners — NEVER for homeowners, and NEVER about residential rebates.",
    "",
    `Topic: ${topic.title}`,
    `Audience: ${topic.audience ?? "commercial/multifamily property decision-makers"}`,
    `Brief: ${topic.brief ?? ""}`,
    "",
    "VERIFIED FACTS — the ONLY source of truth for any number, program, service, county, or credential. Never state anything beyond what's here:",
    JSON.stringify(facts, null, 2),
    "",
    "Rules:",
    "- 900-1400 words total across all sections combined.",
    "- The `title` field IS the page's one H1 — do not repeat it as a section.",
    "- At most 6 `h2` sections. No sub-headings beyond h2 (the format has no h3).",
    "- Include exactly one `cta_box` section linking to a B2B page (buttonUrl must start with https://mechanicalenterprise.com/commercial).",
    "- Include a specific NJ angle (a named county, program, or building type).",
    "- Include a \"what to send us / what to ask bidders\" checklist or paragraph somewhere in the body.",
    "- NEVER include: case studies, a specific count of completed projects, any named client/customer, any dollar figure not in VERIFIED FACTS incentives, rebate promises, certification claims, superlatives (\"#1\", \"best\", \"award-winning\", etc.), expired tax-credit references (25C, IRA credit), or competitor names.",
    "- Only include a `faqSchema` array if you have 3 or more genuinely distinct, real questions for this exact topic — otherwise omit it.",
    "",
    'Respond with ONLY a JSON object, no markdown fences, no prose outside it, matching exactly:',
    '{ "title": string, "slug": string (kebab-case), "date": string (e.g. "September 26, 2026"), "readTime": string (e.g. "8 min read"), "category": string, "metaDescription": string (<=155 chars), "excerpt": string, "sections": [ { "type": "intro"|"h2"|"paragraph"|"stat_box"|"checklist"|"numbered_list"|"cta_box", "content"?: string, "items"?: string[], "buttonText"?: string, "buttonUrl"?: string } ], "faqSchema"?: [ { "question": string, "answer": string } ] }',
  ].join("\n");
}

function parseContentDraftResponse(text: string): BlogPostData {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new ContentDraftParseError(trimmed);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new ContentDraftParseError(trimmed);
  }
  const p = parsed as Partial<BlogPostData>;
  if (typeof p.title !== "string" || typeof p.slug !== "string" || !Array.isArray(p.sections)) {
    throw new ContentDraftParseError(trimmed);
  }
  return parsed as BlogPostData;
}

/** Draft a complete post for `topic`. Throws ContentDraftUnavailableError/ContentDraftParseError rather than returning a partial/invalid post. */
export async function draftContentPost(topic: SeoContentQueueRow, facts: VerifiedFacts): Promise<BlogPostData> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ContentDraftUnavailableError();

  const result = await callAnthropicModelChain({
    apiKey,
    models: modelChain(),
    system: buildContentSystemPrompt(topic, facts),
    messages: [{ role: "user", content: "Draft the post now." }],
    maxTokens: 8000,
  });

  if (!result.ok || result.text === undefined) {
    throw new Error(`Content drafting call failed: ${result.error ?? "no response text"}`);
  }
  return parseContentDraftResponse(result.text);
}
