/**
 * Meta (Facebook) Marketing API service
 * Uses the Meta Marketing API v21.0 via direct REST calls (no SDK needed)
 * Credentials: access token (long-lived page/system user token) + ad account ID
 */

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;

// ─── helpers ────────────────────────────────────────────────────────────────

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${META_BASE}${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${json.error.message} (code ${json.error.code})`);
  return json;
}

async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${META_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${json.error.message} (code ${json.error.code})`);
  return json;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getMetaAuthUrl(redirectUri: string): string {
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

  // 1. Create campaign
  const campaign = await metaPost(`/${actId}/campaigns`, token, {
    name: params.name,
    objective: params.objective,
    status: "PAUSED",
    special_ad_categories: [],
  });
  const campaignId = campaign.id;

  // 2. Build targeting spec
  const targeting: Record<string, unknown> = {
    age_min: params.ageMin,
    age_max: params.ageMax,
    geo_locations: params.geoLocationZips?.length
      ? {
          zips: params.geoLocationZips.map((z) => ({ key: z, country: "US" })),
        }
      : {
          cities: params.geoLocationCities ?? [
            // Default: Essex County NJ cities
            { key: "2418779", radius: 25, distance_unit: "mile" }, // Newark NJ
          ],
        },
  };
  if (params.interests?.length) {
    targeting.flexible_spec = [{ interests: params.interests }];
  }

  // 3. Create ad set
  const adSet = await metaPost(`/${actId}/adsets`, token, {
    name: `${params.name} — Ad Set`,
    campaign_id: campaignId,
    optimization_goal: params.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "LINK_CLICKS",
    billing_event: "IMPRESSIONS",
    daily_budget: params.dailyBudgetCents,
    targeting,
    status: "PAUSED",
    start_time: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  });
  const adSetId = adSet.id;

  // 4. Create ad creative
  const creative = await metaPost(`/${actId}/adcreatives`, token, {
    name: `${params.name} — Creative`,
    object_story_spec: {
      page_id: params.pageId,
      link_data: {
        link: params.websiteUrl,
        message: params.primaryText,
        name: params.headline,
        description: params.description,
        call_to_action: {
          type: params.callToAction,
          value: { link: params.websiteUrl },
        },
        ...(params.imageUrl ? { picture: params.imageUrl } : {}),
      },
    },
  });
  const creativeId = creative.id;

  // 5. Create ad
  const ad = await metaPost(`/${actId}/ads`, token, {
    name: `${params.name} — Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });

  return {
    campaignId,
    adSetId,
    adId: ad.id,
    status: "PAUSED",
    message: "Campaign created successfully (paused). Enable it in Meta Ads Manager when ready.",
  };
}
