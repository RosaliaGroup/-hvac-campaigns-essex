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

    // Validate required fields (simplified — only name + phone for both parties)
    const required: Record<string, string | undefined> = {
      ref_name,
      ref_phone,
      new_name,
      new_phone,
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
    // Note: referrer_email, payout_method, new_address, property_type, service_needed are NOT NULL in DB
    const { data, error: dbError } = await supabase.from("referrals").insert({
      referrer_name: ref_name.trim(),
      referrer_phone: ref_phone.trim(),
      referrer_email: ref_email?.trim().toLowerCase() || "",
      payout_method: ref_payout || "Zelle",
      new_name: new_name.trim(),
      new_phone: new_phone.trim(),
      new_email: new_email?.trim().toLowerCase() || null,
      new_address: new_address?.trim() || "Not provided",
      property_type: property_type || "Residential",
      service_needed: service_needed || "Not specified",
      notes: notes?.trim() || null,
      ip_address: ip,
    }).select().single();

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save referral" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Fire emails via Netlify function (non-fatal — row is already saved)
    try {
      await fetch("https://mechanicalenterprise.com/.netlify/functions/sendReferralEmails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": Deno.env.get("REFERRAL_WEBHOOK_SECRET") ?? "",
        },
        body: JSON.stringify(data),
      });
    } catch (emailErr) {
      console.error("Email dispatch failed:", emailErr);
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
