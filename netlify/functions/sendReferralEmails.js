const nodemailer = require("nodemailer");

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(name) {
  return escapeHtml((name || "").trim().split(" ")[0]);
}

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const SALES_EMAIL = "sales@mechanicalenterprise.com";
const PHONE = "(862) 419-1763";
const PHONE_LINK = "tel:+18624191763";
const BOOKING_URL = "https://mechanicalenterprise.com/contact";

function timestamp() {
  return new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
}

function footer() {
  return `
    <div style="background: #eee; padding: 12px 24px; border-radius: 0 0 8px 8px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #999;">
        Mechanical Enterprise LLC &middot; ${PHONE} &middot; ${timestamp()} EST
      </p>
    </div>`;
}

// ── Email 1: Sales notification ──────────────────────────────────────────────

function salesHtml(d) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0a1628; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">
          &#x1F4B0; New Referral: ${escapeHtml(d.referrer_name)} &rarr; ${escapeHtml(d.new_name)}
        </h1>
        <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 14px;">
          ${escapeHtml(d.service_needed)} &middot; ${escapeHtml(d.property_type)}
        </p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #eee;">
        <p style="margin: 0 0 12px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Referrer</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px; width: 140px;">Name</td><td style="padding: 6px 0; font-weight: 600; font-size: 14px;">${escapeHtml(d.referrer_name)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Phone</td><td style="padding: 6px 0; font-size: 14px;"><a href="tel:${escapeHtml(d.referrer_phone)}" style="color: #e8813a;">${escapeHtml(d.referrer_phone)}</a></td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Email</td><td style="padding: 6px 0; font-size: 14px;"><a href="mailto:${escapeHtml(d.referrer_email)}" style="color: #e8813a;">${escapeHtml(d.referrer_email)}</a></td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Payout</td><td style="padding: 6px 0; font-size: 14px;">${escapeHtml(d.payout_method)}</td></tr>
        </table>
        <p style="margin: 0 0 12px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">New Lead</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px; width: 140px;">Name</td><td style="padding: 6px 0; font-weight: 600; font-size: 14px;">${escapeHtml(d.new_name)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Phone</td><td style="padding: 6px 0; font-size: 14px;"><a href="tel:${escapeHtml(d.new_phone)}" style="color: #e8813a;">${escapeHtml(d.new_phone)}</a></td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Email</td><td style="padding: 6px 0; font-size: 14px;">${d.new_email ? `<a href="mailto:${escapeHtml(d.new_email)}" style="color: #e8813a;">${escapeHtml(d.new_email)}</a>` : "&mdash;"}</td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Address</td><td style="padding: 6px 0; font-size: 14px;">${escapeHtml(d.new_address)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Property</td><td style="padding: 6px 0; font-size: 14px;">${escapeHtml(d.property_type)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Service</td><td style="padding: 6px 0; font-size: 14px;">${escapeHtml(d.service_needed)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666; font-size: 14px;">Notes</td><td style="padding: 6px 0; font-size: 14px;">${escapeHtml(d.notes) || "&mdash;"}</td></tr>
        </table>
        <div style="padding: 16px; background: white; border-radius: 6px; border-left: 4px solid #e8813a;">
          <p style="margin: 0 0 8px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Action Required</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6;">Contact <strong>${escapeHtml(d.new_name)}</strong> within 24 hours. When they convert, mark <code>status='converted'</code> and <code>payout_status='owed'</code> in Supabase (referral ID: ${d.id}).</p>
        </div>
        <div style="margin-top: 20px; text-align: center;">
          <a href="tel:${escapeHtml(d.new_phone)}" style="background: #e8813a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            &#x1F4DE; Call ${escapeHtml(d.new_name)} Now
          </a>
        </div>
      </div>
      ${footer()}
    </div>`;
}

// ── Email 2: Referrer confirmation ───────────────────────────────────────────

function referrerHtml(d) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0a1628; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">
          Thank you, ${firstName(d.referrer_name)}!
        </h1>
        <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 14px;">
          We got your referral.
        </p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #eee;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Here&rsquo;s what happens next:</p>
        <ol style="font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 20px;">
          <li>Our team reaches out to <strong>${escapeHtml(d.new_name)}</strong> within 24 hours.</li>
          <li>When they become a paying customer (install, repair, or assessment that converts), we send you <strong>$500</strong> via ${escapeHtml(d.payout_method)}.</li>
          <li>No cap &mdash; refer as many people as you want.</li>
        </ol>
        <p style="font-size: 14px; line-height: 1.6;">Questions? Just reply to this email or call us at <a href="${PHONE_LINK}" style="color: #e8813a; font-weight: 600;">${PHONE}</a>.</p>
      </div>
      ${footer()}
    </div>`;
}

