/**
 * Vapi Tool Call Handlers for Jessica (Mechanical Enterprise AI Assistant)
 *
 * Canonical Vapi dispatcher tools: getCallerInfo, sendReferralLink, bookHVAC,
 * rescheduleHVAC. Legacy bookAppointment/rescheduleAppointment are NOT exposed to
 * the Mechanical Vapi assistant (see canonical dispatcher below). sendForm and
 * sendCallRecap are served by their own authenticated routes, not this dispatcher.
 */
import * as db from "../db";
import { parsePreferredDateTime } from "../services/appointmentTime";
import { findCustomerIdByPhone } from "../routers/customers";
import { resolveAppointmentContext, matchPropertyByFreeText } from "../services/appointmentNormalization";
import { formatPropertyAddress } from "@shared/address";
import { notifyOwner } from "../_core/notification";
import { lookupCallerInfo } from "./callerInfo";
import { sendCustomerReferralLink } from "../services/referralSms";
import { rescheduleForVapi, type RescheduleRequest } from "../services/rescheduleAppointment";
import { handleBookHVAC } from "./vapiBookHvac";

export interface VapiToolCallPayload {
  message: {
    type: "tool-calls";
    toolCallList: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string; // JSON string
      };
    }>;
    call?: {
      id?: string;
    };
  };
}

export interface VapiToolResult {
  results: Array<{
    toolCallId: string;
    result: string;
  }>;
}

export async function handleVapiToolCalls(payload: VapiToolCallPayload): Promise<VapiToolResult> {
  const results: VapiToolResult["results"] = [];

  for (const toolCall of payload.message.toolCallList) {
    const toolName = toolCall.function.name;
    let args: Record<string, string> = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = {};
    }

    let result = "";

    try {
      if (toolName === "bookAppointment") {
        result = await handleBookAppointment(args, payload.message.call?.id);
      } else if (toolName === "bookHVAC") {
        // Mechanical-only HVAC booking (Rosalia-isolated). See ./vapiBookHvac.
        result = await handleBookHVAC(args, payload.message.call?.id);
      } else if (toolName === "rescheduleAppointment") {
        result = await handleRescheduleAppointment(args, payload.message.call?.id);
      } else if (toolName === "getCallerInfo") {
        result = await handleGetCallerInfo(args);
      } else if (toolName === "sendReferralLink") {
        result = await handleSendReferralLink(args);
      } else {
        result = JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
      }
    } catch (err) {
      console.error(`[VapiTools] Error handling ${toolName}:`, err);
      result = JSON.stringify({ success: false, error: "Internal error processing tool call" });
    }

    results.push({ toolCallId: toolCall.id, result });
  }

  return { results };
}

