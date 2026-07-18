/**
 * Vapi `bookHVAC` tool — Mechanical Enterprise ONLY.
 *
 * Mechanical-native replacement for the legacy Rosalia Group / Abrevo `bookHVAC`
 * Netlify function (silver-ganache-1ee2ca), which wrote to a shared Rosalia
 * Supabase, used the Rosalia Google Calendar, and sent from a rosaliagroup.com
 * address. NONE of those dependencies exist here:
 *
 *   • The appointment is created ONLY in the Mechanical Enterprise CRM
 *     (appointments table) via the existing server services.
 *   • Customers are matched by normalized phone and, when found, linked.
 *   • Calendar sync goes through the EXISTING database-driven architecture:
 *     the booking's attendees + `syncAppointmentInvites`, which resolves the
 *     target calendar from `appointments.googleCalendarId` ?? the stored Google
 *     Calendar connection's `googleCalendarId`. There is NO global calendar env
 *     var, no hardcoded calendar id, and no Rosalia-calendar fallback. When no
 *     connection (and therefore no applicable `googleCalendarId`) exists, the
 *     sync service degrades safely (ICS email, or nothing) and never throws.
 *   • No Rosalia API, database, calendar, secret, or environment variable is
 *     referenced.
 *
 * Contract: the public Vapi tool name (`bookHVAC`), its inputs, and its output
 * shape are preserved. Inputs arrive as a flat `args` object; the output is a
 * JSON string safe to read back to the caller. Internal errors and database
 * details are never surfaced to Vapi.
 *
 * Timezone: the free-text preferred date/time is parsed by the shared
 * `parsePreferredDateTime`, and calendar rendering uses the existing IANA
 * `America/New_York` zone inside `syncAppointmentInvites`/`mapToGoogleEvent`.
 * No fixed UTC offset is ever hardcoded, so daylight-saving is handled by the
 * zone.
 *
 * Side effects (calendar, owner notification) are BEST EFFORT: a booking must
 * never fail because a downstream integration is unavailable.
 */
import * as db from "../db";
import { findCustomerIdByPhone } from "../routers/customers";
import { parsePreferredDateTime } from "../services/appointmentTime";
import { notifyOwner } from "../_core/notification";
import { normalizeAttendees, replaceAttendees, syncAppointmentInvites } from "../services/appointmentInvites";
import type { InsertAppointment } from "../../drizzle/schema";

const LOG = "[VapiBookHVAC]";

/**
 * Appointment types the assistant is allowed to book. Kept identical to the
 * existing Vapi contract so conversational behavior is unchanged; when the tool
 * sends no (or an unknown) type we default to a technician dispatch rather than
 * failing the booking.
 */
const VALID_APPOINTMENT_TYPES = [
  "free_consultation",
  "technician_dispatch",
  "maintenance_plan",
  "commercial_assessment",
] as const;
type ApptType = (typeof VALID_APPOINTMENT_TYPES)[number];
const DEFAULT_APPOINTMENT_TYPE: ApptType = "technician_dispatch";

const TYPE_LABELS: Record<ApptType, string> = {
  free_consultation: "Free Consultation",
  technician_dispatch: "Technician Dispatch",
  maintenance_plan: "Maintenance Plan",
  commercial_assessment: "Commercial Assessment",
};

/** First-token of a full name, for a friendly log tag (never the full PII). */
function firstNameOnly(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "caller";
}

/** Last-4 of a phone, for correlation in logs without storing the full number. */
function phoneTag(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `…${digits.slice(-4)}` : "unknown";
}

/**
 * Normalized bookHVAC arguments. Field aliases mirror the historical Vapi
 * contract (full_name/phone/email/property_address/…) while also accepting the
 * looser names the assistant sometimes emits (name, address, service, notes).
 */
export interface BookHvacArgs {
  full_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  property_address?: string;
  address?: string;
  /** Optional second address line; folded into the stored address when present. */
  address_line2?: string;
  property_type?: string;
  appointment_type?: string;
  /** "Service requested" — the HVAC job/equipment (maps to serviceType). */
  service_type?: string;
  service?: string;
  preferred_date?: string;
  preferred_time?: string;
  /** "Job description" — free text about the issue (maps to issueDescription). */
  issue_description?: string;
  description?: string;
  notes?: string;
}

export interface ParsedBooking {
  fullName: string;
  phone: string;
  email?: string;
  propertyAddress?: string;
  propertyType: "residential" | "commercial";
  appointmentType: ApptType;
  serviceType?: string;
  preferredDate: string;
  preferredTime: string;
  issueDescription?: string;
}

