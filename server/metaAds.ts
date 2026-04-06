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
    scope: "ads_management,ads_read,business_management",
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
  // Targeting
  ageMin: number;
  ageMax: number;
  geoLocationZips?: string[];
  geoLocationCities?: Array<{ key: string; radius: number; distance_unit: string }>;
  interests?: Array<{ id: string; name: string }>;
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

  console.log("[Meta Ads] Creating campaign:", params.name, {
    objective: params.objective,
    budgetCents: params.dailyBudgetCents,
    adAccountId: params.adAccountId,
    pageId: params.pageId,
  });

  // 1. Create campaign — use LINK_CLICKS to bypass Advantage Audience requirement
  // OUTCOME_LEADS requires targeting_automation which has persistent issues;
  // LINK_CLICKS drives traffic to landing page where users fill out the form.
  const campaignBody = {
    name: params.name,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: ["NONE"],
    is_adset_budget_sharing_enabled: true,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  };
  console.log("[Meta] Step 1 — Creating campaign with:", JSON.stringify(campaignBody));
  const campaign = await metaPost(`/${actId}/campaigns`, token, campaignBody);
  const campaignId = campaign.id;
  console.log("[Meta] Step 1 — Campaign created:", campaignId);

  // 2. Build targeting — geo + age + interests
  const targeting: Record<string, unknown> = {
    geo_locations: {
      countries: ["US"],
      location_types: ["home"],
    },
  };
  const safeAgeMin = Math.max(18, Math.min(params.ageMin ?? 18, 64));
  const safeAgeMax = Math.min(65, Math.max(params.ageMax ?? 65, safeAgeMin + 1));
  targeting.age_min = safeAgeMin;
  targeting.age_max = safeAgeMax;
  if (params.geoLocationCities?.length) {
    targeting.geo_locations = {
      cities: params.geoLocationCities,
      location_types: ["home"],
    };
  } else if (params.geoLocationZips?.length) {
    targeting.geo_locations = {
      zips: params.geoLocationZips.map((z) => ({ key: z, country: "US" })),
      location_types: ["home"],
    };
  }
  if (params.interests?.length) {
    targeting.flexible_spec = [{ interests: params.interests }];
  }

  // 3. Create ad set — budget here, no targeting_automation needed for LINK_CLICKS
  const adSetBody: Record<string, unknown> = {
    name: `${params.name} — Ad Set`,
    campaign_id: campaignId,
    optimization_goal: "LINK_CLICKS",
    billing_event: "IMPRESSIONS",
    daily_budget: String(params.dailyBudgetCents),
    targeting,
    promoted_object: { page_id: params.pageId },
    destination_type: "WEBSITE",
    status: "PAUSED",
  };

  console.log("[Meta] Step 3 — Creating ad set with:", JSON.stringify(adSetBody));
  const adSet = await metaPost(`/${actId}/adsets`, token, adSetBody);
  const adSetId = adSet.id;
  console.log("[Meta] Step 3 — Ad set created:", adSetId);

  // 4. Create ad creative
  const linkData: Record<string, unknown> = {
    link: params.websiteUrl,
    message: params.primaryText,
    name: params.headline,
    description: params.description,
    call_to_action: {
      type: params.callToAction,
      value: { link: params.websiteUrl },
    },
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

  // 5. Create ad
  const adBody = {
    name: `${params.name} — Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  };
  console.log("[Meta] Step 5 — Creating ad with:", JSON.stringify(adBody));
  const ad = await metaPost(`/${actId}/ads`, token, adBody);
  console.log("[Meta] Step 5 — Ad created:", ad.id);

  return {
    campaignId,
    adSetId,
    adId: ad.id,
    status: "PAUSED",
    message: "Campaign created successfully (paused). Enable it in Meta Ads Manager when ready.",
  };
}
