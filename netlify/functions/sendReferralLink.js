// SMS provider: Telnyx (active). TextBelt is LEGACY — removed July 2026.
const TELNYX_API = "https://api.telnyx.com/v2/messages";

function toE164(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const phone = body.phone;
    const name = (body.name || "there").trim().split(" ")[0];

    if (!phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "phone is required" }),
      };
    }

    const apiKey = process.env.TELNYX_API_KEY;
    const fromNumber = process.env.TELNYX_FROM_NUMBER;
    if (!apiKey || !fromNumber) {
      console.error("Telnyx not configured (TELNYX_API_KEY / TELNYX_FROM_NUMBER)");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "SMS not configured" }),
      };
    }
    const to = toE164(phone);
    if (!to) {
      return { statusCode: 400, body: JSON.stringify({ error: "invalid phone" }) };
    }

    const message =
      `Hi ${name} \u2014 here\u2019s the referral link as promised. ` +
      `Mechanical Enterprise pays $500 per referral that becomes a customer. ` +
      `No cap. mechanicalenterprise.com/referral ` +
      `\u2014 Mechanical Enterprise. Reply STOP to opt out.`;

    const res = await fetch(TELNYX_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromNumber, to, text: message }),
    });

    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { /* non-JSON error body */ }

    // Telnyx success = 2xx with data.data.id. (No TextBelt-style success/quota.)
    if (!res.ok || !data?.data?.id) {
      const errDetail = data?.errors?.[0]?.detail || raw.slice(0, 200) || `HTTP ${res.status}`;
      console.error("[sendReferralLink] Telnyx error:", errDetail);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "SMS failed" }),
      };
    }

    console.log("[sendReferralLink] Sent — telnyxMessageId:", data.data.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("[sendReferralLink error]", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send SMS", details: err.message }),
    };
  }
};
