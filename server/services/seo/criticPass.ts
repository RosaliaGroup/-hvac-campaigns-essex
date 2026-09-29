/**
 * Autopublish critic pass (docs/seo-automation-addendum-autopublish.md §A3):
 * "A second-model critic pass ... must return zero unsupported claims. Any
 * unsupported claim -> post is not published."
 *
 * Independence, per the owner's decision, comes from PROMPT ISOLATION, not a
 * different vendor: same Anthropic provider, a separate call, a separate
 * system prompt that has never seen the drafting prompt — only the finished
 * post text and VERIFIED_FACTS. Model is configurable via SEO_CRITIC_MODEL,
 * defaulting to this codebase's existing "precise" tier (server/_core/anthropic.ts's
 * MODEL_FALLBACKS chain), the strongest available.
 *
 * Fails CLOSED: if the API key is missing, the call errors, or the response
 * can't be parsed as the expected JSON, the verdict is "does not pass" with
 * an explanatory pseudo-claim — a draft can never slip through because the
 * critic was unavailable.
 */
import { callAnthropicModelChain } from "../../_core/anthropic";
import { VERIFIED_FACTS, type VerifiedFacts } from "../../../shared/verifiedFacts";

const DEFAULT_CRITIC_MODEL = "claude-opus-4-8"; // this repo's "precise" tier (server/_core/anthropic.ts DEFAULT_MODELS.precise)
const CRITIC_FALLBACK_MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];

export type CriticVerdict = {
  passes: boolean;
  unsupportedClaims: string[];
  model: string;
};

function modelChain(): string[] {
  const override = process.env.SEO_CRITIC_MODEL?.trim();
  const primary = override || DEFAULT_CRITIC_MODEL;
  return [primary, ...CRITIC_FALLBACK_MODELS.filter((m) => m !== primary)];
}

function buildCriticSystemPrompt(facts: VerifiedFacts): string {
  return [
    "You are an adversarial fact-checker reviewing a piece of marketing copy for an HVAC contractor.",
    "You have NOT seen and must NOT assume anything about how this copy was written or what it was asked to do.",
    "Your ONLY job: list every factual claim in the text below that is NOT directly supported by the JSON of verified facts given to you.",
    "A factual claim is any number, dollar figure, date, program name, certification, credential, years-in-business figure, service offered, phone number, address, county/area served, or client/project reference.",
    "General marketing language with no checkable fact in it (tone, calls to action, generic benefit statements) is not a claim.",
    "",
    "VERIFIED FACTS (the ONLY source of truth — anything not derivable from this is unsupported):",
    JSON.stringify(facts, null, 2),
    "",
    'Respond with ONLY a JSON array of strings, one per unsupported claim, quoting the exact claim text from the post. Respond with "[]" (nothing else) if every claim is supported.',
  ].join("\n");
}

function parseCriticResponse(text: string): string[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/); // tolerate the model wrapping the array in prose/code fences
  if (!jsonMatch) return [`Critic response was not parseable as a JSON array: ${trimmed.slice(0, 200)}`];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [`Critic response was not a JSON array: ${trimmed.slice(0, 200)}`];
    return parsed.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
  } catch {
    return [`Critic response was not parseable as a JSON array: ${trimmed.slice(0, 200)}`];
  }
}

/**
 * Run the critic pass on a finished post's text (title + meta + body — the
 * complete thing, not the drafting prompt). Never throws; a hard failure of
 * any kind fails closed (passes: false).
 */
/** @slow expected to exceed the ~20s gateway timeout — never await from a tRPC .mutation(); start it with startJob (server/services/asyncLaneJob.ts). */
export async function runCriticPass(postText: string, facts: VerifiedFacts = VERIFIED_FACTS): Promise<CriticVerdict> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { passes: false, unsupportedClaims: ["Critic pass unavailable: ANTHROPIC_API_KEY is not set."], model: "none" };
  }

  const result = await callAnthropicModelChain({
    apiKey,
    models: modelChain(),
    system: buildCriticSystemPrompt(facts),
    messages: [{ role: "user", content: postText }],
    maxTokens: 2000,
  });

  if (!result.ok || result.text === undefined) {
    return { passes: false, unsupportedClaims: [`Critic pass call failed: ${result.error ?? "no response text"}`], model: "none" };
  }

  const unsupportedClaims = parseCriticResponse(result.text);
  return { passes: unsupportedClaims.length === 0, unsupportedClaims, model: result.model ?? "unknown" };
}
