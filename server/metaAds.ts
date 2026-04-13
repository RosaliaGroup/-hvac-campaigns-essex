/**
 * Meta (Facebook) Marketing API service
 * Uses the Meta Marketing API v25.0 via direct REST calls (no SDK needed)
 * Credentials: access token (long-lived page/system user token) + ad account ID
 */

const META_API_VERSION = "v25.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const APP_ID = process.env.META_APP_ID ?? "";
const APP_SECRET = process.env.META_APP_SECRET ?? "";

// ─── helpers ────────────────────────────────────────────────────────────────

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${META_BASE}${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${json.error.message} (code ${json.error.code})`);
  return json;
}

/**
 * POST to Meta Marketing API using form-urlencoded format.
 * Nested objects/arrays are JSON-stringified as required by the API.
 */
async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  const formData = new URLSearchParams();
  formData.set("access_token", token);

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      formData.set(key, value ? "true" : "false");
    } else if (typeof value === "object") {
      formData.set(key, JSON.stringify(value));
    } else {
      formData.set(key, String(value));
    }
  }

  const url = `${META_BASE}${path}`;

  // Detailed debug logging — show every param being sent
  const debugBody: Record<string, string> = {};
  formData.forEach((v, k) => {
    debugBody[k] = k === "access_token" ? `TOKEN(${v.length} chars)` : v;
  });
  console.log("[Meta API DEBUG] Endpoint:", url);
  console.log("[Meta API DEBUG] Body params:", JSON.stringify(debugBody, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const json = await res.json();
  if (json.error) {
    console.error("[Meta API ERROR] Full response:", JSON.stringify(json, null, 2));
    const subcode = json.error.error_subcode ? ` subcode=${json.error.error_subcode}` : "";
    const blame = json.error.error_user_title || json.error.error_user_msg || "";
    throw new Error(`Meta API error: ${json.error.message} (code ${json.error.code}${subcode}) ${blame}`);
  }
  console.log("[Meta API SUCCESS]", path, "→", JSON.stringify(json));
  return json;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getMetaAuthUrl(redirectUri: string): string {
  if (!APP_ID) throw new Error("META_APP_ID environment variable is not set.");
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    scope: "ads_management,ads_read,business_management,leads_retrieval,pages_manage_metadata,pages_read_engagement",
    response_type: "code",
    state: Buffer.from(redirectUri).toString("base64"),
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string }> {
  if (!APP_ID || !APP_SECRET) throw new Error("META_APP_ID and META_APP_SECRET must be set.");
  const params = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
  const json = await res.json();
  if (json.error) throw new Error(`Token exchange failed: ${json.error.message}`);
  return json;
}

export async function getLongLivedToken(shortToken: string): Promise<string> {
  if (!APP_ID || !APP_SECRET) throw new Error("META_APP_ID and META_APP_SECRET must be set.");
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
  const json = await res.json();
  if (json.error) throw new Error(`Long-lived token exchange failed: ${json.error.message}`);
  return json.access_token;
}

// ─── Account info ─────────────────────────────────────────────────────────────

export async function getAdAccounts(token: string) {
  const data = await metaGet("/me/adaccounts", token, {
    fields: "id,name,account_status,currency,timezone_name",
  });
  return data.data ?? [];
}

// ─── Test / Debug ────────────────────────────────────────────────────────────

export async function testAdAccount(token: string, adAccountId: string) {
  console.log("[Meta Test] Testing token + ad account:", adAccountId);
  const data = await metaGet(`/act_${adAccountId}`, token, {
    fields: "id,name,account_status,currency,timezone_name,owner",
  });
  console.log("[Meta Test] Result:", JSON.stringify(data, null, 2));
  return data;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export async function getCampaignPerformance(token: string, adAccountId: string) {
  const data = await metaGet(`/act_${adAccountId}/campaigns`, token, {
    fields: "id,name,status,objective,daily_budget,insights.date_preset(last_30d){impressions,clicks,spend,actions,cpc,ctr}",
    limit: "50",
  });

  return (data.data ?? []).map((c: any) => {
    const ins = c.insights?.data?.[0] ?? {};
    const conversions = (ins.actions ?? []).find((a: any) =>
      ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"].includes(a.action_type)
    );
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      impressions: Number(ins.impressions ?? 0),
      clicks: Number(ins.clicks ?? 0),
      spend: Number(ins.spend ?? 0),
      ctr: Number(ins.ctr ?? 0),
      cpc: Number(ins.cpc ?? 0),
      conversions: conversions ? Number(conversions.value) : 0,
    };
  });
}

// ─── Campaign creation ────────────────────────────────────────────────────────

export interface MetaCampaignParams {
  name: string;
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS";
  dailyBudgetCents: number; // in cents (USD * 100)
  adAccountId: string;
  pageId: string;
  // Ad creative
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
  websiteUrl: string;
  imageUrl?: string;
}

export async function createLeadCampaign(token: string, params: MetaCampaignParams) {
  const actId = `act_${params.adAccountId}`;

  console.log("[Meta Ads] Creating OUTCOME_LEADS campaign:", params.name, {
    budgetCents: params.dailyBudgetCents,
    adAccountId: params.adAccountId,
    pageId: params.pageId,
  });

  // 1. Create campaign — OUTCOME_LEADS with Campaign Budget Optimization (CBO)
  //    Budget lives on the campaign, not ad sets. Campaign starts PAUSED so
  //    the user enables it in Ads Manager when ready. Ad sets and ads are ACTIVE
  //    so they run immediately once the campaign is turned on.
  const campaignBody = {
    name: params.name,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: ["NONE"],
    daily_budget: String(params.dailyBudgetCents),
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  };
  console.log("[Meta] Step 1 — Creating campaign with:", JSON.stringify(campaignBody));
  const campaign = await metaPost(`/${actId}/campaigns`, token, campaignBody);
  const campaignId = campaign.id;
  console.log("[Meta] Step 1 — Campaign created:", campaignId);

  // 2. Create instant lead form on the Page
  const leadFormBody = {
    name: `${params.name} — Lead Form`,
    questions: [
      { type: "FULL_NAME" },
      { type: "EMAIL" },
      { type: "PHONE" },
    ],
    privacy_policy: { url: `${params.websiteUrl.replace(/\/+$/, "")}/privacy` },
    thank_you_page: {
      title: "Thank You!",
      body: "A Mechanical Enterprise team member will contact you within 1 business day to schedule your free assessment.",
      button_type: "VIEW_WEBSITE",
      button_text: "Visit Our Website",
      website_url: params.websiteUrl,
    },
    follow_up_action_url: params.websiteUrl,
  };
  console.log("[Meta] Step 2 — Creating lead form on page:", params.pageId);
  const leadForm = await metaPost(`/${params.pageId}/leadgen_forms`, token, leadFormBody);
  const leadFormId = leadForm.id;
  console.log("[Meta] Step 2 — Lead form created:", leadFormId);

  // 3. Create ad set — LEAD_GENERATION optimisation with instant form
  //    No budget here — CBO on the campaign controls spend.
  //    Status ACTIVE so it runs when the campaign is enabled.
  const adSetBody: Record<string, unknown> = {
    name: `${params.name} — Ad Set`,
    campaign_id: campaignId,
    optimization_goal: "LEAD_GENERATION",
    billing_event: "IMPRESSIONS",
    targeting: { geo_locations: { countries: ["US"] } },
    promoted_object: { page_id: params.pageId },
    destination_type: "ON_AD",
    status: "ACTIVE",
  };

  console.log("[Meta] Step 3 — Creating ad set with:", JSON.stringify(adSetBody));
  const adSet = await metaPost(`/${actId}/adsets`, token, adSetBody);
  const adSetId = adSet.id;
  console.log("[Meta] Step 3 — Ad set created:", adSetId);

  // 4. Create ad creative — lead gen ad with instant form
  //    link_data.message = post body text (shown above the ad card)
  //    link_data.name = headline (bold text in the ad card)
  //    link_data.description = link description (below headline)
  //    link_data.call_to_action = CTA button that opens the lead form
  const linkData: Record<string, unknown> = {
    message: params.primaryText,
    link: params.websiteUrl,
    name: params.headline,
    description: params.description,
    call_to_action: {
      type: "SIGN_UP",
      value: {
        lead_gen_form_id: leadFormId,
      },
    },
    lead_gen_form_id: leadFormId,
  };
  if (params.imageUrl) {
    linkData.picture = params.imageUrl;
  }

  const creativeBody = {
    name: `${params.name} — Creative`,
    object_story_spec: {
      page_id: params.pageId,
      link_data: linkData,
    },
  };
  console.log("[Meta] Step 4 — Creating ad creative with:", JSON.stringify(creativeBody));
  const creative = await metaPost(`/${actId}/adcreatives`, token, creativeBody);
  const creativeId = creative.id;
  console.log("[Meta] Step 4 — Creative created:", creativeId);

  // 5. Create ad — ACTIVE so it runs when campaign is enabled
  const adBody = {
    name: `${params.name} — Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "ACTIVE",
  };
  console.log("[Meta] Step 5 — Creating ad with:", JSON.stringify(adBody));
  const ad = await metaPost(`/${actId}/ads`, token, adBody);
  console.log("[Meta] Step 5 — Ad created:", ad.id);

  return {
    campaignId,
    adSetId,
    leadFormId,
    adId: ad.id,
    status: "PAUSED",
    message: "Lead generation campaign created (paused). Uses an instant lead form — name, email, phone collected on-platform. Enable in Ads Manager when ready.",
  };
}
