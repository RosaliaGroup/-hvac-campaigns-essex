import { GoogleAdsApi, enums } from "google-ads-api";
import { getAiVaCredentials } from "./db";

// Env-var defaults (Railway / .env)
// Accept both GOOGLE_CLIENT_ID and GOOGLE_ADS_CLIENT_ID naming conventions
const ENV_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
const ENV_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || "";
const ENV_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || "";
const ENV_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID ?? "";

// Canonical redirect URI — MUST match exactly what's registered in Google Cloud Console.
// Set GOOGLE_ADS_REDIRECT_URI in your environment to the production value.
const ENV_REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI ?? "";

// Resolve credentials: DB (google_ads_config) first, env vars as fallback
async function getConfig() {
  const dbCreds = await getAiVaCredentials("google_ads_config");
  return {
    clientId: dbCreds.clientId || ENV_CLIENT_ID,
    clientSecret: dbCreds.clientSecret || ENV_CLIENT_SECRET,
    developerToken: dbCreds.developerToken || ENV_DEVELOPER_TOKEN,
    customerId: (dbCreds.customerId || ENV_CUSTOMER_ID).replace(/-/g, ""),
  };
}

// Resolve the redirect URI: env var > DB > client-provided fallback
async function getRedirectUri(clientHint?: string): Promise<string> {
  if (ENV_REDIRECT_URI) return ENV_REDIRECT_URI;
  const dbCreds = await getAiVaCredentials("google_ads_config");
  if (dbCreds.redirectUri) return dbCreds.redirectUri;
  return clientHint || "https://mechanicalenterprise.com/api/oauth/google-ads/callback";
}

// Build OAuth URL for user to authorize
export async function getGoogleAdsAuthUrl(clientRedirectHint?: string): Promise<string> {
  const config = await getConfig();
  if (!config.clientId) {
    throw new Error(
      "Google OAuth client_id is not configured. Set GOOGLE_CLIENT_ID in your environment variables or enter it in AI VA Settings → Google Ads tab."
    );
  }
  const redirectUri = await getRedirectUri(clientRedirectHint);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    // Encode the redirect URI in state so the callback can recover it for token exchange
    state: Buffer.from(redirectUri).toString("base64"),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange auth code for refresh token
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ refresh_token: string; access_token: string }> {
  const config = await getConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Google OAuth credentials missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables or in AI VA Settings → Google Ads tab."
    );
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

// Create Google Ads API client with refresh token
async function getClient(refreshToken: string) {
  const config = await getConfig();
  return new GoogleAdsApi({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    developer_token: config.developerToken,
  }).Customer({
    customer_id: config.customerId,
    refresh_token: refreshToken,
  });
}

