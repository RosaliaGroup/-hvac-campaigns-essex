/**
 * Server-side Anthropic caller for the Take-Off flow.
 *
 * SERVER-ONLY. The browser never imports this module and never sees the API
 * key — it calls the authenticated `takeoffs.analyzeBatch` tRPC mutation, which
 * runs here with `process.env.ANTHROPIC_API_KEY`. The key is never returned,
 * logged, or included in any response.
 *
 * Responsibilities:
 *  - Central model config (quick vs precise) with env overrides.
 *  - Model fallback for retired / unavailable models.
 *  - Retry classification: retry only transient failures (429, 5xx, network,
 *    timeout); never retry billing, auth, permission, malformed-request, or
 *    invalid-model errors.
 */

export type TakeoffMode = "quick" | "precise";

/**
 * Primary model per mode.
 *  - quick   → cost-efficient current Sonnet
 *  - precise → strongest current model
 * Update when Anthropic retires a model (MODEL_FALLBACKS is the runtime net).
 */
const DEFAULT_MODELS: Record<TakeoffMode, string> = {
  quick: "claude-sonnet-5",
  precise: "claude-opus-4-8",
};

/**
 * Ordered fallback chains, tried left-to-right after a primary model fails with
 * a "model unavailable" error (404 / not_found_error) — e.g. the model was
 * retired or this workspace lacks access to it.
 */
export const MODEL_FALLBACKS: Record<string, string[]> = {
  "claude-opus-4-8": ["claude-sonnet-5", "claude-haiku-4-5"],
  "claude-sonnet-5": ["claude-haiku-4-5"],
  "claude-haiku-4-5": [],
};