function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    const t = typeof v === "string" ? v.trim() : "";
    if (t) return t;
  }
  return undefined;
}

/**
 * Validate + normalize raw tool arguments. Returns the parsed booking or a list
 * of missing required fields. Pure (no I/O) so it is unit-tested directly.
 */
export function parseBookHvacArgs(args: BookHvacArgs): { ok: true; value: ParsedBooking } | { ok: false; missing: string[] } {
  const fullName = firstNonEmpty(args.full_name, args.name);
  const phone = firstNonEmpty(args.phone);
  const preferredDate = firstNonEmpty(args.preferred_date);
  const preferredTime = firstNonEmpty(args.preferred_time);

  const missing: string[] = [];
  if (!fullName) missing.push("full_name");
  if (!phone) missing.push("phone");
  if (!preferredDate) missing.push("preferred_date");
  if (!preferredTime) missing.push("preferred_time");
  if (missing.length) return { ok: false, missing };

  const rawType = firstNonEmpty(args.appointment_type);
  const appointmentType: ApptType =
    rawType && (VALID_APPOINTMENT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as ApptType)
      : DEFAULT_APPOINTMENT_TYPE;

  // Fold an optional second address line into the stored address.
  const line1 = firstNonEmpty(args.property_address, args.address);
  const line2 = firstNonEmpty(args.address_line2);
  const propertyAddress = line1 ? (line2 ? `${line1}, ${line2}` : line1) : undefined;

  return {
    ok: true,
    value: {
      fullName: fullName!,
      phone: phone!,
      email: firstNonEmpty(args.email),
      propertyAddress,
      propertyType: firstNonEmpty(args.property_type) === "commercial" ? "commercial" : "residential",
      appointmentType,
      serviceType: firstNonEmpty(args.service_type, args.service),
      preferredDate: preferredDate!,
      preferredTime: preferredTime!,
      issueDescription: firstNonEmpty(args.issue_description, args.description, args.notes),
    },
  };
}

/** Safe structured success payload returned to Vapi (JSON-stringified by the caller). */
function successPayload(booking: ParsedBooking, appointmentId: number) {
  return {
    success: true,
    message: `Appointment booked for ${booking.fullName} on ${booking.preferredDate} at ${booking.preferredTime}. Confirmation will be sent shortly.`,
    appointmentId: `ME-${appointmentId}`,
  };
}

/**
 * Mirror a freshly-created booking to the calendar using the EXISTING
 * database-driven pipeline: build the attendee set (the customer, when an email
 * is present), persist it, then run `syncAppointmentInvites`. That service
 * resolves the target calendar from the database
 * (`appointments.googleCalendarId` ?? the connection's `googleCalendarId`),
 * creates/stores the event, and — when no connection (hence no applicable
 * `googleCalendarId`) exists — degrades safely without throwing.
 *
 * Best effort: never throws to the caller.
 */
async function mirrorBookingToCalendar(appointmentId: number, booking: ParsedBooking): Promise<void> {
  try {
    const attendees = normalizeAttendees([], {
      customerEmail: booking.email,
      customerName: booking.fullName,
    });
    await replaceAttendees(appointmentId, attendees);
    // Same rule the staff booking flow uses: only sync when there is someone to
    // invite. syncAppointmentInvites itself also no-ops without a scheduledAt.
    if (attendees.length > 0) {
      await syncAppointmentInvites({ appointmentId });
    }
  } catch (e) {
    console.warn(`${LOG} calendar mirror failed for appointment ${appointmentId}: ${(e as Error).message}`);
  }
}

/**
 * Handle a Vapi `bookHVAC` tool call. Creates the appointment in Mechanical
 * Enterprise, links a matching customer by normalized phone, mirrors to the
 * database-resolved Google Calendar, and returns a JSON string for Vapi.
 *
 * @param rawArgs  Flat arguments collected by the assistant.
 * @param vapiCallId  The Vapi call id (used to make webhook retries idempotent).
 */
