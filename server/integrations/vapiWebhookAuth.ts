/**
 * ⚠️ TEMPORARY COMPATIBILITY GUARD for the raw Vapi call-events webhook
 * (`webhooks.vapi`, handler `handleVapiWebhook`). The permanent, fail-closed
 * pattern lives in `vapiToolAuth.ts` (`authenticateVapiToolCall`), which the
 * tool-calls webhook already uses. This module exists ONLY to roll auth onto the
 * call-events webhook without dropping live call logging during the transition.
 *
 * WHY THIS IS NEEDED: the live Vapi dashboard currently POSTs call events to this
 * endpoint with NO `Authorization` header. Flipping straight to fail-closed would
 * reject every real call event until the dashboard is reconfigured. So this guard
 * defaults to a compatibility mode and only fails closed once enforcement is on.
 *
 * ENFORCEMENT is controlled by the env flag `VAPI_WEBHOOK_AUTH_ENFORCED`:
 *
 *   Compatibility mode (flag NOT truthy — the default during dashboard transition):
 *     - valid `Authorization: Bearer <VAPI_WEBHOOK_SECRET>`  → allow
 *     - header ABSENT                                         → allow (logged; temporary)
 *     - backend secret NOT configured                        → allow (logged; cannot validate)
 *     - header PRESENT but wrong scheme / wrong secret        → REJECT (bad creds never trusted)
 *
 *   Enforced mode (`VAPI_WEBHOOK_AUTH_ENFORCED` truthy):
 *     - valid Bearer → allow; everything else (missing / malformed / wrong /
 *       not configured) → REJECT (fail-closed, identical posture to vapiTools).
 *
 * ROLLOUT: once the Vapi dashboard is confirmed to send
 * `Authorization: Bearer <VAPI_WEBHOOK_SECRET>` on the CALL-EVENTS webhook and
 * `VAPI_WEBHOOK_AUTH_ENFORCED=true` is set in production, this whole module and
 * its compatibility branch should be DELETED and `webhooks.vapi` switched to
 * reuse `authenticateVapiToolCall` directly (same as `webhooks.vapiTools`).
 *
 * The secret is never logged or returned. Comparison is constant-time.
 */
import crypto from "crypto";

export type VapiWebhookAuthStatus =
  | "ok"
  | "missing_header"
  | "malformed"
  | "bad_credential"
  | "not_configured";

export type VapiWebhookAuthDecision = {
  outcome: "allow" | "reject";
  status: VapiWebhookAuthStatus;
  enforced: boolean;
  /** true only when a non-ok status was allowed BECAUSE enforcement is off */
  compatibilityAccepted: boolean;
};

/** Constant-time string comparison that never short-circuits on content. */
function timingSafeEqualStr(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Compare `expected` to itself to keep timing independent of `provided`.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/** True when production enforcement of the webhook Bearer secret is switched on. */
export function isVapiWebhookAuthEnforced(): boolean {
  const v = (process.env.VAPI_WEBHOOK_AUTH_ENFORCED ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/**
 * Classify the `Authorization` header against `VAPI_WEBHOOK_SECRET`.
 * Pure and side-effect-free (aside from the constant-time compare).
 */
export function classifyVapiWebhookAuth(
  authorizationHeader: string | string[] | undefined,
): VapiWebhookAuthStatus {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return "not_configured";

  const raw = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  const header = (raw ?? "").trim();
  if (header === "") return "missing_header";

  const match = /^Bearer[ \t]+(\S.*)$/i.exec(header);
  if (!match) return "malformed";

  const provided = match[1].trim();
  if (!provided || !timingSafeEqualStr(provided, secret)) return "bad_credential";
  return "ok";
}

/**
 * Decide whether to allow or reject a Vapi call-events webhook request.
 * `enforced` defaults to the live env flag but is injectable for tests.
 */
export function evaluateVapiWebhookAuth(
  authorizationHeader: string | string[] | undefined,
  enforced: boolean = isVapiWebhookAuthEnforced(),
): VapiWebhookAuthDecision {
  const status = classifyVapiWebhookAuth(authorizationHeader);

  if (status === "ok") {
    return { outcome: "allow", status, enforced, compatibilityAccepted: false };
  }
  if (enforced) {
    // Fail-closed: any non-ok status is rejected.
    return { outcome: "reject", status, enforced, compatibilityAccepted: false };
  }
  // Compatibility mode: temporarily accept ONLY an absent header or an
  // unconfigured backend secret. An explicitly-supplied bad/malformed
  // credential is always rejected (never treat bad creds as valid).
  if (status === "missing_header" || status === "not_configured") {
    return { outcome: "allow", status, enforced, compatibilityAccepted: true };
  }
  return { outcome: "reject", status, enforced, compatibilityAccepted: false };
}

/**
 * Structured security logging for the guard. Never logs the secret or the raw
 * Authorization header. No-op on a clean `ok` decision.
 */
export function logVapiWebhookAuth(d: VapiWebhookAuthDecision): void {
  if (d.status === "ok") return;
  const base = `[VapiWebhookAuth] status=${d.status} enforced=${d.enforced}`;
  if (d.outcome === "reject") {
    console.warn(`${base} outcome=reject`);
  } else {
    console.warn(
      `${base} outcome=allow(compatibility) — TEMPORARILY ACCEPTED; set VAPI_WEBHOOK_AUTH_ENFORCED=true once the Vapi dashboard sends the Bearer header`,
    );
  }
}
