/**
 * Refresh drafting: rewrite an EXISTING blog post in place (same slug, same audience, same topic) when
 * market intel finds it decaying. Owner decision 2026-10-29: decaying posts are refreshed automatically,
 * including residential rebate posts, through the same content lane (lint + critic + hold + revert).
 *
 * What differs from a new B2B post (contentDrafting.ts):
 *  - The audience is whoever the post was written for (homeowners for the rebate guides). The B2B-only
 *    topic gate (isResidentialOrRebateTopic) does not apply to a refresh — the page already exists.
 *  - Rebates may be discussed, but ONLY with the figures in VERIFIED_FACTS.incentives. The linter still
 *    blocks every other dollar figure and the critic still blocks unsupported claims, so unverified
 *    program amounts in the old copy are dropped, not carried over.
 *  - Slug and original publication date are kept; `updatedDate` is stamped by the server.
 */
import { publicationDate } from "../../../shared/blogPublication";
import { callAnthropicModelChain } from "../../_core/anthropic";
import type { BlogPostData } from "../../../client/src/data/blogPosts";
import type { VerifiedFacts } from "../../../shared/verifiedFacts";
import { ContentDraftUnavailableError, parseContentDraftResponse } from "./contentDrafting";
import { EXPIRED_INCENTIVES, SUPERLATIVES, CERTIFICATION_WORDS, COMPETITOR_BRANDS } from "../../../shared/seoLinter";

const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|K|million|M))?\b/g;

/**
 * The model copies whatever figures it sees in the old post, even when told not to (first live refresh,
 * Oct 29: install-cost ranges like "$8,000 to $14,000" survived three attempts and blocked the draft).
 * So it never sees them: every dollar amount that isn't part of a VERIFIED_FACTS.incentives amount is
 * replaced before the old post goes into the prompt. Verified amounts ("Up to $16,000") are kept.
 */