export async function handleBookHVAC(rawArgs: BookHvacArgs, vapiCallId?: string): Promise<string> {
  const parsed = parseBookHvacArgs(rawArgs || {});
  if (!parsed.ok) {
    return JSON.stringify({
      success: false,
      error: `Missing required fields: ${parsed.missing.join(", ")}`,
    });
  }
  const booking = parsed.value;
  const tag = `${firstNameOnly(booking.fullName)}/${phoneTag(booking.phone)}`;

  // ── Idempotency: a Vapi retry re-delivers the same call id (or, absent that,
  //    the same phone + date + time). Return the ORIGINAL result, never a dupe.
  try {
    const existing = vapiCallId
      ? await db.getAppointmentByVapiCallId(vapiCallId)
      : await db.findDuplicateAppointment({
          phone: booking.phone,
          preferredDate: booking.preferredDate,
          preferredTime: booking.preferredTime,
        });
    if (existing) {
      console.log(`${LOG} duplicate booking ignored (idempotent) for ${tag} → appointment ${existing.id}`);
      return JSON.stringify(successPayload(booking, existing.id));
    }
  } catch (e) {
    // A failed dedupe lookup must not block a booking; log and continue.
    console.warn(`${LOG} dedupe lookup failed for ${tag}: ${(e as Error).message}`);
  }

  // ── Match an existing customer by normalized phone (link when found). ──
  let customerId: number | undefined;
  try {
    customerId = (await findCustomerIdByPhone(booking.phone)) ?? undefined;
  } catch {
    /* unlinked lead is fine */
  }

  // ── Best-effort parse into a real datetime for calendar placement. The shared
  //    parser (and the calendar's IANA America/New_York zone) handle DST; no
  //    fixed UTC offset is used here. Unparseable → surfaces in the backlog. ──
  let scheduledAt: Date | null = null;
  try {
    scheduledAt = parsePreferredDateTime(booking.preferredDate, booking.preferredTime) ?? null;
  } catch {
    scheduledAt = null;
  }

  const insert: InsertAppointment = {
    fullName: booking.fullName,
    // Store the phone as spoken; phone matching/dedupe normalizes internally.
    phone: booking.phone,
    email: booking.email,
    propertyAddress: booking.propertyAddress,
    propertyType: booking.propertyType,
    appointmentType: booking.appointmentType,
    serviceType: booking.serviceType,
    preferredDate: booking.preferredDate,
    preferredTime: booking.preferredTime,
    scheduledAt: scheduledAt ?? undefined,
    issueDescription: booking.issueDescription,
    status: "pending",
    // Provenance: booked by the Vapi AI receptionist, over a phone call.
    source: "phone",
    bookedBy: "vapi",
    vapiCallId: vapiCallId || undefined,
    customerId,
  };

  // ── Create the appointment. A DB failure here is the only fatal path; it is
  //    reported to Vapi as a safe, generic message (no internal details). ──
  let appointmentId: number;
  try {
    const result = await db.createAppointment(insert);
    // mysql2 returns the new row id as insertId.
    appointmentId = Number((result as { insertId?: number | string })?.insertId ?? 0);
    if (!appointmentId) throw new Error("createAppointment returned no insertId");
  } catch (e) {
    console.error(`${LOG} failed to persist booking for ${tag}: ${(e as Error).message}`);
    return JSON.stringify({
      success: false,
      error: "We couldn't save your appointment just now. Please try again in a moment.",
    });
  }

  console.log(
    `${LOG} booked appointment ${appointmentId} for ${tag}` +
      ` (${booking.appointmentType}${customerId ? `, customer #${customerId}` : ", unconverted lead"}` +
      `${scheduledAt ? "" : ", unscheduled"})`,
  );

  // ── Best-effort calendar mirror via the DB-driven pipeline. ──
  await mirrorBookingToCalendar(appointmentId, booking);

  // ── Best-effort owner notification. ──
  try {
    await notifyOwner({
      title: `📅 New HVAC Appointment (AI receptionist) — ${TYPE_LABELS[booking.appointmentType]}`,
      content:
        `The Vapi AI receptionist booked a new appointment:\n\n` +
        `Name: ${booking.fullName}\n` +
        `Phone: ${booking.phone}\n` +
        `Email: ${booking.email || "Not provided"}\n` +
        `Address: ${booking.propertyAddress || "Not provided"}\n` +
        `Property Type: ${booking.propertyType}\n` +
        `Appointment Type: ${TYPE_LABELS[booking.appointmentType]}\n` +
        `Service Requested: ${booking.serviceType || "Not specified"}\n` +
        `Date: ${booking.preferredDate}\n` +
        `Time: ${booking.preferredTime}\n` +
        `Issue: ${booking.issueDescription || "Not specified"}\n\n` +
        `Log in to your dashboard to confirm and prepare.`,
    });
  } catch (e) {
    console.warn(`${LOG} owner notification failed for appointment ${appointmentId}: ${(e as Error).message}`);
  }

  return JSON.stringify(successPayload(booking, appointmentId));
}