// ── Email 3: New lead intro ──────────────────────────────────────────────────

function newLeadHtml(d) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0a1628; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">
          Hi ${firstName(d.new_name)},
        </h1>
        <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 14px;">
          Your friend ${escapeHtml(d.referrer_name)} thought we could help.
        </p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #eee;">
        <p style="font-size: 14px; line-height: 1.6;">We&rsquo;re <strong>Mechanical Enterprise</strong> &mdash; a licensed HVAC contractor in Newark, NJ, serving 15 NJ counties. ${firstName(d.referrer_name)} referred you to us for ${escapeHtml((d.service_needed || "").toLowerCase())}.</p>
        <p style="font-size: 14px; line-height: 1.6;">A few things worth knowing:</p>
        <ul style="font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 20px;">
          <li>PSE&amp;G-approved for heat pump rebates up to <strong>$16,000</strong> (residential)</li>
          <li>Up to <strong>80%</strong> rebates on commercial systems</li>
          <li>Flat $100 service calls &mdash; no hourly surprises</li>
          <li>WMBE certified, 24/7 emergency service</li>
        </ul>
        <p style="font-size: 14px; line-height: 1.6;">We&rsquo;ll reach out within 24 hours, but you can also book your appointment now &mdash; pick a time that works for you:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${BOOKING_URL}" style="background: #e8813a; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; margin-bottom: 12px;">
            Book your appointment &rarr;
          </a>
          <br/>
          <a href="${PHONE_LINK}" style="color: #e8813a; text-decoration: none; font-size: 14px; padding: 8px 16px; display: inline-block;">
            or call ${PHONE}
          </a>
        </div>
      </div>
      <div style="background: #eee; padding: 12px 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.5; text-align: center;">
          You&rsquo;re receiving this because ${escapeHtml(d.referrer_name)} submitted your contact through our referral program at mechanicalenterprise.com/referral and confirmed you&rsquo;re okay being contacted. If you&rsquo;d rather not hear from us, just reply with &ldquo;no thanks&rdquo; and we won&rsquo;t reach out again.
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: #999; text-align: center;">
          Mechanical Enterprise LLC &middot; Newark, NJ &middot; ${SALES_EMAIL}
        </p>
      </div>
    </div>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const SECRET = process.env.REFERRAL_WEBHOOK_SECRET;
  if (!SECRET) {
    console.error("REFERRAL_WEBHOOK_SECRET not configured");
    return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
  }
  if (event.headers["x-webhook-secret"] !== SECRET) {
    console.warn("Unauthorized request to sendReferralEmails");
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const d = JSON.parse(event.body);

    if (!d.referrer_name || !d.new_name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "referrer_name and new_name are required" }),
      };
    }

    const transporter = buildTransporter();
    const from = `"Mechanical Enterprise" <${process.env.SMTP_USER}>`;

    const emails = [
      // Email 1 — Sales
      transporter.sendMail({
        from,
        to: SALES_EMAIL,
        replyTo: d.referrer_email,
        subject: `\u{1F4B0} New Referral: ${d.referrer_name} \u2192 ${d.new_name} (${d.service_needed})`,
        html: salesHtml(d),
      }),
      // Email 2 — Referrer
      transporter.sendMail({
        from,
        to: d.referrer_email,
        replyTo: SALES_EMAIL,
        subject: "Thanks for the referral \u2014 we've got it from here",
        html: referrerHtml(d),
      }),
    ];

    // Email 3 — New lead (only if email provided)
    if (d.new_email && d.new_email.trim()) {
      emails.push(
        transporter.sendMail({
          from,
          to: d.new_email,
          replyTo: SALES_EMAIL,
          subject: `${d.referrer_name.trim().split(" ")[0]} thought you should know about us`,
          html: newLeadHtml(d),
        })
      );
    }

    const results = await Promise.allSettled(emails);
    const labels = ["sales", "referrer", "new_lead"];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[sendReferralEmails] ${labels[i]} failed:`, r.reason);
      } else {
        console.log(`[sendReferralEmails] ${labels[i]} sent`);
      }
    });

    const failed = results.filter((r) => r.status === "rejected").length;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: results.length - failed,
        failed,
      }),
    };
  } catch (err) {
    console.error("[sendReferralEmails error]", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send emails", details: err.message }),
    };
  }
};
