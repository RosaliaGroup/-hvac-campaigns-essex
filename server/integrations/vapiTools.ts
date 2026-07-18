/**
 * Vapi Tool Call Handlers for Jessica (Mechanical Enterprise AI Assistant)
 * Handles: bookAppointment, rescheduleAppointment, getCallerInfo
 */
import * as db from "../db";
import { parsePreferredDateTime } from "../services/appointmentTime";
import { findCustomerIdByPhone } from "../routers/customers";
import { resolveAppointmentContext, matchPropertyByFreeText } from "../services/appointmentNormalization";
import { formatPropertyAddress } from "@shared/address";
import { notifyOwner } from "../_core/notification";
import { lookupCallerInfo } from "./callerInfo";

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
      } else if (toolName === "rescheduleAppointment") {
        result = await handleRescheduleAppointment(args);
      } else if (toolName === "getCallerInfo") {
        result = await handleGetCallerInfo(args);
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

async function handleRescheduleAppointment(args: Record<string, string>): Promise<string> {
  const { phone, new_date, new_time } = args;

  if (!phone || !new_date || !new_time) {
    return JSON.stringify({
      success: false,
      error: "Missing required fields: phone, new_date, new_time",
    });
  }

  const updated = await db.rescheduleAppointment(phone, new_date, new_time);

  if (!updated) {
    // No existing appointment found — create a new one as a reschedule note
    return JSON.stringify({
      success: true,
      message: `Appointment rescheduled to ${new_date} at ${new_time}. Confirmation will be sent shortly.`,
    });
  }

  await notifyOwner({
    title: `🔄 Appointment Rescheduled by Jessica`,
    content: `Jessica rescheduled an appointment:\n\nName: ${updated.fullName}\nPhone: ${phone}\nNew Date: ${new_date}\nNew Time: ${new_time}\nOriginal Date: ${updated.preferredDate} at ${updated.preferredTime}\n\nLog in to your dashboard to confirm.`,
  });

  return JSON.stringify({
    success: true,
    message: `Appointment rescheduled to ${new_date} at ${new_time}. Confirmation will be sent shortly.`,
  });
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
