/**
 * Admin "operator" access to the live Google Ads account: read the full setup (budgets, bidding, ad
 * groups, ads with approval status and landing pages, geo targets) and make a small set of targeted
 * edits — daily budget, campaign status, ad landing page. Added Oct 30, 2026 so account changes are
 * exact, scripted and logged instead of clicked through the Ads UI.
 *
 * Every mutation returns what it changed (before -> after) so the caller can log it. Nothing here
 * creates spend on its own: budgets are set explicitly by an admin, campaigns are only enabled when
 * asked.
 */
import { enums } from "google-ads-api";
import { getAdsCustomer } from "./googleAds";

export type AdsInventoryAd = {
  resourceName: string;
  adId: string;
  status: string;
  approval: string;
  finalUrls: string[];
  headlines: string[];
};
export type AdsInventoryAdGroup = { id: string; name: string; status: string; ads: AdsInventoryAd[]; keywords: string[] };
export type AdsInventoryCampaign = {
  id: string;
  name: string;
  status: string;
  servingStatus: string;
  primaryStatus: string;
  primaryStatusReasons: string[];
  channelType: string;
  bidding: string;
  budgetResourceName: string | null;
  dailyBudget: number | null;
  budgetShared: boolean;
  locations: string[];
  adGroups: AdsInventoryAdGroup[];
  last30: { impressions: number; clicks: number; cost: number; conversions: number };
};

const enumName = (e: Record<string, unknown>, v: unknown): string => {
  if (typeof v === "string") return v;
  const hit = Object.entries(e).find(([, val]) => val === v);
  return hit ? hit[0] : String(v);
};

