import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getGoogleAdsAuthUrl,
  exchangeCodeForTokens,
  getCampaignPerformance,
  getSearchTermPerformance,
  getConversionActionPerformance,
  getAccountSummary,
  createSearchCampaign,
} from "../googleAds";
import { saveAiVaCredentials, getAiVaCredentials } from "../db";
import { getAdsInventory, setCampaignDailyBudget, setCampaignStatus, setCampaignAdsFinalUrl, addResponsiveSearchAd } from "../googleAdsOperator";

async function requireToken(): Promise<string> {
  const token = await getRefreshToken();
  if (!token) throw new Error("Google Ads not connected. Please authorize first.");
  return token;
}
/** Ad-account changes go to the server log (seoAuditLog.action is a fixed DB enum). One line per change. */
async function logAdsChange(action: string, ctxUser: unknown, after: unknown): Promise<void> {
  const actor = (ctxUser as { id?: number; email?: string } | null) ?? null;
  console.log(`[GoogleAds] ${action}`, JSON.stringify({ actorId: actor?.id ?? null, actor: actor?.email ?? null, ...(after as object) }));
}

const SERVICE_KEY = "google_ads";
const TOKEN_KEY = "refresh_token";

async function getRefreshToken(): Promise<string | null> {
  const creds = await getAiVaCredentials(SERVICE_KEY);
  return creds[TOKEN_KEY] ?? null;
}

export const googleAdsRouter = router({
  // Get OAuth authorization URL
  // redirectUri is optional — server resolves the canonical URI from GOOGLE_ADS_REDIRECT_URI env var first
  getAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string().optional() }))
    .query(async ({ input }) => {
      const url = await getGoogleAdsAuthUrl(input.redirectUri);
      return { url };
    }),

  // Exchange auth code for tokens and save refresh token
  handleCallback: adminProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ input }) => {
      const tokens = await exchangeCodeForTokens(input.code, input.redirectUri);
      await saveAiVaCredentials(SERVICE_KEY, { [TOKEN_KEY]: tokens.refresh_token });
      return { success: true, message: "Google Ads connected successfully!" };
    }),

  // Check if Google Ads is connected
  getConnectionStatus: protectedProcedure.query(async () => {
    const token = await getRefreshToken();
    return { connected: !!token };
  }),

  // Get live campaign performance data
  getCampaignPerformance: protectedProcedure.query(async () => {
    const token = await getRefreshToken();
    if (!token) throw new Error("Google Ads not connected. Please authorize first.");
    const campaigns = await getCampaignPerformance(token);
    return { campaigns };
  }),

  // Read-only diagnostics. Never change campaigns, bids or budgets.
  getSearchTermPerformance: protectedProcedure.query(async () => {
    const token = await getRefreshToken();
    if (!token) throw new Error("Google Ads not connected. Please authorize first.");
    return { terms: await getSearchTermPerformance(token) };
  }),

  getConversionActionPerformance: protectedProcedure.query(async () => {
    const token = await getRefreshToken();
    if (!token) throw new Error("Google Ads not connected. Please authorize first.");
    return { actions: await getConversionActionPerformance(token) };
  }),

  // Get account-level summary (last 30 days)
  getAccountSummary: protectedProcedure.query(async () => {
    const token = await getRefreshToken();
    if (!token) throw new Error("Google Ads not connected. Please authorize first.");
    const summary = await getAccountSummary(token);
    return { summary };
  }),

  /** Full account read: budgets, status reasons, ad groups, ads (approval + landing page), keywords, geos. */
  getAdsInventory: adminProcedure.query(async () => ({ campaigns: await getAdsInventory(await requireToken()) })),

  setCampaignDailyBudget: adminProcedure
    .input(z.object({ campaignId: z.string().regex(/^\d+$/), dailyBudget: z.number().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const r = await setCampaignDailyBudget(await requireToken(), input.campaignId, input.dailyBudget);
      await logAdsChange("budget_changed", ctx.user, r);
      return r;
    }),

  setCampaignStatus: adminProcedure
    .input(z.object({ campaignId: z.string().regex(/^\d+$/), status: z.enum(["ENABLED", "PAUSED"]) }))
    .mutation(async ({ input, ctx }) => {
      const r = await setCampaignStatus(await requireToken(), input.campaignId, input.status);
      await logAdsChange("status_changed", ctx.user, r);
      return r;
    }),

  setCampaignAdsFinalUrl: adminProcedure
    .input(z.object({ campaignId: z.string().regex(/^\d+$/), finalUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const r = await setCampaignAdsFinalUrl(await requireToken(), input.campaignId, input.finalUrl);
      await logAdsChange("final_url_changed", ctx.user, r);
      return r;
    }),

  addResponsiveSearchAd: adminProcedure
    .input(z.object({ adGroupId: z.string().regex(/^\d+$/), finalUrl: z.string().url(), headlines: z.array(z.string().min(1).max(30)).min(3).max(15), descriptions: z.array(z.string().min(1).max(90)).min(2).max(4) }))
    .mutation(async ({ input, ctx }) => {
      const r = await addResponsiveSearchAd(await requireToken(), input.adGroupId, input);
      await logAdsChange("ad_created", ctx.user, r);
      return r;
    }),

  // Push a new search campaign to Google Ads
  createCampaign: adminProcedure
    .input(
      z.object({
        name: z.string(),
        dailyBudget: z.number().min(1), // USD
        keywords: z.array(z.string()),
        negativeKeywords: z.array(z.string()).optional().default([]),
        headlines: z.array(z.string()),
        descriptions: z.array(z.string()),
        finalUrl: z.string().url(),
        geoTargetNames: z.array(z.string()).default(["New Jersey"]),
        /** Google geo target constant IDs. New Jersey = 21164. Defaults (in createSearchCampaign) to Essex County only. */
        geoTargetIds: z.array(z.number().int().positive()).max(25).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = await getRefreshToken();
      if (!token) throw new Error("Google Ads not connected. Please authorize first.");
      const result = await createSearchCampaign(token, {
        ...input,
        dailyBudgetMicros: Math.round(input.dailyBudget * 100) * 10_000,
      });
      await logAdsChange("campaign_created", ctx.user, { name: input.name, dailyBudget: input.dailyBudget, geoTargetIds: input.geoTargetIds ?? [1023191], finalUrl: input.finalUrl, ...result });
      return result;
    }),
});
