import { GoogleAdsApi, enums } from "google-ads-api";

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID!;

// Build OAuth URL for user to authorize
export function getGoogleAdsAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange auth code for refresh token
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ refresh_token: string; access_token: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
function getClient(refreshToken: string) {
  return new GoogleAdsApi({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    developer_token: DEVELOPER_TOKEN,
  }).Customer({
    customer_id: CUSTOMER_ID,
    refresh_token: refreshToken,
  });
}

// Get campaign performance metrics
export async function getCampaignPerformance(refreshToken: string) {
  const customer = getClient(refreshToken);
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
  const customer = getClient(refreshToken);
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

// Create a new search campaign
export async function createSearchCampaign(
  refreshToken: string,
  params: {
    name: string;
    dailyBudgetMicros: number;
    keywords: string[];
    headlines: string[];
    descriptions: string[];
    finalUrl: string;
    geoTargetNames: string[];
  }
) {
  const customer = getClient(refreshToken);

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
        target_search_network: true,
        target_content_network: false,
      },
    },
  ]);
  const campaignResourceName = (campaignRes as any).results?.[0]?.resource_name ?? (campaignRes as any)[0]?.resource_name;
  const campaignId = (campaignRes as any).results?.[0]?.id ?? (campaignRes as any)[0]?.id;

  // 3. Create ad group
  const adGroupRes = await customer.adGroups.create([
    {
      name: `${params.name} - Ad Group 1`,
      campaign: campaignResourceName,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  ]);
  const adGroupResourceName = (adGroupRes as any).results?.[0]?.resource_name ?? (adGroupRes as any)[0]?.resource_name;

  // 4. Create keywords
  await customer.adGroupCriteria.create(
    params.keywords.slice(0, 20).map((kw) => ({
      ad_group: adGroupResourceName,
      status: enums.AdGroupCriterionStatus.ENABLED,
      keyword: {
        text: kw,
        match_type: enums.KeywordMatchType.BROAD,
      },
    }))
  );

  // 5. Create responsive search ad
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
    message: "Campaign created successfully (paused for review). Enable it in Google Ads when ready.",
  };
}

// Validate credentials by fetching accessible customers
export async function validateCredentials(refreshToken: string): Promise<boolean> {
  try {
    const customer = getClient(refreshToken);
    await customer.query(`SELECT customer.id FROM customer LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}
