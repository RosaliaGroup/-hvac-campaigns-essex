/**
 * Resilient HTTP for QuickBooks calls (pure, unit-tested).
 *
 * Wraps a fetch with:
 *   - a hard per-request timeout via AbortController (so a hung QBO call can
 *     NEVER block a sync indefinitely — this is what let a backfill hang);
 *   - bounded retries for TRANSIENT failures only (network error, timeout,
 *     429, 502/503/504) with exponential backoff — never for 4xx or a plain 500;
 *   - one structured log line per attempt (request id + duration + outcome),
 *     never logging the bearer token (it lives in the caller's headers).
 *
 * All I/O is injected (fetchImpl/sleep/now/log/makeRequestId) so behaviour is
 * deterministic under test. The caller is responsible for auth headers.
 */

export type QboFetchOutcome = "response" | "timeout" | "network_error";

export interface QboFetchLogEntry {
  requestId: string;
  method: string;
  label: string;
  attempt: number; // 1-based
  outcome: QboFetchOutcome;
  status: number | null;
  ms: number;
  error?: string;
}

export interface ResilientFetchOptions {
  /** Hard per-attempt timeout. Default 20s. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default 2 (=> up to 3 attempts). */
  maxRetries?: number;
  /** Backoff base; delay = base * 2^attemptIndex. Default 300ms. */
  baseBackoffMs?: number;
  /** Short human label for logs (e.g. the request path). */
  label?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (entry: QboFetchLogEntry) => void;
  makeRequestId?: () => string;
}

/** HTTP statuses worth retrying (transient). A bare 500 is NOT retried. */
export const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

const DEFAULTS = {
  timeoutMs: 20_000,
  maxRetries: 2,
  baseBackoffMs: 300,
};

let idCounter = 0;
function defaultRequestId(): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `qbo-${idCounter.toString(36)}`;
}

/**
 * Fetch with timeout + bounded transient-retry. Resolves with the final
 * Response for a 2xx, a non-retryable status (4xx/500), or a retryable status
 * whose retries were exhausted. THROWS (never hangs) on a timeout or network
 * error whose retries were exhausted — so a stuck call surfaces as a failure.
 */
export async function resilientFetch(
  url: string,
  init: RequestInit = {},
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULTS.baseBackoffMs;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const log = options.log ?? (() => {});
  const makeRequestId = options.makeRequestId ?? defaultRequestId;
  const method = (init.method ?? "GET").toUpperCase();
  const label = options.label ?? "qbo";
  const requestId = makeRequestId();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = now();
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      const ms = now() - t0;
      log({ requestId, method, label, attempt, outcome: "response", status: res.status, ms });
      if (RETRYABLE_STATUS.has(res.status) && attempt <= maxRetries) {
        await sleep(baseBackoffMs * 2 ** (attempt - 1));
        continue;
      }
      return res; // 2xx, non-retryable 4xx/500, or retryable-exhausted
    } catch (e) {
      const err = e as Error;
      const isTimeout = err.name === "AbortError";
      const ms = now() - t0;
      log({ requestId, method, label, attempt, outcome: isTimeout ? "timeout" : "network_error", status: null, ms, error: err.message });
      lastError = isTimeout
        ? new Error(`QBO request timed out after ${timeoutMs}ms (${method} ${label})`)
        : err;
      if (attempt <= maxRetries) {
        await sleep(baseBackoffMs * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  // Unreachable, but keeps the type-checker happy.
  throw lastError ?? new Error("resilientFetch: exhausted without a result");
}