function envOverride(mode: TakeoffMode): string | undefined {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const raw = mode === "precise" ? env?.TAKEOFF_MODEL_PRECISE : env?.TAKEOFF_MODEL_QUICK;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

/** The configured primary model for a mode (env override wins). */
export function primaryModel(mode: TakeoffMode): string {
  return envOverride(mode) ?? DEFAULT_MODELS[mode];
}

/** Full ordered list of models to try for a mode: primary followed by its fallbacks. */
export function modelChain(mode: TakeoffMode): string[] {
  const primary = primaryModel(mode);
  const fallbacks = MODEL_FALLBACKS[primary] ?? MODEL_FALLBACKS[DEFAULT_MODELS[mode]] ?? [];
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Non-streaming ceiling: staying <= 16000 keeps requests under HTTP timeouts.
const MAX_OUTPUT_TOKENS = 16000;

export type ErrorClass = "retryable" | "model_unavailable" | "fatal";

/**
 * Classify an Anthropic HTTP error so the caller knows whether to retry (same
 * model), fall back (next model), or fail fast.
 *  - retryable        → 408/429/5xx/529 and their error types (transient)
 *  - model_unavailable → 404 / not_found_error (retired or no workspace access)
 *  - fatal            → 400 (incl. billing / credit balance), 401, 403, 413,
 *                       422, and anything else — do NOT retry
 */
export function classifyAnthropicError(status: number, errType: string, rawText: string): ErrorClass {
  if (status === 404 || errType === "not_found_error") return "model_unavailable";

  if (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529 ||
    errType === "rate_limit_error" ||
    errType === "overloaded_error" ||
    errType === "api_error" ||
    errType === "timeout_error"
  ) {
    return "retryable";
  }

  // 400 (invalid_request incl. "credit balance too low"), 401, 403, 413, 422,
  // and any unrecognized status: do not retry.
  return "fatal";
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AnthropicCallResult {
  ok: boolean;
  text?: string;   // assistant text (on success)
  model?: string;  // model that actually produced the response
  usage?: TokenUsage; // token counts from the Anthropic response (for cost logging)
  status?: number; // HTTP status of the failing response (0 for network/timeout)
  code?: string;   // anthropic error type, or "network_error"/"timeout"/"all_models_unavailable"
  error?: string;  // user-facing message (on failure) — never contains the key
  detail?: string; // truncated raw error, for SERVER logs only (never returned to the browser)
}

/**
 * Approximate USD pricing per 1M tokens, for structured cost logging only (not
 * billing). Keep in sync with Anthropic's published rates; unknown models fall
 * back to Opus-tier so estimates are never understated.
 */
const MODEL_PRICING: Record<string, { inPer1M: number; outPer1M: number }> = {
  "claude-opus-4-8": { inPer1M: 5, outPer1M: 25 },
  "claude-opus-4-7": { inPer1M: 5, outPer1M: 25 },
  "claude-opus-4-6": { inPer1M: 5, outPer1M: 25 },
  "claude-sonnet-5": { inPer1M: 3, outPer1M: 15 },
  "claude-sonnet-4-6": { inPer1M: 3, outPer1M: 15 },
  "claude-haiku-4-5": { inPer1M: 1, outPer1M: 5 },
};
const DEFAULT_PRICING = { inPer1M: 5, outPer1M: 25 };

/** Estimated USD cost of a call, from the model and its token usage. */
export function estimateCostUsd(model: string | undefined, usage: TokenUsage | undefined): number {
  if (!usage) return 0;
  const p = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
  const cost = (usage.inputTokens / 1e6) * p.inPer1M + (usage.outputTokens / 1e6) * p.outPer1M;
  return Number(cost.toFixed(6));
}

function friendlyMessage(status: number, errType: string, rawText: string): string {
  const raw = rawText.toLowerCase();
  if (raw.includes("credit balance") || errType === "billing_error")
    return "The AI service is out of credits. Please contact support to top up the account.";
  if (status === 429 || errType === "rate_limit_error")
    return "The AI service is busy right now. Please wait a moment and try again.";
  if (status === 401 || status === 403 || errType === "authentication_error" || errType === "permission_error")
    return "The AI service is misconfigured. Please contact support.";
  if (status === 413 || errType === "request_too_large")
    return "This batch is too large to analyze. Try fewer pages per batch.";
  if (status === 400 || errType === "invalid_request_error")
    return "The drawing could not be analyzed — the AI service rejected the request.";
  return "The AI service is temporarily unavailable. Please try again shortly.";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RetryConfig {
  maxAttemptsPerModel: number; // total attempts (initial + retries) per model on retryable errors
  baseDelayMs: number;         // exponential backoff base
  timeoutMs: number;           // per-attempt request timeout
}

const DEFAULT_RETRY: RetryConfig = {
  maxAttemptsPerModel: 3,
  baseDelayMs: 500,
  timeoutMs: 60_000,
};

type Attempt =
  | { kind: "ok"; text: string; usage?: TokenUsage }
  | { kind: ErrorClass; status: number; errType: string; detail: string };

async function attemptOnce(
  model: string,
  apiKey: string,
  system: string | undefined,
  messages: unknown[],
  maxTokens: number,
  timeoutMs: number,
): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal: controller.signal,
    });

    if (res.ok) {
      const data: any = await res.json();
      const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
      const text: string = blocks.find((b) => b?.type === "text")?.text ?? blocks[0]?.text ?? "";
      const usage: TokenUsage | undefined = data?.usage
        ? {
            inputTokens: Number(data.usage.input_tokens ?? 0),
            outputTokens: Number(data.usage.output_tokens ?? 0),
          }
        : undefined;
      return { kind: "ok", text, usage };
    }

    const rawText = await res.text();
    let errType = "";
    try { errType = JSON.parse(rawText)?.error?.type || ""; } catch { /* non-JSON error body */ }
    return {
      kind: classifyAnthropicError(res.status, errType, rawText),
      status: res.status,
      errType,
      detail: rawText.slice(0, 500),
    };
  } catch (e: any) {
    // AbortError (timeout) or a network failure — both transient/retryable.
    const isTimeout = e?.name === "AbortError";
    return {
      kind: "retryable",
      status: 0,
      errType: isTimeout ? "timeout" : "network_error",
      detail: String(e?.message || e).slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call the Anthropic Messages API for the given mode, walking the model chain.
 * Transient errors are retried (same model, exponential backoff); an unavailable
 * model falls back to the next in the chain; fatal errors return immediately.
 * Returns a structured result so callers surface a clear error instead of an
 * empty analysis. The API key stays server-side and is never echoed back.
 */
export async function callAnthropicWithFallback(opts: {
  apiKey: string;
  mode: TakeoffMode;
  system?: string;
  messages: unknown[];
  maxTokens?: number;
  retry?: Partial<RetryConfig>;
}): Promise<AnthropicCallResult> {
  const { apiKey, mode, system, messages } = opts;
  const maxTokens = Math.min(Math.max(1, opts.maxTokens ?? MAX_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS);
  const cfg: RetryConfig = { ...DEFAULT_RETRY, ...opts.retry };
  const chain = modelChain(mode);

  let last: { status: number; errType: string; detail: string } = {
    status: 502,
    errType: "unavailable",
    detail: "",
  };

  for (const model of chain) {
    for (let attempt = 1; attempt <= cfg.maxAttemptsPerModel; attempt++) {
      const outcome = await attemptOnce(model, apiKey, system, messages, maxTokens, cfg.timeoutMs);

      if (outcome.kind === "ok") {
        return { ok: true, text: outcome.text, model, usage: outcome.usage };
      }

      last = { status: outcome.status, errType: outcome.errType, detail: outcome.detail };

      if (outcome.kind === "fatal") {
        return {
          ok: false,
          status: outcome.status,
          code: outcome.errType || String(outcome.status),
          error: friendlyMessage(outcome.status, outcome.errType, outcome.detail),
          detail: outcome.detail,
        };
      }

      if (outcome.kind === "model_unavailable") {
        break; // stop retrying this model; try the next model in the chain
      }

      // retryable: back off and try the same model again, unless attempts are exhausted
      if (attempt < cfg.maxAttemptsPerModel) {
        await sleep(cfg.baseDelayMs * Math.pow(2, attempt - 1));
      } else {
        return {
          ok: false,
          status: outcome.status,
          code: outcome.errType || "unavailable",
          error: friendlyMessage(outcome.status, outcome.errType, outcome.detail),
          detail: outcome.detail,
        };
      }
    }
  }

  // Every model in the chain was unavailable.
  return {
    ok: false,
    status: last.status,
    code: "all_models_unavailable",
    error: "The AI models are currently unavailable. Please contact support.",
    detail: last.detail,
  };
}
