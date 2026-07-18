/**
 * Authentication for the Vapi tool-calls webhook (`webhooks.vapiTools`).
 *
 * The tool dispatcher exposes active Mechanical tools (getCallerInfo,
 * sendReferralLink, bookHVAC, rescheduleHVAC) that read customer PII, write
 * CRM/calendar records, and send SMS. This guard makes the endpoint reject any
 * request that is not a genuine Vapi call BEFORE the tool call is parsed or
 * executed.
 *
 * Contract (reuses the same secret as the recap route, `VAPI_WEBHOOK_SECRET`):
 *   - secret NOT configured on the backend            → reject, fail-closed
 *   - `Authorization` header missing / malformed      → reject
 *   - header present but secret does not match         → reject (timing-safe)
 *   - `Authorization: Bearer <VAPI_WEBHOOK_SECRET>`    → allow
 *
 * The secret is never logged or returned. Comparison is constant-time.
 */
import crypto from "crypto";

export type VapiToolAuthResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "unauthorized" };

/** Constant-time string comparison that never short-circuits on content. */
function timingSafeEqualStr(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on length mismatch; compare lengths separately so a
  // wrong-length token still takes the constant-time path against `expected`.
  if (a.length !== b.length) {
    // Compare `expected` to itself to keep timing independent of `provided`.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Authenticate a Vapi tool-calls webhook request from its raw `Authorization`
 * header value. Pure and side-effect free (aside from the constant-time compare)
 * so it is fully unit-testable; the caller decides how to surface the rejection.
 */
export function authenticateVapiToolCall(
  authorizationHeader: string | string[] | undefined,
): VapiToolAuthResult {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: with no configured secret the endpoint refuses every request
    // rather than running tools unauthenticated.
    return { ok: false, reason: "not_configured" };
  }

  const raw = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  const header = (raw ?? "").trim();

  // Require exactly a Bearer token; reject missing header and any other scheme.
  const match = /^Bearer[ \t]+(\S.*)$/i.exec(header);
  if (!match) {
    return { ok: false, reason: "unauthorized" };
  }
  const provided = match[1].trim();
  if (!provided || !timingSafeEqualStr(provided, secret)) {
    return { ok: false, reason: "unauthorized" };
  }
  return { ok: true };
}
