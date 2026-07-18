/**
 * Shared Telnyx SMS sender + appointment confirmation messages.
 * Extracted so appointments, rebate calculator, and future flows share one path.
 *
 * Guarantee: these functions NEVER throw — SMS failure must not fail a booking.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { smsContacts, type Appointment } from "../../drizzle/schema";
import { sendTelnyxSms } from "./telnyxSms";
import { logOutboundBestEffort, mechanicalSmsFrom } from "./smsOutbound";
export { sendTelnyxSms, toE164 } from "./telnyxSms"; // re-export for existing importers

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

const BUSINESS_PHONE = "(862) 423-9396";

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

    // Record the confirmation in the 2-Way Inbox thread (best-effort; never
    // fails the booking). Unknown numbers stay unlinked (contactId null).
    const db = await getDb();
    if (db) {
      await logOutboundBestEffort(db, {
        phone: appt.phone,
        message,
        fromNumber: mechanicalSmsFrom(),
        telnyxMessageId: result.messageId ?? null,
        deliveryStatus: result.success ? "accepted" : "failed",
        source: "appointment",
        sentByName: "Appointment",
      });
    }

    return { sent: result.success, reason: result.error };
  } catch (err) {
    console.error("[AppointmentSms] Unexpected error:", err);
    return { sent: false, reason: String(err) };
  }
}
