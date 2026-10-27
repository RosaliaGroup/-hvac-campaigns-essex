import { describe, expect, it } from "vitest";
import { gmailIsRateLimited, markGmailQuotaExceeded, gmailQuotaRemainingMs } from "./gmailQuotaCooldown";
describe("Gmail shared quota guard", () => {
  it("classifies quota errors, not permission errors", () => {
    expect(gmailIsRateLimited(403, "rateLimitExceeded")).toBe(true);
    expect(gmailIsRateLimited(403, "insufficientPermissions")).toBe(false);
    expect(gmailIsRateLimited(429)).toBe(true);
  });
  it("applies a bounded cooldown", () => {
    const now = Date.now();
    markGmailQuotaExceeded(30, now);
    expect(gmailQuotaRemainingMs(now)).toBeGreaterThanOrEqual(300000);
  });
});