async function handleBookAppointment(args: Record<string, string>, vapiCallId?: string): Promise<string> {
  const {
    full_name,
    phone,
    email,
    property_address,
    property_type,
    appointment_type,
    preferred_date,
    preferred_time,
    issue_description,
  } = args;

  // Validate required fields
  if (!full_name || !phone || !appointment_type || !preferred_date || !preferred_time) {
    return JSON.stringify({
      success: false,
      error: "Missing required fields: full_name, phone, appointment_type, preferred_date, preferred_time",
    });
  }

  // Validate appointment type
  const validTypes = ["free_consultation", "technician_dispatch", "maintenance_plan", "commercial_assessment"] as const;
  const apptType = appointment_type as typeof validTypes[number];
  if (!validTypes.includes(apptType)) {
    return JSON.stringify({ success: false, error: `Invalid appointment_type: ${appointment_type}` });
  }

  // Phase 1 upgrade: best-effort parse into a real datetime + auto-link customer.
  // Both are non-fatal — Jessica's booking must never fail because of them.
  let scheduledAt: Date | undefined;
  let customerId: number | undefined;
  try {
    scheduledAt = parsePreferredDateTime(preferred_date, preferred_time) ?? undefined;
  } catch { /* leave unscheduled — surfaces in calendar backlog */ }
  try {
    customerId = (await findCustomerIdByPhone(phone)) ?? undefined;
  } catch { /* unlinked is fine */ }

  // Route through the shared normalization: resolve an existing customer/property,
  // persist customerId + propertyId when matched, and keep the free-text address as
  // a fallback when no CRM record matches. Never creates customers/properties.
  // Non-fatal — Jessica's booking must never fail because of resolution.
  let resolvedFullName = full_name;
  let resolvedPhone = phone;
  let resolvedEmail: string | undefined = email || undefined;
  let resolvedPropertyType: "residential" | "commercial" = property_type === "commercial" ? "commercial" : "residential";
  let resolvedAddress: string | undefined = property_address || undefined;
  let propertyId: number | undefined;
  try {
    const dbi = await db.getDb();
    if (dbi) {
      const ctx = await resolveAppointmentContext(dbi, {
        customerId: customerId ?? null,
        propertyId: null,
        fullName: full_name,
        phone,
        email: email || null,
        propertyAddress: property_address || null,
        propertyType: resolvedPropertyType,
      });
      customerId = ctx.customerId ?? customerId;
      propertyId = ctx.propertyId ?? undefined;
      resolvedFullName = ctx.fullName ?? full_name;
      resolvedPhone = ctx.phone ?? phone;
      resolvedEmail = ctx.email ?? resolvedEmail;
      resolvedPropertyType = ctx.propertyType ?? resolvedPropertyType;
      resolvedAddress = ctx.propertyAddress ?? resolvedAddress;
      // If a free-text address was given and no structured property resolved yet,
      // try to match one of the customer's properties by that address text.
      if (customerId && !propertyId && property_address?.trim()) {
        const matched = await matchPropertyByFreeText(dbi, customerId, property_address);
        if (matched) {
          propertyId = matched.id;
          resolvedAddress = formatPropertyAddress(matched);
        }
      }
    }
  } catch { /* resolution is best-effort; fall back to free-text */ }

  // Save to database
  await db.createAppointment({
    fullName: resolvedFullName,
    phone: resolvedPhone,
    email: resolvedEmail,
    propertyAddress: resolvedAddress,
    propertyType: resolvedPropertyType,
    appointmentType: apptType,
    preferredDate: preferred_date,
    preferredTime: preferred_time,
    scheduledAt,
    customerId,
    propertyId,
    issueDescription: issue_description || undefined,
    status: "pending",
    bookedBy: "jessica",
    source: "phone",
    vapiCallId: vapiCallId || undefined,
  });

  // Notify owner
  const typeLabels: Record<string, string> = {
    free_consultation: "Free Consultation",
    technician_dispatch: "Technician Dispatch",
    maintenance_plan: "Maintenance Plan",
    commercial_assessment: "Commercial Assessment",
  };

  await notifyOwner({
    title: `📅 New Appointment Booked by Jessica — ${typeLabels[appointment_type] || appointment_type}`,
    content: `Jessica (AI assistant) just booked a new appointment:\n\nName: ${full_name}\nPhone: ${phone}\nEmail: ${email || "Not provided"}\nAddress: ${property_address || "Not provided"}\nProperty Type: ${property_type || "residential"}\nAppointment Type: ${typeLabels[appointment_type] || appointment_type}\nDate: ${preferred_date}\nTime: ${preferred_time}\nIssue: ${issue_description || "Not specified"}\n\nLog in to your dashboard to confirm and prepare.`,
  });

  return JSON.stringify({
    success: true,
    message: `Appointment booked for ${full_name} on ${preferred_date} at ${preferred_time}. Confirmation will be sent shortly.`,
    appointmentId: `ME-${Date.now()}`,
  });
}

