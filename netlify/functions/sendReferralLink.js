const TEXTBELT_API = "https://textbelt.com/text";

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

    const apiKey = process.env.TEXTBELT_API_KEY;
    if (!apiKey) {
      console.error("TEXTBELT_API_KEY not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "SMS not configured" }),
      };
    }

    const message =
      `Hi ${name} \u2014 here\u2019s the referral link as promised. ` +
      `Mechanical Enterprise pays $500 per referral that becomes a customer. ` +
      `No cap. mechanicalenterprise.com/referral ` +
      `\u2014 Mechanical Enterprise. Reply STOP to opt out.`;

    const params = new URLSearchParams({
      phone,
      message,
      key: apiKey,
    });

    const res = await fetch(TEXTBELT_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();

    if (!data.success) {
      console.error("[sendReferralLink] Textbelt error:", data.error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.error || "SMS failed" }),
      };
    }

    console.log("[sendReferralLink] Sent to", phone, "quota:", data.quotaRemaining);

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
