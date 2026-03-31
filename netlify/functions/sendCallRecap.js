exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);

    // Accept both naming conventions: name/phone or caller_name/caller_phone
    const name = body.name || body.caller_name;
    const phone = body.phone || body.caller_phone;
    const email = body.caller_email || body.email;

    if (!name || !phone) {
      return { statusCode: 400, body: JSON.stringify({ error: "Name and phone are required" }) };
    }

    // Log the full lead payload — integrate with CRM / email as needed
    console.log("[Chat Lead]", JSON.stringify({ ...body, name, phone, email, timestamp: new Date().toISOString() }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("[sendCallRecap error]", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
