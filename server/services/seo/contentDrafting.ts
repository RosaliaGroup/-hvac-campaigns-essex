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

function buildContentSystemPrompt(topic: SeoContentQueueRow, facts: VerifiedFacts, priorFindings: string[] = []): string {
  const findingsBlock = priorFindings.length
    ? ["", "A PREVIOUS DRAFT OF THIS TOPIC WAS BLOCKED FOR THE FOLLOWING FINDINGS. Your new draft MUST fix every one of them:", ...priorFindings.map((f) => `- ${f}`)]
    : [];
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
    // docs/positioning-warranty-spec.md §6 — verbatim positioning sentence, added to both the content lane (here) and the meta lane (ai/anthropicProvider.ts).
    "Lead with installation quality, system fit and the optional 10-year parts & labor coverage. Mention rebates only as a secondary benefit and only using figures from VERIFIED_FACTS. Never describe coverage as included or free.",
    ...findingsBlock,
    "",
    "Rules:",
    "- `title`: AT MOST 60 characters including spaces. The topic above is a SUBJECT, not the title — write a new, shorter page title; never paste the topic text as the title if it is longer than 60 characters.",
    "- `metaDescription`: AT MOST 155 characters including spaces (aim for 140-150).",
    "- 1,000-1,250 words total across all sections combined (the linter rejects anything under 900 or over 1,400, so don't aim at either edge).",
    "- The `title` field IS the page's one H1 — do not repeat it as a section.",
    "- At most 6 `h2` sections. No sub-headings beyond h2 (the format has no h3).",
    "- Include exactly one `cta_box` section linking to a B2B page (buttonUrl must start with https://mechanicalenterprise.com/commercial).",
    "- Include a specific NJ angle (a named county, program, or building type).",
    "- Include a \"what to send us / what to ask bidders\" checklist or paragraph somewhere in the body.",
    "- NEVER include: case studies, a specific count of completed projects, any named client/customer, any dollar figure not in VERIFIED FACTS incentives, rebate promises, certification claims, superlatives (\"#1\", \"best\", \"award-winning\", etc.), expired tax-credit references (25C, IRA credit), or competitor names.",
    "- Warranty/coverage claims: never imply the optional 10-year parts & labor coverage is included, free, or standard — it's a paid add-on. Never say \"lifetime\", \"unlimited\", or \"guaranteed for life\". Never use a year count other than 10 next to \"warranty\"/\"coverage\". Never present a manufacturer's warranty as Mechanical Enterprise's own coverage. Never name the coverage administrator or insurer. Never mention existing-system coverage without \"eligible\"/\"qualify\" in the same sentence.",
    "- Comfort Membership: the customer owns the system — never say \"lease\", \"rent\", \"subscription includes the equipment\", or \"$0 down for everything\".",
    "- Never offer a comfort/refund guarantee: no \"money-back\", \"refund if\", \"remove it and refund\", or \"satisfaction guarantee\" — none of that is offered.",
    "- Never say \"guaranteed uptime\" or \"never fail\". Never state an SLA response-hour figure unless it matches VERIFIED_FACTS.portfolioSla.responseHours exactly. Never say \"24/7 monitoring\" unless VERIFIED_FACTS.monitoring.is24x7 is true. Never say \"guaranteed detection\".",
    "- Never state an installed-price figure unless it matches a VERIFIED_FACTS.priceRanges entry for this exact page.",
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
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function draftContentPost(topic: SeoContentQueueRow, facts: VerifiedFacts, priorFindings: string[] = []): Promise<BlogPostData> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ContentDraftUnavailableError();

  const result = await callAnthropicModelChain({
    apiKey,
    models: modelChain(),
    system: buildContentSystemPrompt(topic, facts, priorFindings),
    messages: [{ role: "user", content: "Draft the post now." }],
    maxTokens: 16000, // thinking tokens count against this; 8000 could leave no room for the JSON
    retry: { timeoutMs: 180_000 }, // a 900-1400 word JSON post can exceed the 60s default
  });

  if (!result.ok || result.text === undefined) {
    throw new Error(`Content drafting call failed: ${result.error ?? "no response text"}`);
  }
  return parseContentDraftResponse(result.text);
}
