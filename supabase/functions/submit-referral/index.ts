import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    const required = [
      "referrer_name",
      "referrer_phone",
      "referrer_email",
      "payment_method",
      "lead_name",
      "lead_phone",
      "property_address",
      "property_type",
      "service_needed",
    ];

    for (const field of required) {
      if (!body[field]?.trim()) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data, error } = await supabase.from("referrals").insert({
      referrer_name: body.referrer_name.trim(),
      referrer_phone: body.referrer_phone.trim(),
      referrer_email: body.referrer_email.trim().toLowerCase(),
      payment_method: body.payment_method,
      lead_name: body.lead_name.trim(),
      lead_phone: body.lead_phone.trim(),
      lead_email: body.lead_email?.trim().toLowerCase() || null,
      property_address: body.property_address.trim(),
      property_type: body.property_type,
      service_needed: body.service_needed,
      notes: body.notes?.trim() || null,
      status: "pending",
    }).select().single();

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save referral" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
