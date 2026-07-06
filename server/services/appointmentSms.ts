/**
 * Shared Telnyx SMS sender + appointment confirmation messages.
 * Extracted so appointments, rebate calculator, and future flows share one path.
 *
 * Guarantee: these functions NEVER throw — SMS failure must not fail a booking.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { smsContacts, type Appointment } from "../../drizzle/schema";

const BUSINESS_PHONE = "(862) 423-9396";

/** Normalize to E.164 (+1XXXXXXXXXX). Returns null if not a usable US number. */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** True if this number has opted out via the SMS contacts list. */
async function isOptedOut(phone: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const last10 = phone.replace(/\D/g, "").slice(-10);
    const rows = await db
      .select({ optedOut: smsContacts.optedOut })
      .from(smsContacts)
      .where(sql`RIGHT(REGEXP_REPLACE(${smsContacts.phone}, '[^0-9]', ''), 10) = ${last10}`)
      .limit(1);
    return rows[0]?.optedOut === true;
  } catch {
    return false; // fail open for transactional confirmations
  }
}

export async function sendTelnyxSms(
  phone: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
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
    return { success: true };
  } catch (err) {
    console.error("[TelnyxSms] Send error:", err);
    return { success: false, error: String(err) };
  }
}

const TYPE_LABELS: Record<string, string> = {
  free_consultation: "Free Consultation",
  technician_dispatch: "Service Visit",
  maintenance_plan: "Maintenance Visit",
  commercial_assessment: "Commercial Assessment",
};

function formatWhen(appt: Pick<Appointment, "scheduledAt" | "preferredDate" | "preferredTime">): string {
  if (appt.scheduledAt) {
    return new Date(appt.scheduledAt).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  }
  return `${appt.preferredDate} at ${appt.preferredTime}`;
}

/**
 * Send a booking confirmation (or reschedule notice) to the customer.
 * Respects opt-outs. Never throws; returns whether the send happened.
 */
export async function sendAppointmentConfirmationSms(
  appt: Pick<Appointment, "fullName" | "phone" | "appointmentType" | "scheduledAt" | "preferredDate" | "preferredTime">,
  opts: { isReschedule?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!appt.phone) return { sent: false, reason: "no phone" };
    if (await isOptedOut(appt.phone)) return { sent: false, reason: "opted out" };

    const firstName = (appt.fullName || "").trim().split(/\s+/)[0] || "there";
    const label = TYPE_LABELS[appt.appointmentType] || "Appointment";
    const when = formatWhen(appt);

    const message = [
      opts.isReschedule
        ? `Hi ${firstName}, your Mechanical Enterprise ${label} has been rescheduled to ${when}.`
        : `Hi ${firstName}! Your Mechanical Enterprise ${label} is booked for ${when}.`,
      ``,
      `Need to change it? Call ${BUSINESS_PHONE}.`,
      `Reply STOP to opt out.`,
    ].join("\n");

    const result = await sendTelnyxSms(appt.phone, message);
    return { sent: result.success, reason: result.error };
  } catch (err) {
    console.error("[AppointmentSms] Unexpected error:", err);
    return { sent: false, reason: String(err) };
  }
}