export function stripUnverifiedAmounts<T>(value: T, facts: Pick<VerifiedFacts, "incentives">): T {
  const verified = facts.incentives.flatMap((i) => i.amountText.match(MONEY_RE) ?? []).map((m) => m.replace(/\s/g, ""));
  const scrub = (text: string) => text.replace(MONEY_RE, (m) => (verified.includes(m.replace(/\s/g, "")) ? m : "[amount removed]"));
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return scrub(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

const DEFAULT_MODEL = "claude-sonnet-5";
const FALLBACK_MODELS = ["claude-haiku-4-5"];

export type RefreshContext = {
  /** The post as it is live today. */
  current: BlogPostData;
  /** Why it was picked, e.g. "clicks down 96% vs the prior window (23 → 1)". */
  reason?: string | null;
  /** Upper word bound for this refresh (long evergreen guides keep their depth). */
  maxWords: number;
};

/** Residential posts point readers at residential next steps; everything else keeps the B2B CTA rule. */
export function isResidentialPost(post: Pick<BlogPostData, "title" | "category" | "excerpt" | "metaDescription">): boolean {
  const t = `${post.title} ${post.category} ${post.excerpt} ${post.metaDescription}`.toLowerCase();
  return /\b(homeowners?|residential|rebates?|home)\b/.test(t) && !/\b(commercial|property managers?|multifamily|building owners?)\b/.test(t);
}

export function buildRefreshSystemPrompt(ctx: RefreshContext, facts: VerifiedFacts, priorFindings: string[] = []): string {
  const { current } = ctx;
  const residential = isResidentialPost(current);
  const findingsBlock = priorFindings.length
    ? ["", "A PREVIOUS DRAFT OF THIS REFRESH WAS BLOCKED FOR THE FOLLOWING FINDINGS. Your new draft MUST fix every one of them:", ...priorFindings.map((f) => `- ${f}`)]
    : [];
  return [
    "You are refreshing an EXISTING blog post for Mechanical Enterprise LLC, a licensed HVAC contractor in New Jersey.",
    "The post is live and has lost search visibility. Rewrite it so it is accurate, current and more useful for the SAME reader and the SAME search intent. This is a refresh, not a new topic.",
    ...(ctx.reason ? [`Why it was picked: ${ctx.reason}`] : []),
    "",
    "CURRENT POST (JSON). Unverified dollar amounts have already been replaced with \"[amount removed]\" — do not restore, estimate or replace them with any other number:",
    JSON.stringify(stripUnverifiedAmounts(current, facts), null, 2),
    "",
    "VERIFIED FACTS — the ONLY source of truth for any number, program, service, county or credential:",
    JSON.stringify(facts, null, 2),
    ...findingsBlock,
    "",
    "Rules:",
    `- Keep "slug" exactly "${current.slug}". Keep the same subject, audience and search intent.`,
    "- `title`: AT MOST 60 characters. Keep it recognisably the same page (same core keywords); tighten it if the current title is longer.",
    "- `metaDescription`: AT MOST 155 characters (aim for 140-150).",
    `- Total body length 950-${ctx.maxWords} words across all sections. Keep the depth of the current post; cut padding and repetition, not substance.`,
    "- The `title` field IS the page's one H1 — do not repeat it as a section. At most 6 `h2` sections; no other headings.",
    "- Keep any accurate, still-useful content and structure from the current post. Update anything dated. Remove anything you cannot support with VERIFIED FACTS.",
    "- Dollar figures: use ONLY amounts that appear in VERIFIED_FACTS.incentives (e.g. \"Up to $16,000\" for the PSE&G / NJ Clean Energy residential rebate, \"Up to 80%\" for commercial Direct Install). Drop every other program-specific dollar amount, tier or stacking total from the old copy — describe those programs without numbers and tell the reader eligibility and amounts are confirmed during the assessment.",
    "- The ONLY \"$\" figures allowed anywhere in the post are the exact amount strings in VERIFIED_FACTS.incentives. No installed prices, cost ranges, savings estimates, utility-bill figures or example budgets — explain what drives cost in words instead.",
    "- Never mention the federal 25C credit, the IRA tax credit, HEAR/HOMES or HEEHRA rebates (expired or unverified).",
    `- These words and phrases are blocked by the checker in ANY sense, so never use them (rephrase instead): ${[...EXPIRED_INCENTIVES, ...SUPERLATIVES, ...CERTIFICATION_WORDS].map((w) => `"${w}"`).join(", ")}. For example write "you may be told" instead of "you'll hear".`,
    `- Never name these companies: ${COMPETITOR_BRANDS.join(", ")}.`,
    "- Rebates are never promised: say a household \"may qualify\" and that eligibility is confirmed at the assessment.",
    residential
      ? "- Include exactly one `cta_box` for a free in-home assessment; buttonUrl must be https://mechanicalenterprise.com/contact or https://mechanicalenterprise.com/rebate-calculator."
      : "- Include exactly one `cta_box` requesting a service visit or consultation; buttonUrl must start with https://mechanicalenterprise.com/commercial.",
    "- Include a specific NJ angle (a named county, utility or building type).",
    "- Warranty/coverage: the 10-year parts & labor coverage is an OPTIONAL PAID add-on — never included, free, standard, lifetime or unlimited. Existing systems only \"may qualify\" if eligible.",
    "- NEVER include: case studies, counts of completed projects, named clients, certification claims, superlatives (\"#1\", \"best\", \"award-winning\"), competitor names, guarantees or refunds.",
    "- Only include `faqSchema` with 3 or more genuinely distinct questions (keep good ones from the current post); otherwise omit it.",
    "",
    "Respond with ONLY a JSON object, no markdown fences, matching exactly:",
    '{ "title": string, "slug": string, "date": string, "readTime": string, "category": string, "metaDescription": string, "excerpt": string, "sections": [ { "type": "intro"|"h2"|"paragraph"|"stat_box"|"checklist"|"numbered_list"|"cta_box", "content"?: string, "items"?: string[], "buttonText"?: string, "buttonUrl"?: string } ], "faqSchema"?: [ { "question": string, "answer": string } ] }',
  ].join("\n");
}

/** Draft a refreshed version of `ctx.current`. Slug, category and original date are pinned; updatedDate = today. */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function draftRefreshPost(ctx: RefreshContext, facts: VerifiedFacts, priorFindings: string[] = []): Promise<BlogPostData> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ContentDraftUnavailableError();
  const primary = process.env.SEO_AI_MODEL?.trim() || DEFAULT_MODEL;
  const result = await callAnthropicModelChain({
    apiKey,
    models: [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)],
    system: buildRefreshSystemPrompt(ctx, facts, priorFindings),
    messages: [{ role: "user", content: "Write the refreshed post now." }],
    maxTokens: 16000,
    retry: { timeoutMs: 180_000 },
  });
  if (!result.ok || result.text === undefined) throw new Error(`Refresh drafting call failed: ${result.error ?? "no response text"}`);
  return pinRefreshIdentity(parseContentDraftResponse(result.text), ctx.current);
}

/** The refresh may change words, never identity: same slug, category and original date; updatedDate = today. */
export function pinRefreshIdentity(draft: BlogPostData, current: BlogPostData, today: string = publicationDate()): BlogPostData {
  return { ...draft, slug: current.slug, category: current.category, date: current.date, updatedDate: today };
}
