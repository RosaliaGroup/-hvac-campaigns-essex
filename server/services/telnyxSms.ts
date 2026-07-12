/**
 * Telnyx SMS — the ACTIVE SMS provider for Mechanical Enterprise.
 * Single send path shared by: campaign sends (single/bulk), scheduled drips,
 * appointment confirmations, and rebate-calculator texts.
 *
 * TextBelt is LEGACY as of July 2026 — do not add new TextBelt sends.
 * (Inbound webhook parsing keeps a TextBelt-format fallback for old
 * configured webhooks; see services/smsWebhook.ts.)
 */

/** Normalize to E.164 (+1XXXXXXXXXX). Returns null if not a usable US number. */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function telnyxConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY && process.env.TELNYX_FROM_NUMBER);
}

export async function sendTelnyxSms(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey || !fromNumber) {
    console.warn("[TelnyxSms] Not configured (TELNYX_API_KEY / TELNYX_FROM_NUMBER missing) — skipping send");
    return { success: false, error: "SMS not configured" };
  }
  const to = toE164(phone);
  if (!to) return { success: false, error: `Invalid phone number: ${phone}` };

  const payload = { from: fromNumber, to, text: message };
  const startedAt = Date.now();
  try {
    // Structured send log — one line per attempt, greppable as [TelnyxSms].
    // Deliberately excludes the API key and the message body (Task 11): only
    // the recipient, sender, and message length are recorded.
    console.log(JSON.stringify({
      tag: "[TelnyxSms] REQUEST",
      to,
      from: fromNumber,
      textLength: message.length,
    }));

    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawBody = await res.text().catch(() => "");
    const ms = Date.now() - startedAt;

    if (!res.ok) {
      console.error(JSON.stringify({
        tag: "[TelnyxSms] FAILED",
        to,
        httpStatus: res.status,
        ms,
        errorBody: rawBody.slice(0, 500),
      }));
      return { success: false, error: `Telnyx ${res.status}: ${rawBody.slice(0, 200)}` };
    }

    let data: { data?: { id?: string; to?: Array<{ status?: string }> } } | null = null;
    try { data = JSON.parse(rawBody); } catch { /* logged below */ }
    const messageId = data?.data?.id;

    console.log(JSON.stringify({
      tag: "[TelnyxSms] ACCEPTED",
      to,
      httpStatus: res.status,
      ms,
      telnyxMessageId: messageId ?? null,
      recipientStatus: data?.data?.to?.[0]?.status ?? null,
    }));

    if (!messageId) {
      // 2xx without an id is anomalous — accepted by SOMETHING, but not
      // verifiably by Telnyx's message API. Surface it loudly WITHOUT echoing
      // the response body (which contains the message text — Task 11).
      console.warn(`[TelnyxSms] WARNING: 2xx response but no message id (httpStatus=${res.status})`);
    }

    return { success: true, messageId };
  } catch (err) {
    console.error(JSON.stringify({
      tag: "[TelnyxSms] NETWORK_ERROR",
      to,
      ms: Date.now() - startedAt,
      error: String(err).slice(0, 300),
    }));
    return { success: false, error: String(err) };
  }
}