/** Full read of every non-removed campaign. Read-only. */
export async function getAdsInventory(refreshToken: string): Promise<AdsInventoryCampaign[]> {
  const customer = await getAdsCustomer(refreshToken);
  const camps = await customer.query(`
    SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status, campaign.primary_status,
      campaign.primary_status_reasons, campaign.advertising_channel_type, campaign.bidding_strategy_type,
      campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared
    FROM campaign WHERE campaign.status != 'REMOVED'`);
  const perf = await customer.query(`
    SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM campaign WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED'`);
  const geos = await customer.query(`
    SELECT campaign.id, campaign_criterion.location.geo_target_constant, campaign_criterion.negative
    FROM campaign_criterion WHERE campaign_criterion.type = 'LOCATION' AND campaign.status != 'REMOVED'`);
  const groups = await customer.query(`
    SELECT campaign.id, ad_group.id, ad_group.name, ad_group.status
    FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`);
  const ads = await customer.query(`
    SELECT ad_group.id, ad_group_ad.resource_name, ad_group_ad.ad.id, ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status, ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines
    FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED'`);
  const kws = await customer.query(`
    SELECT ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
    FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
      AND ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'`);

  const perfBy = new Map<string, AdsInventoryCampaign["last30"]>();
  for (const r of perf as any[]) {
    const id = String(r.campaign.id);
    const p = perfBy.get(id) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    p.impressions += Number(r.metrics.impressions || 0);
    p.clicks += Number(r.metrics.clicks || 0);
    p.cost += Number(r.metrics.cost_micros || 0) / 1_000_000;
    p.conversions += Number(r.metrics.conversions || 0);
    perfBy.set(id, p);
  }
  const geoBy = new Map<string, string[]>();
  for (const r of geos as any[]) {
    const id = String(r.campaign.id);
    const g = String(r.campaign_criterion?.location?.geo_target_constant ?? "");
    geoBy.set(id, [...(geoBy.get(id) ?? []), (r.campaign_criterion?.negative ? "-" : "") + g.replace("geoTargetConstants/", "")]);
  }
  const kwBy = new Map<string, string[]>();
  for (const r of kws as any[]) {
    const id = String(r.ad_group.id);
    const mt = enumName(enums.KeywordMatchType as any, r.ad_group_criterion?.keyword?.match_type);
    const t = String(r.ad_group_criterion?.keyword?.text ?? "");
    kwBy.set(id, [...(kwBy.get(id) ?? []), mt === "EXACT" ? `[${t}]` : mt === "PHRASE" ? `"${t}"` : t]);
  }
  const adsBy = new Map<string, AdsInventoryAd[]>();
  for (const r of ads as any[]) {
    const id = String(r.ad_group.id);
    adsBy.set(id, [...(adsBy.get(id) ?? []), {
      resourceName: String(r.ad_group_ad.resource_name),
      adId: String(r.ad_group_ad.ad?.id ?? ""),
      status: enumName(enums.AdGroupAdStatus as any, r.ad_group_ad.status),
      approval: enumName(enums.PolicyApprovalStatus as any, r.ad_group_ad.policy_summary?.approval_status),
      finalUrls: (r.ad_group_ad.ad?.final_urls ?? []).map(String),
      headlines: (r.ad_group_ad.ad?.responsive_search_ad?.headlines ?? []).map((h: any) => String(h.text ?? "")).slice(0, 5),
    }]);
  }
  const groupsBy = new Map<string, AdsInventoryAdGroup[]>();
  for (const r of groups as any[]) {
    const cid = String(r.campaign.id);
    const gid = String(r.ad_group.id);
    groupsBy.set(cid, [...(groupsBy.get(cid) ?? []), {
      id: gid, name: String(r.ad_group.name), status: enumName(enums.AdGroupStatus as any, r.ad_group.status),
      ads: adsBy.get(gid) ?? [], keywords: (kwBy.get(gid) ?? []).slice(0, 40),
    }]);
  }
  return (camps as any[]).map((r) => {
    const id = String(r.campaign.id);
    return {
      id,
      name: String(r.campaign.name),
      status: enumName(enums.CampaignStatus as any, r.campaign.status),
      servingStatus: enumName(enums.CampaignServingStatus as any, r.campaign.serving_status),
      primaryStatus: enumName(enums.CampaignPrimaryStatus as any, r.campaign.primary_status),
      primaryStatusReasons: (r.campaign.primary_status_reasons ?? []).map((x: unknown) => enumName(enums.CampaignPrimaryStatusReason as any, x)),
      channelType: enumName(enums.AdvertisingChannelType as any, r.campaign.advertising_channel_type),
      bidding: enumName(enums.BiddingStrategyType as any, r.campaign.bidding_strategy_type),
      budgetResourceName: r.campaign_budget?.resource_name ?? null,
      dailyBudget: r.campaign_budget?.amount_micros != null ? Number(r.campaign_budget.amount_micros) / 1_000_000 : null,
      budgetShared: !!r.campaign_budget?.explicitly_shared,
      locations: geoBy.get(id) ?? [],
      adGroups: groupsBy.get(id) ?? [],
      last30: perfBy.get(id) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
    };
  });
}

async function findCampaign(refreshToken: string, campaignId: string) {
  const customer = await getAdsCustomer(refreshToken);
  const rows = (await customer.query(`
    SELECT campaign.resource_name, campaign.name, campaign.status, campaign_budget.resource_name,
      campaign_budget.amount_micros, campaign_budget.explicitly_shared
    FROM campaign WHERE campaign.id = ${Number(campaignId)}`)) as any[];
  if (!rows.length) throw new Error(`Campaign ${campaignId} not found.`);
  return { customer, row: rows[0] };
}

