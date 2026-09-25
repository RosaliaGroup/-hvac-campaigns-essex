/**
 * Real AI drafting provider (SEO_AI_PROVIDER=anthropic, ANTHROPIC_API_KEY set
 * — see optimizationProvider.ts's getAiOptimizationProvider()). Scope is
 * deliberately narrow: title + meta description only, matching the
 * bulk-approve PR flow's own scope (docs/seo-bulk-approve-spec.md §1 — H1,
 * body, schema, internal links are per-page-review-only, never bulk-shipped).
 * generateH1/Faq/InternalLinks/Schema/expandContent delegate to
 * MockAiOptimizationProvider unchanged.
 *
 * Safety: every generated title/meta is run through shared/seoLinter.ts's
 * lintPageMeta() before being returned. A BLOCK finding triggers one retry
 * with the specific failure fed back into the prompt; if the retry still
 * fails, this throws AiDraftLintFailedError rather than silently saving
 * non-compliant AI copy — optimizations.ts never persists anything until
 * after these calls resolve, so a throw here means nothing is written.
 */
import { PHONE_DISPLAY } from "@shared/business";
import { lintPageMeta, type LintFinding } from "@shared/seoLinter";
import { callAnthropicModelChain } from "../../../_core/anthropic";
import { MockAiOptimizationProvider, type AiOptimizationProvider, type PageContext } from "./optimizationProvider";
import type { AiFaqItem, AiInternalLink } from "@shared/seo";

const DEFAULT_MODEL = "claude-sonnet-5";
const FALLBACK_MODELS = ["claude-haiku-4-5"];
const MAX_ATTEMPTS = 2; // 1 generation + 1 retry-with-feedback

function modelChain(): string[] {
  const override = process.env.SEO_AI_MODEL?.trim();
  const primary = override || DEFAULT_MODEL;
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

export class AiDraftLintFailedError extends Error {
  constructor(public readonly findings: LintFinding[]) {
    super(`AI-drafted content still failed the claims linter after a retry: ${findings.map((f) => f.code).join(", ")}.`);
    this.name = "AiDraftLintFailedError";
  }
}

/** The linter's rules, spelled out for the model — kept in prose, not just enforced after the fact. */
const LINTER_RULES_PROMPT = `
Hard rules. An automated linter checks every one of these; breaking any of them gets the draft rejected:
- Never use superlatives or unsupported claims: "#1", "number one", "best", "top-rated", "award-winning", "guaranteed", "lowest price", "cheapest".
- Never mention "federal tax credit", "tax credit", "25C", "IRA credit", "$2,000 credit", "$2K", "HEAR", or "HOMES rebate" — these incentive programs are expired or unverified.
- Never state a dollar figure above $16,000. Only mention "$16,000"/"$16K" if the page's city/utility territory (given below) is confirmed PSE&G.
- Never use certification wording ("certified", "MWBE", "WMBE", "SBE", "SEDB", "DBE") — none are pre-approved right now.
- The ONLY phone number you may ever use is the canonical one given below. Never invent or alter a phone number.
- Never mention a competitor by name: A.J. Perri, Gold Medal, Horizon, Hutchinson.
- Never use "limited time", "expires", or "ends" without a specific real future date.
- Title: at most 60 characters, never empty. Meta description: at most 155 characters, never empty.
- Never reuse a title or meta description already used on another page.
- If you mention a year, use the current year.
`.trim();

function buildSystemPrompt(field: "title" | "metaDescription"): string {
  const what = field === "title" ? "a page <title>" : 'a page <meta name="description"> value';
  return [
    `You are an SEO copywriter for Mechanical Enterprise, a licensed HVAC contractor in New Jersey.`,
    `Write ONLY ${what} — nothing else.`,
    `Canonical phone number (the only one you may ever use): ${PHONE_DISPLAY}.`,
    LINTER_RULES_PROMPT,
    `Respond with ONLY the ${field === "title" ? "title" : "meta description"} text itself. No quotes, no markdown, no labels, no explanation — just the text.`,
  ].join("\n\n");
}

function buildUserPrompt(field: "title" | "metaDescription", ctx: PageContext, retryFeedback?: string): string {
  const lines = [
    `Page path: ${ctx.page}`,
    `Page type: ${ctx.category}`,
    `Current title: ${ctx.title || "(none)"}`,
    `Current meta description: ${ctx.metaDescription || "(none)"}`,
    `Current H1: ${ctx.h1 || "(none)"}`,
    `City/utility territory: ${ctx.cityUtilityTerritory} (only mention "$16K" PSE&G rebates if this is "pseg")`,
    `Top Search Console queries landing on this page: ${ctx.topQueries.length ? ctx.topQueries.join(", ") : "(none synced yet)"}`,
    `First ~800 words of the page's live body content, for grounding:\n${ctx.bodyExcerpt || "(unavailable — write from the fields above only)"}`,
    ``,
    `Write a new ${field === "title" ? "title" : "meta description"} for this page.`,
  ];
  if (retryFeedback) {
    lines.push(``, `Your previous attempt was REJECTED by the compliance linter for: ${retryFeedback}. Fix exactly these issues and try again.`);
  }
  return lines.join("\n");
}

/** Strip a wrapping quote pair the model sometimes adds despite being told not to. */
function cleanFieldResponse(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1).trim();
  return trimmed;
}

