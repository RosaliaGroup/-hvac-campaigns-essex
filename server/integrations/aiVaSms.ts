/**
 * AI VA inbound SMS — provider layer is Telnyx (the platform-wide SMS provider).
 *
 * Replaces the legacy Twilio integration (retired July 2026). This module keeps
 * the AI Virtual Assistant's inbound-capture behavior functionally identical —
 * it records inbound texts to `smsConversations` and returns the same
 * acknowledgement reply — but parses the Telnyx inbound webhook shape instead of
 * Twilio's.
 *
 * NOTE: `generateSmsResponse` intentionally remains a canned acknowledgement.
 * Automated AI reply generation was never active and is deliberately NOT enabled
 * by this migration (see the TODO below).
 */

import * as db from "../db";

/** Telnyx inbound webhook envelope (only the fields this handler reads). */
export interface TelnyxInboundWebhook {
  data?: {
    id?: string;
    event_type?: string;
    payload?: {
      id?: string;
      text?: string;
      from?: { phone_number?: string };
    };
  };
}

/**
 * Handle an inbound SMS delivered by Telnyx to the AI VA webhook.
 * Stores the message for the AI VA conversation inbox and returns an
 * acknowledgement reply. Non-message events (e.g. delivery receipts) are
 * ignored without storing.
 */
export async function handleIncomingSms(webhook: TelnyxInboundWebhook) {
  const payload = webhook?.data?.payload;
  const eventType = webhook?.data?.event_type;
  const fromNumber = payload?.from?.phone_number;
  const text = payload?.text;

  // Only inbound messages are recorded. Anything else (status callbacks, etc.)
  // is acknowledged but not stored — matching the prior "one row per inbound
  // text" behavior.
  if (eventType && eventType !== "message.received") {
    console.log("[AiVaSms] Ignoring non-message event:", eventType);
    return generateSmsResponse(text ?? "", fromNumber ?? "");
  }

  if (!fromNumber || text == null) {
    console.log("[AiVaSms] Inbound webhook missing phone or text — ignoring");
    return generateSmsResponse(text ?? "", fromNumber ?? "");
  }

  console.log("[AiVaSms] Incoming SMS from:", fromNumber);

  // Store SMS in database (AI VA conversation inbox).
  await db.createSmsConversation({
    conversationId: payload?.id ?? webhook?.data?.id ?? "",
    phoneNumber: fromNumber,
    direction: "inbound",
    message: text,
    status: "received",
  });

  // Generate AI response
  const response = await generateSmsResponse(text, fromNumber);

  return response;
}

/**
 * Generate AI response to SMS.
 *
 * TODO: Use an LLM to generate a contextual response (conversation history,
 * lead qualification, service inquiry, appointment scheduling).
 *
 * This remains a fixed acknowledgement — the automated LLM reply path was never
 * activated in production and is intentionally left dormant by the Telnyx
 * migration. Do not enable it here.
 */
async function generateSmsResponse(message: string, phoneNumber: string): Promise<string> {
  return "Thanks for contacting Mechanical Enterprise! We'll respond shortly. For immediate assistance, call (862) 423-9396.";
}
