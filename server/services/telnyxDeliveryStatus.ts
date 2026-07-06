/**
 * Telnyx delivery-status webhook parsing (Task 6.5).
 * Pure functions — unit tested. The webhook route in smsWebhook.ts feeds
 * request bodies through parseTelnyxStatusEvent and applies updates.
 *
 * Telnyx sends outbound lifecycle events (message.sent, message.finalized)
 * to the SAME messaging-profile webhook URL as inbound messages, so no new
 * portal configuration is required beyond the /api/sms/reply URL.
 */

export type DeliveryStatus =
  | "accepted"
  | "sent"
  | "delivered"
  | "delivery_failed"
  | "rejected"
  | "carrier_filtered";

export interface ParsedStatusEvent {
  telnyxMessageId: string;
  eventType: string;
  rawToStatus: string;
  deliveryStatus: DeliveryStatus;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
}

/**
 * Carrier-filtering / 10DLC error families. 40010 ("Not 10DLC registered")
 * is the one that bit us on 2026-07-06; the rest are Telnyx's documented
 * blocked/filtered codes.
 */
const CARRIER_FILTER_CODES = new Set([
  "40001", "40002", "40003", "40006", "40008", "40010", "40011", "40012",
]);
function isCarrierFilterCode(code: string | null): boolean {
  if (!code) return false;
  return CARRIER_FILTER_CODES.has(code) || /^403\d\d$/.test(code); // 403xx = blocked-by-carrier family
}

/** Map Telnyx's per-recipient status (+ error code) onto our enum. */
export function mapTelnyxDeliveryStatus(rawToStatus: string, errorCode: string | null): DeliveryStatus | null {
  switch (rawToStatus) {
    case "queued":
    case "sending":
      return "accepted";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "delivery_failed":
    case "delivery_unconfirmed":
      return isCarrierFilterCode(errorCode) ? "carrier_filtered" : "delivery_failed";
    case "sending_failed":
      return "rejected";
    default:
      return null; // unknown status — ignore rather than guess
  }
}

/**
 * Parse a webhook body. Returns null for anything that is NOT an outbound
 * delivery-status event (inbound message.received, legacy TextBelt format,
 * malformed payloads) so the caller can fall through to inbound handling.
 */
export function parseTelnyxStatusEvent(body: unknown): ParsedStatusEvent | null {
  const b = body as {
    data?: {
      event_type?: string;
      payload?: {
        id?: string;
        direction?: string;
        to?: Array<{ status?: string }>;
        errors?: Array<{ code?: string | number; title?: string; detail?: string }>;
        completed_at?: string | null;
      };
    };
  };

  const eventType = b?.data?.event_type;
  const p = b?.data?.payload;
  if (!eventType || !p) return null;

  // Only outbound lifecycle events carry delivery status we care about.
  const isStatusEvent = eventType === "message.sent" || eventType === "message.finalized";
  if (!isStatusEvent) return null;
  if (p.direction && p.direction !== "outbound") return null;
  if (!p.id) return null;

  const rawToStatus = p.to?.[0]?.status ?? "";
  const firstError = p.errors?.[0];
  const errorCode = firstError?.code != null ? String(firstError.code) : null;
  const errorMessage = firstError
    ? [firstError.title, firstError.detail].filter(Boolean).join(" — ").slice(0, 500) || null
    : null;

  const deliveryStatus = mapTelnyxDeliveryStatus(rawToStatus, errorCode);
  if (!deliveryStatus) return null;

  let completedAt: Date | null = null;
  if (p.completed_at) {
    const d = new Date(p.completed_at);
    if (!isNaN(d.getTime())) completedAt = d;
  }

  return { telnyxMessageId: p.id, eventType, rawToStatus, deliveryStatus, errorCode, errorMessage, completedAt };
}