/** The BLOCK findings relevant to one field — "both"-scoped findings apply to every field. */
function relevantBlocks(findings: LintFinding[], field: "title" | "metaDescription"): LintFinding[] {
  return findings.filter((f) => f.severity === "block" && (f.field === field || f.field === "both"));
}

async function draftField(field: "title" | "metaDescription", ctx: PageContext, apiKey: string): Promise<string> {
  let feedback: string | undefined;
  let lastValue = "";
  let lastBlocks: LintFinding[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await callAnthropicModelChain({
      apiKey,
      models: modelChain(),
      system: buildSystemPrompt(field),
      messages: [{ role: "user", content: buildUserPrompt(field, ctx, feedback) }],
      maxTokens: 300,
    });
    if (!result.ok || result.text === undefined) {
      throw new Error(result.error ?? `Anthropic ${field} generation failed`);
    }

    lastValue = cleanFieldResponse(result.text);
    const probe =
      field === "title"
        ? lintPageMeta({ pagePath: ctx.page, title: lastValue, metaDescription: ctx.metaDescription })
        : lintPageMeta({ pagePath: ctx.page, title: ctx.title, metaDescription: lastValue });
    lastBlocks = relevantBlocks(probe.findings, field);
    if (lastBlocks.length === 0) return lastValue;

    feedback = lastBlocks.map((f) => f.message).join("; ");
  }

  throw new AiDraftLintFailedError(lastBlocks);
}

export class AnthropicOptimizationProvider implements AiOptimizationProvider {
  readonly model: string;
  private readonly apiKey: string;
  private readonly fallback = new MockAiOptimizationProvider();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = `anthropic-${modelChain()[0]}`;
  }

  async generateTitle(ctx: PageContext): Promise<string> {
    return draftField("title", ctx, this.apiKey);
  }

  async generateMetaDescription(ctx: PageContext): Promise<string> {
    return draftField("metaDescription", ctx, this.apiKey);
  }

  // Out of scope for the real provider (spec: title + meta only) — delegate
  // to the same deterministic mock content the rest of the system already
  // treats as per-page-review-only, never bulk-published.
  generateH1(ctx: PageContext): Promise<string> {
    return this.fallback.generateH1(ctx);
  }
  generateFaq(ctx: PageContext): Promise<AiFaqItem[]> {
    return this.fallback.generateFaq(ctx);
  }
  generateInternalLinks(ctx: PageContext): Promise<AiInternalLink[]> {
    return this.fallback.generateInternalLinks(ctx);
  }
  generateSchema(ctx: PageContext): Promise<Record<string, unknown>> {
    return this.fallback.generateSchema(ctx);
  }
  expandContent(ctx: PageContext): Promise<string> {
    return this.fallback.expandContent(ctx);
  }
}
