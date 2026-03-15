import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getMetaAuthUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  getAdAccounts,
  getCampaignPerformance,
  createLeadCampaign,
} from "../metaAds";
import { saveAiVaCredentials, getAiVaCredentials } from "../db";
import { ENV } from "../_core/env";

const SERVICE_KEY = "meta_ads";

async function getToken(): Promise<string | null> {
  // First try DB (user-provided via OAuth flow)
  const creds = await getAiVaCredentials(SERVICE_KEY);
  if (creds["access_token"]) return creds["access_token"];
  // Fall back to environment variable (set via secrets manager)
  if (ENV.metaAccessToken) return ENV.metaAccessToken;
  return null;
}

async function getAdAccountId(): Promise<string | null> {
  const creds = await getAiVaCredentials(SERVICE_KEY);
  return creds["ad_account_id"] ?? null;
}

async function getPageId(): Promise<string | null> {
  const creds = await getAiVaCredentials(SERVICE_KEY);
  return creds["page_id"] ?? null;
}

export const metaAdsRouter = router({
  // Get OAuth URL
  getAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string() }))
    .query(({ input }) => {
      const url = getMetaAuthUrl(input.redirectUri);
      return { url };
    }),

  // Exchange code for long-lived token and save
  handleCallback: protectedProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ input }) => {
      const shortToken = await exchangeCodeForToken(input.code, input.redirectUri);
      const longToken = await getLongLivedToken(shortToken.access_token);
      await saveAiVaCredentials(SERVICE_KEY, { access_token: longToken });
      return { success: true, message: "Meta Ads connected successfully!" };
    }),

  // Save ad account ID and page ID manually
  saveConfig: protectedProcedure
    .input(z.object({ adAccountId: z.string(), pageId: z.string() }))
    .mutation(async ({ input }) => {
      await saveAiVaCredentials(SERVICE_KEY, {
        ad_account_id: input.adAccountId,
        page_id: input.pageId,
      });
      return { success: true };
    }),

  // Check connection status
  getConnectionStatus: protectedProcedure.query(async () => {
    const token = await getToken();
    const adAccountId = await getAdAccountId();
    const pageId = await getPageId();
    return {
      connected: !!token && !!adAccountId && !!pageId,
      hasToken: !!token,
      hasAdAccount: !!adAccountId,
      hasPageId: !!pageId,
      adAccountId: adAccountId ?? null,
      pageId: pageId ?? null,
    };
  }),

  // Get ad accounts linked to the token
  getAdAccounts: protectedProcedure.query(async () => {
    const token = await getToken();
    if (!token) throw new Error("Meta Ads not connected.");
    const accounts = await getAdAccounts(token);
    return { accounts };
  }),

  // Get campaign performance
  getCampaignPerformance: protectedProcedure.query(async () => {
    const token = await getToken();
    const adAccountId = await getAdAccountId();
    if (!token || !adAccountId) throw new Error("Meta Ads not fully configured.");
    const campaigns = await getCampaignPerformance(token, adAccountId);
    return { campaigns };
  }),

  // Create a campaign
  createCampaign: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        objective: z.enum(["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"]),
        dailyBudget: z.number().min(1), // USD
        ageMin: z.number().default(30),
        ageMax: z.number().default(65),
        headline: z.string(),
        primaryText: z.string(),
        description: z.string(),
        callToAction: z.string().default("LEARN_MORE"),
        websiteUrl: z.string().url(),
        interests: z
          .array(z.object({ id: z.string(), name: z.string() }))
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input }) => {
      const token = await getToken();
      const adAccountId = await getAdAccountId();
      const pageId = await getPageId();
      if (!token || !adAccountId || !pageId) {
        throw new Error(
          "Meta Ads not fully configured. Please connect your account and set Ad Account ID and Page ID."
        );
      }
      const result = await createLeadCampaign(token, {
        ...input,
        dailyBudgetCents: Math.round(input.dailyBudget * 100),
        adAccountId,
        pageId,
        geoLocationCities: [
          { key: "2418779", radius: 25, distance_unit: "mile" }, // Newark NJ → covers Essex County
        ],
      });
      return result;
    }),
});