/** Set a campaign's daily budget (USD). Refuses shared budgets, which would change other campaigns too. */
export async function setCampaignDailyBudget(refreshToken: string, campaignId: string, dailyBudget: number) {
  if (!(dailyBudget >= 1 && dailyBudget <= 200)) throw new Error("Daily budget must be between $1 and $200.");
  const { customer, row } = await findCampaign(refreshToken, campaignId);
  if (row.campaign_budget?.explicitly_shared) throw new Error(`Campaign ${row.campaign.name} uses a shared budget; change it in the Ads UI.`);
  const before = Number(row.campaign_budget.amount_micros) / 1_000_000;
  await customer.campaignBudgets.update([{ resource_name: row.campaign_budget.resource_name, amount_micros: Math.round(dailyBudget * 100) * 10_000 }]);
  return { campaign: String(row.campaign.name), before, after: dailyBudget };
}

/** Enable or pause a campaign. */
export async function setCampaignStatus(refreshToken: string, campaignId: string, status: "ENABLED" | "PAUSED") {
  const { customer, row } = await findCampaign(refreshToken, campaignId);
  const before = enumName(enums.CampaignStatus as any, row.campaign.status);
  await customer.campaigns.update([{ resource_name: row.campaign.resource_name, status: enums.CampaignStatus[status] }]);
  return { campaign: String(row.campaign.name), before, after: status };
}

/** Point every ad in a campaign at `finalUrl`. Must be a mechanicalenterprise.com https URL. */
export async function setCampaignAdsFinalUrl(refreshToken: string, campaignId: string, finalUrl: string) {
  const u = new URL(finalUrl);
  if (u.protocol !== "https:" || !/(^|\.)mechanicalenterprise\.com$/.test(u.hostname)) throw new Error("Final URL must be https://mechanicalenterprise.com/…");
  const { customer, row } = await findCampaign(refreshToken, campaignId);
  const ads = (await customer.query(`
    SELECT ad_group_ad.ad.resource_name, ad_group_ad.ad.final_urls
    FROM ad_group_ad WHERE campaign.id = ${Number(campaignId)} AND ad_group_ad.status != 'REMOVED'`)) as any[];
  const changed: Array<{ ad: string; before: string[] }> = [];
  for (const a of ads) {
    const before = (a.ad_group_ad.ad?.final_urls ?? []).map(String);
    if (before.length === 1 && before[0] === finalUrl) continue;
    await customer.ads.update([{ resource_name: a.ad_group_ad.ad.resource_name, final_urls: [finalUrl] }]);
    changed.push({ ad: String(a.ad_group_ad.ad.resource_name), before });
  }
  return { campaign: String(row.campaign.name), finalUrl, changed };
}

/** Add one responsive search ad to an ad group that has none (or needs a second). */
export async function addResponsiveSearchAd(refreshToken: string, adGroupId: string, input: { finalUrl: string; headlines: string[]; descriptions: string[] }) {
  const u = new URL(input.finalUrl);
  if (u.protocol !== "https:" || !/(^|\.)mechanicalenterprise\.com$/.test(u.hostname)) throw new Error("Final URL must be https://mechanicalenterprise.com/…");
  if (input.headlines.length < 3 || input.descriptions.length < 2) throw new Error("Need at least 3 headlines and 2 descriptions.");
  if (input.headlines.some((h) => h.length > 30) || input.descriptions.some((d) => d.length > 90)) throw new Error("Headlines max 30 chars, descriptions max 90.");
  const customer = await getAdsCustomer(refreshToken);
  const g = (await customer.query(`SELECT ad_group.resource_name, ad_group.name FROM ad_group WHERE ad_group.id = ${Number(adGroupId)}`)) as any[];
  if (!g.length) throw new Error(`Ad group ${adGroupId} not found.`);
  const res = await customer.adGroupAds.create([{
    ad_group: g[0].ad_group.resource_name,
    status: enums.AdGroupAdStatus.ENABLED,
    ad: {
      final_urls: [input.finalUrl],
      responsive_search_ad: {
        headlines: input.headlines.slice(0, 15).map((text) => ({ text })),
        descriptions: input.descriptions.slice(0, 4).map((text) => ({ text })),
      },
    },
  }]);
  return { adGroup: String(g[0].ad_group.name), created: (res as any).results?.[0]?.resource_name ?? null };
}
