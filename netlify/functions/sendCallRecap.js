exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { name, phone, caller_email, message, transcript } = JSON.parse(event.body);

    if (!name || !phone) {
      return { statusCode: 400, body: JSON.stringify({ error: "Name and phone are required" }) };
    }

    // Log the lead capture for now — integrate with CRM / email as needed
    console.log("[Chat Lead]", JSON.stringify({ name, phone, caller_email, message, transcript, timestamp: new Date().toISOString() }));

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
