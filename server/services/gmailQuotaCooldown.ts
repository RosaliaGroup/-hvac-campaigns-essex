/** In-process shared Gmail quota cooldown for CRM scanners. No credentials or content stored. */
let blockedUntil = 0;
let lastQuotaError = 0;
let consecutiveQuotaErrors = 0;
export function gmailQuotaRemainingMs(now = Date.now()): number {
  return Math.max(0, blockedUntil - now);
}
export function markGmailQuotaExceeded(retryAfterSeconds?: number, now = Date.now()): void {
  consecutiveQuotaErrors = now - lastQuotaError < 4 * 60 * 60 * 1000 ? consecutiveQuotaErrors + 1 : 1;
  lastQuotaError = now;
  const backoff = Math.min(3600, 900 * 2 ** Math.min(2, consecutiveQuotaErrors - 1));
  // Never shorten a provider-specified wait, including waits longer than an hour.
  const seconds = Number.isFinite(retryAfterSeconds) && (retryAfterSeconds ?? 0) > 0
    ? Math.max(backoff, retryAfterSeconds!) : backoff;
  blockedUntil = Math.max(blockedUntil, now + seconds * 1000);
}
export function gmailIsRateLimited(status: number, reason = ""): boolean {
  return status === 429 || (status === 403 && /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded|RATE_LIMIT_EXCEEDED/i.test(reason));
}
export class GmailQuotaCooldownError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Gmail API rate limited; retry after shared cooldown");
    this.name = "GmailQuotaCooldownError";
  }
}
