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

// Do NOT add pages_show_list here until it is enabled for the ME Ads Manager app (App Review > Permissions and features):
// requesting a permission the app lacks makes Facebook show "It looks like this app isn't available" (Oct 31).
const ADS_SCOPES = "ads_management,ads_read,business_management,leads_retrieval,pages_manage_metadata,pages_read_engagement,pages_manage_ads";

// Social Lane "Connect" (docs/social-lane-spec.md, owner build instruction #5)
// reuses this SAME OAuth app/dialog with the scopes it actually needs to
// publish organic posts (pages_manage_posts) and read/publish to the linked
// Instagram Business account (instagram_basic, instagram_content_publish),
// rather than the ads-management scopes above.
export const SOCIAL_SCOPES = "pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish";

export function getMetaAuthUrl(redirectUri: string, scope: string = ADS_SCOPES): string {
  if (!APP_ID) throw new Error("META_APP_ID environment variable is not set.");
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    scope,
    response_type: "code",
    state: Buffer.from(redirectUri).toString("base64"),
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

/** The Instagram Business account linked to a Facebook Page, if any (for the Social Lane connect flow). */
export async function getInstagramBusinessAccountId(pageToken: string, pageId: string): Promise<string | null> {
  const json = await metaGet(`/${pageId}`, pageToken, { fields: "instagram_business_account" });
  return json.instagram_business_account?.id ?? null;
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

// Exchange a long-lived user token for a Page Access Token.
// Page tokens derived from long-lived user tokens never expire and have
// page-level permissions (pages_manage_ads) built in.
export async function getPageAccessToken(
  userToken: string,
  pageId: string
): Promise<string> {
  const res = await fetch(
    `${META_BASE}/${pageId}?fields=access_token&access_token=${userToken}`
  );
  const json = await res.json();
  if (json.error) {
    throw new Error(`Failed to get Page Access Token: ${json.error.message}`);
  }
  if (!json.access_token) {
    throw new Error("Page Access Token not returned — make sure the user has admin access to the page.");
  }
  console.log("[Meta] Got Page Access Token for page:", pageId);
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
  // Safety stop: the existing template's ad set targets countries: ["US"],
  // NOT Mechanical Enterprise's NJ/NY service area. Never create a broad
  // national campaign (even paused) until real Meta geo IDs are resolved and
  // the exact targeting is reviewed. This check precedes ALL Meta writes.
  const localTargetingVerified = false;
  if (!localTargetingVerified) {
    throw new Error(
      "Meta campaign creation is paused: this template targets the entire US. Verify account access, configure and review NJ/NY service-area targeting, CRM instant-form lead delivery, and combined ad budgets before creating campaigns."
    );
  }
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
  //    No budget, no billing_event, no bid fields — campaign CBO handles all of that.
  //    Status ACTIVE so it runs when the campaign is enabled.
  const adSetBody: Record<string, unknown> = {
    name: `${params.name} — Ad Set`,
    campaign_id: campaignId,
    optimization_goal: "LEAD_GENERATION",
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

// ─── Social Lane boost hand-off (docs/social-lane-spec.md §5) ────────────────
// Boosting an ALREADY-PUBLISHED organic post ("boost this post") is a
// different Graph API shape than createLeadCampaign above (which creates a
// campaign from scratch with a lead form): it needs an ad creative built
// from `object_story_id` pointing at the existing page post, plus a
// campaign/ad set/ad chain around it. Real credentials for this are not
// present anywhere in this codebase today (aiVaCredentials has zero
// "facebook"/"meta_ads" rows in production — see the social-lane pre-flight),
// and getting the real call chain right without a live account to verify
// against risks silently misconfiguring real ad spend. So this is
// deliberately left unimplemented in "real" mode — RealSocialPlatformClient
// only ever reaches this when SOCIAL_LANE_ENABLED=true AND a real Meta
// credential is active, and it fails loudly rather than guessing. The
// hold→veto→publish→revert round-trip and the boost *candidate flagging* in
// the report are fully built and tested against the mock client
// (server/services/social/platformClient.ts, ads.ts).
export interface BoostPostParams {
  platform: "facebook" | "instagram" | "google_business";
  postId: string;
  dailyBudgetCents: number;
  objective: "leads" | "traffic";
  targetCounties: string[];
  destinationUrl: string;
}

export async function boostPost(_params: BoostPostParams): Promise<{ externalCampaignId: string; spendCents: number }> {
  throw new Error(
    "Real Meta ad-boost execution is not implemented (docs/social-lane-spec.md §5). " +
      "SOCIAL_BOOST_ENABLED should stay false, or boost calls should go through the mock platform client, until this is built against a live ad account.",
  );
}

/* ── New Jersey website-traffic campaign (owner, Oct 31, 2026) ───────────────────────────────
 * The instant-form builder above stays disabled (US-wide targeting, CRM delivery unverified). This one
 * sends people to a mechanicalenterprise.com landing page, so leads arrive through the site's own lead
 * form (TCPA + CRM capture already verified). Targeting is the New Jersey region, optionally narrowed to
 * people matching ANY of the given interests / job titles (Oct 31: property managers for maintenance
 * contracts). Optimizes for link clicks; the site's pixel (904145668726251) went live Oct 31, so a later
 * campaign can switch to lead optimization once Lead events accumulate.
 * Created PAUSED; the caller enables it after review. */
export interface NjTrafficCampaignParams {
  adAccountId: string;
  pageId: string;
  name: string;
  dailyBudgetCents: number;
  landingUrl: string;
  imageUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  ageMin?: number;
  ageMax?: number;
  /** Detailed targeting from searchMetaTargeting; a person matching ANY entry qualifies. */
  interests?: TargetingEntry[];
  workPositions?: TargetingEntry[];
}

export type TargetingEntry = { id: string; name: string };

/** Look up detailed-targeting options (interests or job titles) by keyword. */
export async function searchMetaTargeting(token: string, type: "adinterest" | "adworkposition", q: string) {
  const json = await metaGet("/search", token, { type, q, limit: "25" });
  return ((json.data ?? []) as Array<{ id: string; name: string; audience_size_lower_bound?: number; audience_size_upper_bound?: number; path?: string[] }>).map((d) => ({
    id: String(d.id), name: d.name, audienceLower: d.audience_size_lower_bound ?? null, audienceUpper: d.audience_size_upper_bound ?? null, path: d.path ?? [],
  }));
}

/** Meta's region key for New Jersey, looked up live rather than hard-coded. */
export async function findNewJerseyRegionKey(token: string): Promise<string> {
  const json = await metaGet("/search", token, { type: "adgeolocation", location_types: JSON.stringify(["region"]), q: "New Jersey", country_code: "US" });
  const hit = (json.data ?? []).find((d: { name?: string; country_code?: string; type?: string }) => d.name === "New Jersey" && d.country_code === "US" && d.type === "region");
  if (!hit?.key) throw new Error("Could not find Meta's region key for New Jersey.");
  return String(hit.key);
}

export async function createNjTrafficCampaign(token: string, p: NjTrafficCampaignParams) {
  const landing = new URL(p.landingUrl);
  if (landing.protocol !== "https:" || !/(^|\.)mechanicalenterprise\.com$/.test(landing.hostname)) throw new Error("Landing URL must be https://mechanicalenterprise.com/…");
  if (p.dailyBudgetCents < 100 || p.dailyBudgetCents > 5000) throw new Error("Daily budget must be $1-$50.");
  const actId = `act_${p.adAccountId}`;
  const region = await findNewJerseyRegionKey(token);

  const campaign = await metaPost(`/${actId}/campaigns`, token, {
    name: p.name,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  });
  const adSet = await metaPost(`/${actId}/adsets`, token, {
    name: `${p.name} — NJ ${p.ageMin ?? 30}-${p.ageMax ?? 65}`,
    campaign_id: campaign.id,
    daily_budget: String(p.dailyBudgetCents),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "WEBSITE",
    targeting: {
      geo_locations: { regions: [{ key: region }], location_types: ["home"] },
      age_min: p.ageMin ?? 30,
      age_max: p.ageMax ?? 65,
      ...((p.interests?.length || p.workPositions?.length)
        ? { flexible_spec: [{ ...(p.interests?.length ? { interests: p.interests } : {}), ...(p.workPositions?.length ? { work_positions: p.workPositions } : {}) }] }
        : {}),
      targeting_automation: { advantage_audience: 0 },
    },
    status: "ACTIVE",
  });
  const creative = await metaPost(`/${actId}/adcreatives`, token, {
    name: `${p.name} — Creative`,
    object_story_spec: {
      page_id: p.pageId,
      link_data: {
        link: p.landingUrl,
        message: p.primaryText,
        name: p.headline,
        description: p.description,
        picture: p.imageUrl,
        call_to_action: { type: "LEARN_MORE", value: { link: p.landingUrl } },
      },
    },
  });
  const ad = await metaPost(`/${actId}/ads`, token, {
    name: `${p.name} — Ad`,
    adset_id: adSet.id,
    creative: { creative_id: creative.id },
    status: "ACTIVE",
  });
  return { campaignId: String(campaign.id), adSetId: String(adSet.id), creativeId: String(creative.id), adId: String(ad.id), regionKey: region, status: "PAUSED" as const };
}

/** Enable or pause a campaign by id. */
export async function setMetaCampaignStatus(token: string, campaignId: string, status: "ACTIVE" | "PAUSED") {
  await metaPost(`/${campaignId}`, token, { status });
  const now = await metaGet(`/${campaignId}`, token, { fields: "name,status,effective_status" });
  return { campaignId, name: now.name, status: now.status, effectiveStatus: now.effective_status };
}

/**
 * The ad account's Meta pixel (dataset). Returns the existing ones; when `createIfMissing` and the account
 * has none, creates one named `name`. The id goes into the site build as VITE_META_PIXEL_ID.
 */
export async function getOrCreateAdAccountPixel(token: string, adAccountId: string, opts: { createIfMissing: boolean; name: string }) {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const list = async () => {
    const r = await metaGet(`/${act}/adspixels`, token, { fields: "id,name,last_fired_time,creation_time" });
    return ((r.data ?? []) as Array<{ id: string; name: string; last_fired_time?: string; creation_time?: string }>).map((p) => ({
      id: String(p.id), name: p.name, lastFiredTime: p.last_fired_time ?? null, creationTime: p.creation_time ?? null,
    }));
  };
  const existing = await list();
  if (existing.length || !opts.createIfMissing) return { pixels: existing, created: false };
  await metaPost(`/${act}/adspixels`, token, { name: opts.name });
  return { pixels: await list(), created: true };
}
