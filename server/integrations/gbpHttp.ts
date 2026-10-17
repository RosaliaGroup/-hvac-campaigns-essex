/** Shared READ-only GBP transport. Writes are deliberately never replayed here. */
const MIN_INTERVAL_MS = 250;
const MAX_ATTEMPTS = 4;
const MAX_RETRY_WAIT_MS = 30_000;

export class GbpHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(`Google Business Profile HTTP ${status}: ${reason}${retryAfterSeconds ? `; retry after ${retryAfterSeconds}s` : ""}`);
    this.name = "GbpHttpError";
  }
}

type Lane = { tail: Promise<void>; nextAt: number; blockedUntil: number; blockedError?: GbpHttpError };
// Google applies quotas separately to each API service. All GBP readers in this
// process share a lane per service, including discovery and dashboard refreshes.
const lanes = new Map<string, Lane>();
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function retryDelay(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

/** Bounded exponential retries with jitter, Retry-After, and shared cooldown. */
export async function getGbpJson<T = unknown>(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const host = new URL(url).hostname;
  let lane = lanes.get(host);
  if (!lane) {
    lane = { tail: Promise.resolve(), nextAt: 0, blockedUntil: 0 };
    lanes.set(host, lane);
  }
  const current = lane;
  const run = current.tail.then(async () => {
    if (current.blockedUntil > Date.now()) {
      throw new GbpHttpError(current.blockedError?.status ?? 429, current.blockedError?.reason ?? "rate_limited", Math.ceil((current.blockedUntil - Date.now()) / 1000));
    }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const wait = current.nextAt - Date.now();
      if (wait > 0) await sleep(wait);
      current.nextAt = Date.now() + MIN_INTERVAL_MS;
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) return await response.json() as T;
      const payload = await response.json().catch(() => null) as {
        error?: { status?: string; details?: Array<{ reason?: string }> };
      } | null;
      const reason = String(payload?.error?.details?.find(d => d.reason)?.reason ?? payload?.error?.status ?? "google_api_error").slice(0, 120);
      const rateLimited = response.status === 429;
      const retryable = rateLimited || [500, 502, 503, 504].includes(response.status);
      const retryAfter = retryDelay(response.headers.get("retry-after"));
      // Never shorten Google's Retry-After. Long waits are returned to the UI
      // instead of keeping an HTTP request or the sync lock open indefinitely.
      if (!retryable || attempt === MAX_ATTEMPTS - 1 || retryAfter > MAX_RETRY_WAIT_MS) {
        const cooldown = rateLimited ? Math.max(60_000, retryAfter) : retryAfter;
        const error = new GbpHttpError(response.status, reason, cooldown > 0 ? Math.ceil(cooldown / 1000) : undefined);
        if (cooldown > 0) {
          current.blockedUntil = Date.now() + cooldown;
          current.blockedError = error;
        }
        throw error;
      }
      await sleep(Math.max(retryAfter, 1000 * 2 ** attempt + Math.floor(Math.random() * 250)));
    }
    throw new Error("Unreachable GBP retry state");
  });
  // A failed call must not poison the queue for the next request.
  current.tail = run.then(() => {}, () => {});
  return run;
}
