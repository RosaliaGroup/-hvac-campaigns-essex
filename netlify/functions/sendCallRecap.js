const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const name = body.name || body.caller_name;
    const phone = body.phone || body.caller_phone;
    const email = body.caller_email || body.email || "Not provided";
    const appointmentType = body.appointment_type || "General Inquiry";
    const callSummary = body.call_summary || "No details provided";
    const outcome = body.outcome || "unknown";

    if (!name || !phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Name and phone are required" })
      };
    }

    const outcomeEmoji = {
      booked: "✅",
      needs_follow_up: "📞",
      not_interested: "❌",
      rescheduled: "🔄",
      info_only: "ℹ️"
    }[outcome] || "📋";

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0a1628; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">
            ${outcomeEmoji} New Lead: ${name}
          </h1>
          <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 14px;">
            ${appointmentType}
          </p>
        </div>
        <div style="background: #f9f9f9; padding: 24px; border: 1px solid #eee;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px; width: 140px;">Name</td>
              <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Phone</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="tel:${phone}" style="color: #e8813a;">${phone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; font-size: 14px;">
                <a href="mailto:${email}" style="color: #e8813a;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Type</td>
              <td style="padding: 8px 0; font-size: 14px;">${appointmentType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-size: 14px;">Outcome</td>
              <td style="padding: 8px 0; font-size: 14px;">${outcomeEmoji} ${outcome}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid #e8813a;">
            <p style="margin: 0 0 8px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
              Details / Summary
            </p>
            <p style="margin: 0; font-size: 14px; white-space: pre-line; line-height: 1.6;">${callSummary}</p>
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <a href="tel:${phone}" style="background: #e8813a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
              📞 Call ${name} Now
            </a>
          </div>
        </div>
        <div style="background: #eee; padding: 12px 24px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            Mechanical Enterprise LLC · (862) 419-1763 · ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} EST
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Mechanical Enterprise" <${process.env.SMTP_USER}>`,
      to: "sales@mechanicalenterprise.com",
      subject: `${outcomeEmoji} ${appointmentType}: ${name} — ${phone}`,
      html: emailHtml
    });

    console.log("[Lead Captured & Emailed]", { name, phone, email, appointmentType, outcome });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error("[sendCallRecap error]", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send", details: err.message })
    };
  }
};
