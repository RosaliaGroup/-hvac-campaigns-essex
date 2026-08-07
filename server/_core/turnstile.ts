/**
 * Cloudflare Turnstile server-side verification (Layer 3).
 *
 * Runs on the Railway backend. Reads the secret from `TURNSTILE_SECRET`
 * (Railway env). Callers should treat a failed verification like any other
 * spam signal: return a SUCCESS-shaped response and log — never surface an error.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Kill switch. Enforcement (fail-closed: reject a missing/invalid token) is ON
 * only when `TURNSTILE_ENFORCED === "true"`. Unset/anything-else = OFF, so the
 * path stays fail-open (verify-if-present) and a bad rollout can be disabled by
 * flipping this env var — no code deploy required. Enforcement additionally
 * requires `TURNSTILE_SECRET`; without a secret nothing can be verified, so we
 * never reject (see `verifyTurnstile` → `skipped`).
 */
export function isTurnstileEnforced(): boolean {
  return process.env.TURNSTILE_ENFORCED === "true";
}

export interface TurnstileResult {
  /** True when the token is valid OR verification was skipped (no secret). */
  success: boolean;
  /** True when verification was skipped because TURNSTILE_SECRET is unset. */
  skipped: boolean;
  errorCodes?: string[];
}

/**
 * Verify a `cf-turnstile-response` token. Returns `{ success:true, skipped:true }`
 * when `TURNSTILE_SECRET` is not configured, so a missing secret never blocks
 * real submissions (fail-open on config, fail-closed on a supplied-but-invalid
 * token). Never throws.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET not set — skipping verification");
    return { success: true, skipped: true };
  }
  if (!token) {
    return { success: false, skipped: false, errorCodes: ["missing-input-response"] };
  }
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const resp = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await resp.json()) as { success?: boolean; "error-codes"?: string[] };
    return {
      success: data.success === true,
      skipped: false,
      errorCodes: data["error-codes"],
    };
  } catch (e) {
    console.error("[turnstile] verification request failed:", e);
    return { success: false, skipped: false, errorCodes: ["verify-exception"] };
  }
}
