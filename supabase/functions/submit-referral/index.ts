import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://mechanicalenterprise.com",
  "https://www.mechanicalenterprise.com",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendEmail(
  payload: { to: string; subject: string; html: string; replyTo?: string },
  apiKey: string,
  fromEmail: string,
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `Mechanical Enterprise <${fromEmail}>`,
      to: payload.to,
      reply_to: payload.replyTo,
      subject: payload.subject,
      html: payload.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    const {
      ref_name,
      ref_phone,
      ref_email,
      ref_payout,
      new_name,
      new_phone,
      new_email,
      new_address,
      property_type,
      service_needed,
      notes,
      consent,
    } = body;

    // Validate required fields
    const required: Record<string, string | undefined> = {
      ref_name,
      ref_phone,
      ref_email,
      ref_payout,
      new_name,
      new_phone,
      new_address,
      property_type,
      service_needed,
    };

    for (const [field, value] of Object.entries(required)) {
      if (!value?.trim()) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
    }

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Consent is required" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Self-referral check
    if (digits(ref_phone) === digits(new_phone)) {
      return new Response(
        JSON.stringify({ error: "You cannot refer yourself — phone numbers match" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }
    if (new_email && ref_email.trim().toLowerCase() === new_email.trim().toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "You cannot refer yourself — email addresses match" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Capture IP for fraud prevention
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") || null;

    // Insert into Supabase
    const { data, error: dbError } = await supabase.from("referrals").insert({
      referrer_name: ref_name.trim(),
      referrer_phone: ref_phone.trim(),
      referrer_email: ref_email.trim().toLowerCase(),
      payout_method: ref_payout,
      new_name: new_name.trim(),
      new_phone: new_phone.trim(),
      new_email: new_email?.trim().toLowerCase() || null,
      new_address: new_address.trim(),
      property_type,
      service_needed,
      notes: notes?.trim() || null,
      ip_address: ip,
    }).select("id").single();

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save referral" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Send notification emails via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SALES_EMAIL = Deno.env.get("SALES_EMAIL") || "sales@mechanicalenterprise.com";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "referrals@mechanicalenterprise.com";

    if (RESEND_API_KEY) {
      const emails: Promise<void>[] = [];

      // Email 1 — Sales notification
      emails.push(
        sendEmail({
          to: SALES_EMAIL,
          replyTo: ref_email.trim(),
          subject: `\u{1F4B0} New Referral: ${escapeHtml(ref_name.trim())} \u2192 ${escapeHtml(new_name.trim())} (${escapeHtml(service_needed)})`,
          html: `
            <h2>New Referral Submitted</h2>
            <h3>Referrer</h3>
            <ul>
              <li><strong>Name:</strong> ${escapeHtml(ref_name.trim())}</li>
              <li><strong>Phone:</strong> ${escapeHtml(ref_phone.trim())}</li>
              <li><strong>Email:</strong> ${escapeHtml(ref_email.trim())}</li>
              <li><strong>Payout method:</strong> ${escapeHtml(ref_payout)}</li>
            </ul>
            <h3>New Lead</h3>
            <ul>
              <li><strong>Name:</strong> ${escapeHtml(new_name.trim())}</li>
              <li><strong>Phone:</strong> ${escapeHtml(new_phone.trim())}</li>
              <li><strong>Email:</strong> ${escapeHtml(new_email || "\u2014")}</li>
              <li><strong>Address:</strong> ${escapeHtml(new_address.trim())}</li>
              <li><strong>Property:</strong> ${escapeHtml(property_type)}</li>
              <li><strong>Service:</strong> ${escapeHtml(service_needed)}</li>
              <li><strong>Notes:</strong> ${escapeHtml(notes || "\u2014")}</li>
            </ul>
            <p><em>Referral ID: ${data.id}</em></p>
          `,
        }, RESEND_API_KEY, FROM_EMAIL)
      );

      // Email 2 — Referrer confirmation
      emails.push(
        sendEmail({
          to: ref_email.trim(),
          replyTo: SALES_EMAIL,
          subject: "Thanks for the referral \u2014 we've got it from here",
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <div style="background:#ff6a1a;color:#0e1116;padding:24px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;font-size:24px;">Thank you, ${escapeHtml(ref_name.trim().split(" ")[0])}!</h1>
                <p style="margin:8px 0 0;font-size:15px;">We got your referral.</p>
              </div>
              <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
                <p>Here\u2019s what happens next:</p>
                <ol style="line-height:1.8;">
                  <li>Our team reaches out to <strong>${escapeHtml(new_name.trim())}</strong> within 24 hours.</li>
                  <li>When they become a paying customer (install, repair, or assessment that converts), we send you <strong>$500</strong> via ${escapeHtml(ref_payout)}.</li>
                  <li>No cap \u2014 refer as many people as you want.</li>
                </ol>
                <p style="margin-top:24px;">Questions? Just reply to this email or call us at <a href="tel:+18624191763" style="color:#ff6a1a;">(862) 419-1763</a>.</p>
                <p style="margin-top:24px;color:#666;font-size:13px;">\u2014 The Mechanical Enterprise team<br/>Newark, NJ</p>
              </div>
            </div>
          `,
        }, RESEND_API_KEY, FROM_EMAIL)
      );

      // Email 3 — New lead intro (only if they provided an email)
      if (new_email?.trim()) {
        emails.push(
          sendEmail({
            to: new_email.trim(),
            replyTo: SALES_EMAIL,
            subject: `${escapeHtml(ref_name.trim().split(" ")[0])} thought you should know about us`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <div style="background:#ff6a1a;color:#0e1116;padding:24px;border-radius:12px 12px 0 0;">
                  <h1 style="margin:0;font-size:24px;">Hi ${escapeHtml(new_name.trim().split(" ")[0])},</h1>
                  <p style="margin:8px 0 0;font-size:15px;">Your friend ${escapeHtml(ref_name.trim())} thought we could help.</p>
                </div>
                <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
                  <p>We\u2019re <strong>Mechanical Enterprise</strong> \u2014 a licensed HVAC contractor in Newark, NJ, serving 15 NJ counties. ${escapeHtml(ref_name.trim().split(" ")[0])} referred you to us for ${escapeHtml(service_needed.toLowerCase())}.</p>
                  <p>A few things worth knowing:</p>
                  <ul style="line-height:1.8;">
                    <li>PSE&amp;G-approved for heat pump rebates up to <strong>$16,000</strong> (residential)</li>
                    <li>Up to <strong>80%</strong> rebates on commercial systems</li>
                    <li>Flat $100 service calls \u2014 no hourly surprises</li>
                    <li>WMBE certified, 24/7 emergency service</li>
                  </ul>
                  <p>We\u2019ll reach out within 24 hours, but you can also book your appointment now \u2014 pick a time that works for you:</p>
                  <p style="text-align:center;margin:24px 0;">
                    <a href="https://mechanicalenterprise.com/contact" style="background:#ff6a1a;color:#0e1116;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-bottom:12px;">Book your appointment \u2192</a>
                    <br/>
                    <a href="tel:+18624191763" style="color:#ff6a1a;text-decoration:none;font-size:14px;padding:8px 16px;display:inline-block;">or call (862) 419-1763</a>
                  </p>
                  <p style="margin-top:24px;color:#666;font-size:13px;">\u2014 The Mechanical Enterprise team<br/>Newark, NJ \u00b7 <a href="https://mechanicalenterprise.com" style="color:#666;">mechanicalenterprise.com</a></p>
                  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
                  <p style="color:#999;font-size:11px;line-height:1.5;">
                    You\u2019re receiving this because ${escapeHtml(ref_name.trim())} submitted your contact through our referral program at mechanicalenterprise.com/referral and confirmed you\u2019re okay being contacted. If you\u2019d rather not hear from us, just reply with \u201cno thanks\u201d and we won\u2019t reach out again.<br/><br/>
                    Mechanical Enterprise LLC \u00b7 Newark, NJ \u00b7 sales@mechanicalenterprise.com
                  </p>
                </div>
              </div>
            `,
          }, RESEND_API_KEY, FROM_EMAIL)
        );
      }

      const results = await Promise.allSettled(emails);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`Email ${i + 1} failed:`, r.reason);
        }
      });
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