/**
 * Reschedule an existing Mechanical Enterprise appointment. Same Vapi contract as
 * before — required args `phone`, `new_date`, `new_time` (plus an optional
 * `appointment_id` to disambiguate) — but the safety, customer-isolation,
 * calendar-mirroring and idempotency logic lives in the rescheduleAppointment
 * service. The result is still a JSON string Jessica reads back to the caller:
 * `success` + `message` on success, `success:false` + `error` otherwise (with
 * `options` when the caller must choose between multiple upcoming appointments).
 */
async function handleRescheduleAppointment(args: Record<string, string>, vapiCallId?: string): Promise<string> {
  const { phone, new_date, new_time } = args;

  if (!phone || !new_date || !new_time) {
    return JSON.stringify({
      success: false,
      error: "Missing required fields: phone, new_date, new_time",
    });
  }

  const rawId = args.appointment_id ?? args.appointmentId;
  const parsedId = rawId != null && /^\d+$/.test(String(rawId).trim()) ? Number(rawId) : null;

  const req: RescheduleRequest = {
    phone,
    appointmentId: parsedId,
    newDate: new_date,
    newTime: new_time,
    vapiCallId: vapiCallId || null,
  };

  const result = await rescheduleForVapi(req);

  if (result.success) {
    return JSON.stringify({
      success: true,
      message: result.message,
      appointmentId: result.appointmentId,
      newDate: result.newDate,
      newTime: result.newTime,
      calendar: result.calendar,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  }

  return JSON.stringify({
    success: false,
    reason: result.reason,
    error: result.message,
    ...(result.options ? { options: result.options } : {}),
  });
}

async function handleSendReferralLink(args: Record<string, string>): Promise<string> {
  const phone = args.phone;
  // Vapi may pass the caller's name under a few key shapes; all optional.
  const firstName = args.first_name || args.firstName || args.full_name || args.name || undefined;

  if (!phone) {
    return JSON.stringify({ success: false, error: "Missing required field: phone" });
  }

  const outcome = await sendCustomerReferralLink({ phone, firstName });

  switch (outcome.status) {
    case "sent":
      return JSON.stringify({
        success: true,
        message:
          "I've just texted you our referral link. Share it with anyone who needs HVAC work — you earn $500 when they book.",
      });
    case "duplicate":
      // Idempotent: a link was already sent for this call / retry. Report success
      // without sending again so the caller never gets a duplicate text.
      return JSON.stringify({
        success: true,
        message: "I already sent the referral link to your phone — please check your messages.",
      });
    case "opted_out":
      return JSON.stringify({
        success: false,
        error: "That number has opted out of our text messages, so I can't text the link.",
      });
    case "invalid_number":
      return JSON.stringify({
        success: false,
        error: "That phone number doesn't look valid, so I couldn't send the text.",
      });
    case "send_failed":
    default:
      // Never expose provider errors or credentials — generic, caller-safe copy.
      return JSON.stringify({
        success: false,
        error: "I wasn't able to send the text right now. Please try again in a moment.",
      });
  }
}

/**
 * getCallerInfo — Mechanical Enterprise ONLY caller lookup.
 *
 * All caller resolution, customer isolation, shared-number handling, and privacy
 * filtering live in ./callerInfo. This handler only preserves the Vapi tool
 * contract: it validates input and serializes the minimal result. There is no
 * Rosalia lookup and no cross-project call anywhere in this path.
 */
async function handleGetCallerInfo(args: Record<string, string>): Promise<string> {
  const { phone } = args;

  if (!phone) {
    return JSON.stringify({ found: false, error: "Phone number required" });
  }

  const info = await lookupCallerInfo(phone);
  return JSON.stringify(info);
}

// NOTE: sendCallRecap is intentionally NOT handled here. handleVapiToolCalls is
// exposed via the PUBLIC (unauthenticated) tRPC `vapiTools` webhook, so routing
// recap persistence through it would create an unauthenticated recap path. The
// recap has exactly one processing path — the fail-closed REST route
// POST /api/vapi/call-recap (see vapiRecapRoute.ts).