// Get campaign performance metrics
export async function getCampaignPerformance(refreshToken: string) {
  const customer = await getClient(refreshToken);
  const campaigns = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `);
  return campaigns.map((row: any) => ({
    id: String(row.campaign.id),
    name: row.campaign.name,
    status: row.campaign.status,
    channelType: row.campaign.advertising_channel_type,
    impressions: Number(row.metrics.impressions || 0),
    clicks: Number(row.metrics.clicks || 0),
    costMicros: Number(row.metrics.cost_micros || 0),
    cost: Number(row.metrics.cost_micros || 0) / 1_000_000,
    conversions: Number(row.metrics.conversions || 0),
    ctr: Number(row.metrics.ctr || 0),
    avgCpc: Number(row.metrics.average_cpc || 0) / 1_000_000,
    costPerConversion: Number(row.metrics.cost_per_conversion || 0) / 1_000_000,
  }));
}

// Get account-level summary
export async function getAccountSummary(refreshToken: string) {
  const customer = await getClient(refreshToken);
  const rows = await customer.query(`
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM customer
    WHERE segments.date DURING LAST_30_DAYS
  `);
  if (!rows.length) return null;
  const m = rows[0].metrics as any;
  return {
    impressions: Number(m.impressions || 0),
    clicks: Number(m.clicks || 0),
    cost: Number(m.cost_micros || 0) / 1_000_000,
    conversions: Number(m.conversions || 0),
    ctr: Number(m.ctr || 0),
    avgCpc: Number(m.average_cpc || 0) / 1_000_000,
  };
}

// Parse keyword text and determine match type
// Supports: [exact match], "phrase match", plain broad match
function parseKeyword(kw: string): { text: string; matchType: number } {
  const trimmed = kw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return {
      text: trimmed.slice(1, -1),
      matchType: enums.KeywordMatchType.EXACT,
    };
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return {
      text: trimmed.slice(1, -1),
      matchType: enums.KeywordMatchType.PHRASE,
    };
  }
  return {
    text: trimmed,
    matchType: enums.KeywordMatchType.BROAD,
  };
}

// Create a new search campaign with full keyword match type support
export async function createSearchCampaign(
  refreshToken: string,
  params: {
    name: string;
    dailyBudgetMicros: number;
    keywords: string[];
    negativeKeywords?: string[];
    headlines: string[];
    descriptions: string[];
    finalUrl: string;
    geoTargetNames: string[];
    // Essex County NJ geo target constant ID: 1023191
    geoTargetIds?: number[];
  }
) {
  const customer = await getClient(refreshToken);

  // 1. Create budget
  const budgetRes = await customer.campaignBudgets.create([
    {
      name: `${params.name} Budget`,
      amount_micros: params.dailyBudgetMicros,
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
    },
  ]);
  const budgetResourceName = (budgetRes as any).results?.[0]?.resource_name ?? (budgetRes as any)[0]?.resource_name;

  // 2. Create campaign
  const campaignRes = await customer.campaigns.create([
    {
      name: params.name,
      status: enums.CampaignStatus.PAUSED,
      advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
      campaign_budget: budgetResourceName,
      bidding_strategy_type: enums.BiddingStrategyType.MAXIMIZE_CONVERSIONS,
      network_settings: {
        target_google_search: true,
        target_search_network: false,
        target_content_network: false,
      },
    },
  ]);
  const campaignResourceName = (campaignRes as any).results?.[0]?.resource_name ?? (campaignRes as any)[0]?.resource_name;
  const campaignId = (campaignRes as any).results?.[0]?.id ?? (campaignRes as any)[0]?.id;

  // 3. Add geo targeting (Essex County NJ = location ID 1023191)
  const geoIds = params.geoTargetIds ?? [1023191]; // Default: Essex County NJ
  try {
    await customer.campaignCriteria.create(
      geoIds.map((locationId) => ({
        campaign: campaignResourceName,
        type: enums.CriterionType.LOCATION,
        location: {
          geo_target_constant: `geoTargetConstants/${locationId}`,
        },
      }))
    );
  } catch (geoErr) {
    // Geo targeting is non-fatal — campaign still works without it
    console.warn("Geo targeting failed (non-fatal):", geoErr);
  }

  // 4. Create ad group
  const adGroupRes = await customer.adGroups.create([
    {
      name: `${params.name} - Ad Group 1`,
      campaign: campaignResourceName,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  ]);
  const adGroupResourceName = (adGroupRes as any).results?.[0]?.resource_name ?? (adGroupRes as any)[0]?.resource_name;

  // 5. Create keywords with proper match types
  const parsedKeywords = params.keywords.slice(0, 20).map(parseKeyword);
  await customer.adGroupCriteria.create(
    parsedKeywords.map(({ text, matchType }) => ({
      ad_group: adGroupResourceName,
      status: enums.AdGroupCriterionStatus.ENABLED,
      keyword: {
        text,
        match_type: matchType,
      },
    }))
  );

  // 6. Add negative keywords at campaign level
  if (params.negativeKeywords && params.negativeKeywords.length > 0) {
    try {
      await customer.campaignCriteria.create(
        params.negativeKeywords.slice(0, 20).map((kw) => ({
          campaign: campaignResourceName,
          negative: true,
          keyword: {
            text: kw.replace(/^-/, "").trim(),
            match_type: enums.KeywordMatchType.BROAD,
          },
        }))
      );
    } catch (negErr) {
      console.warn("Negative keywords failed (non-fatal):", negErr);
    }
  }

  // 7. Create responsive search ad
  await customer.adGroupAds.create([
    {
      ad_group: adGroupResourceName,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [params.finalUrl],
        responsive_search_ad: {
          headlines: params.headlines.slice(0, 15).map((text) => ({ text })),
          descriptions: params.descriptions.slice(0, 4).map((text) => ({ text })),
        },
      },
    },
  ]);

  return {
    campaignId: String(campaignId),
    campaignResourceName: String(campaignResourceName),
    status: "PAUSED",
    message: "Campaign created successfully (paused). Enable it in Google Ads when ready.",
  };
}

// Validate credentials by fetching accessible customers
export async function validateCredentials(refreshToken: string): Promise<boolean> {
  try {
    const customer = await getClient(refreshToken);
    await customer.query(`SELECT customer.id FROM customer LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}
