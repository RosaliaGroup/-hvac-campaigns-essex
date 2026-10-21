import { gmailQuotaRemainingMs, gmailIsRateLimited, markGmailQuotaExceeded, GmailQuotaCooldownError } from "./gmailQuotaCooldown";

// All CRM readers share one paced lane; they must not race each other during recovery.
let lane: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
const REQUEST_GAP_MS = 250;

export function gmailRetryAfterSeconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? Math.ceil((date - now) / 1000) : undefined;
}

/** Read-only Gmail requests. A quota response stops ALL scanners until Google's wait expires. */
export function pacedGmailRead(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const run = lane.then(async () => {
    const checkCooldown = () => {
      const remaining = gmailQuotaRemainingMs();
      if (remaining > 0) throw new GmailQuotaCooldownError(remaining);
    };
    checkCooldown();
    const delay = Math.max(0, lastRequestAt + REQUEST_GAP_MS - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    checkCooldown();
    lastRequestAt = Date.now();
    const response = await fetchImpl(url, init);
    if (response.status === 403 || response.status === 429) {
      const payload = await response.clone().json().catch(() => null);
      if (gmailIsRateLimited(response.status, JSON.stringify(payload?.error ?? {}))) {
        markGmailQuotaExceeded(gmailRetryAfterSeconds(response.headers.get("retry-after")));
        throw new GmailQuotaCooldownError(gmailQuotaRemainingMs());
      }
    }
    return response;
  });
  lane = run.catch(() => undefined);
  return run;
}
