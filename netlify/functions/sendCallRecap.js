// sendCallRecap (Vapi tool endpoint)
// -----------------------------------------------------------------------------
// Mechanical Enterprise ONLY. This edge function no longer sends email itself
// (the previous generic-SMTP/nodemailer path is removed). It forwards the call
// recap to the Mechanical Enterprise server, which persists it to the CRM (best
// available record), notifies the office via the Mechanical email service
// (Resend), and — with consent — texts the caller via Telnyx.
//
// The external Vapi request/response contract is preserved:
//   POST body: { name|caller_name, phone|caller_phone, email|caller_email,
//                appointment_type, call_summary, outcome, ... }
//   200 -> { success: true }
//
// No Rosalia / rosaliagroup endpoint, no SMTP secret, no Textbelt, no Twilio,
// no hard-coded credentials.

// Server base URL is read from config (never hard-coded). Any of these envs work.
const API_BASE =
  process.env.MECHANICAL_API_URL ||
  process.env.MECHANICAL_APP_URL ||
  process.env.APP_BASE_URL ||
  "";

const RECAP_PATH = "/api/vapi/call-recap";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const name = body.name || body.caller_name;
  const phone = body.phone || body.caller_phone;
  if (!name || !phone) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Name and phone are required" }),
    };
  }

  // Operational fields only — never forward prompts, system instructions,
  // secrets, tokens, or unrelated payload keys.
  const recap = {
    call_id: body.call_id || body.vapiCallId || null,
    name,
    phone,
    email: body.caller_email || body.email || null,
    appointment_id: body.appointment_id || null,
    reason_for_call: body.reason_for_call || null,
    requested_service: body.requested_service || body.appointment_type || null,
    appointment_type: body.appointment_type || null,
    appointment_details: body.appointment_details || null,
    property_address: body.property_address || null,
    urgency: body.urgency || null,
    ai_summary: body.ai_summary || body.call_summary || null,
    call_summary: body.call_summary || null,
    unresolved_questions: body.unresolved_questions || null,
    follow_up_required: body.follow_up_required ?? null,
    outcome: body.outcome || null,
    send_customer_sms: body.send_customer_sms ?? false,
    sms_consent: body.sms_consent ?? false,
  };

  if (!API_BASE) {
    // No server configured — do NOT lose the recap. Log the operational fields
    // (recoverable from function logs) and signal failure so Vapi retries.
    console.error(
      "[sendCallRecap] MECHANICAL_API_URL not configured — recap not persisted. Operational recap:",
      JSON.stringify({ ...recap, email: recap.email ? "[provided]" : null }),
    );
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Recap service unavailable" }),
    };
  }

  try {
    const headers = { "Content-Type": "application/json" };
    if (process.env.VAPI_WEBHOOK_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.VAPI_WEBHOOK_SECRET}`;
    }

    const res = await fetch(`${API_BASE.replace(/\/+$/, "")}${RECAP_PATH}`, {
      method: "POST",
      headers,
      body: JSON.stringify(recap),
    });

    if (!res.ok) {
      // Server rejected/failed. Log operational context and let Vapi retry;
      // the server is idempotent on call_id, so a retry cannot duplicate.
      console.error(
        `[sendCallRecap] server returned ${res.status} — recap not confirmed. call_id=${recap.call_id || "none"}`,
      );
      return { statusCode: 502, body: JSON.stringify({ error: "Recap not stored" }) };
    }

    console.log("[sendCallRecap] recap forwarded to Mechanical server", {
      name,
      hasAppointment: Boolean(recap.appointment_id),
      outcome: recap.outcome,
    });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("[sendCallRecap] forward failed:", err && err.message ? err.message : "unknown error");
    return { statusCode: 502, body: JSON.stringify({ error: "Recap forward failed" }) };
  }
};
