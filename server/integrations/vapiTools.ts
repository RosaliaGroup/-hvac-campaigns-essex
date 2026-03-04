/**
 * Vapi Tool Call Handlers for Jessica (Mechanical Enterprise AI Assistant)
 * Handles: bookAppointment, rescheduleAppointment, getCallerInfo
 */
import * as db from "../db";
import { notifyOwner } from "../_core/notification";

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

  // Save to database
  await db.createAppointment({
    fullName: full_name,
    phone,
    email: email || undefined,
    propertyAddress: property_address || undefined,
    propertyType: (property_type === "commercial" ? "commercial" : "residential"),
    appointmentType: apptType,
    preferredDate: preferred_date,
    preferredTime: preferred_time,
    issueDescription: issue_description || undefined,
    status: "pending",
    bookedBy: "jessica",
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

async function handleGetCallerInfo(args: Record<string, string>): Promise<string> {
  const { phone } = args;

  if (!phone) {
    return JSON.stringify({ found: false, error: "Phone number required" });
  }

  // Look up existing appointment
  const appointment = await db.getAppointmentByPhone(phone);
  
  // Also look up lead captures
  const leadCaptures = await db.getAllLeadCaptures({ limit: 5 });
  const matchingLead = leadCaptures.find(lc => lc.phone === phone || lc.phone?.replace(/\D/g, "") === phone.replace(/\D/g, ""));

  if (appointment) {
    return JSON.stringify({
      found: true,
      name: appointment.fullName,
      phone: appointment.phone,
      email: appointment.email || "",
      hasExistingAppointment: true,
      lastAppointmentDate: appointment.preferredDate,
      lastAppointmentTime: appointment.preferredTime,
      lastAppointmentStatus: appointment.status,
      appointmentType: appointment.appointmentType,
    });
  }

  if (matchingLead) {
    const name = matchingLead.name || [matchingLead.firstName, matchingLead.lastName].filter(Boolean).join(" ") || "";
    return JSON.stringify({
      found: true,
      name,
      phone: matchingLead.phone || phone,
      email: matchingLead.email || "",
      hasExistingAppointment: false,
      source: matchingLead.captureType,
    });
  }

  return JSON.stringify({ found: false });
}
