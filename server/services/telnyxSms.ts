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

  try {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromNumber, to, text: message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[TelnyxSms] Send failed (${res.status}):`, body.slice(0, 300));
      return { success: false, error: `Telnyx ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
    return { success: true, messageId: data?.data?.id };
  } catch (err) {
    console.error("[TelnyxSms] Send error:", err);
    return { success: false, error: String(err) };
  }
}
