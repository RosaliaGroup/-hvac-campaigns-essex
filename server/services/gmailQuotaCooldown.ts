/** In-process shared Gmail quota cooldown for CRM scanners. No credentials or content stored. */
let blockedUntil = 0;
export function gmailQuotaRemainingMs(now = Date.now()): number {
  return Math.max(0, blockedUntil - now);
}
export function markGmailQuotaExceeded(retryAfterSeconds?: number, now = Date.now()): void {
  const seconds = Number.isFinite(retryAfterSeconds) && (retryAfterSeconds ?? 0) > 0
    ? Math.min(3600, Math.max(300, retryAfterSeconds!))
    : 900;
  blockedUntil = Math.max(blockedUntil, now + seconds * 1000);
}
export function gmailIsRateLimited(status: number, reason = ""): boolean {
  return status === 429 || (status === 403 && /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|RATE_LIMIT_EXCEEDED/i.test(reason));
}
export class GmailQuotaCooldownError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Gmail API rate limited; retry after shared cooldown");
    this.name = "GmailQuotaCooldownError";
  }
}
