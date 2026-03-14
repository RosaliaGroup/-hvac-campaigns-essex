import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getGoogleAdsAuthUrl,
  exchangeCodeForTokens,
  getCampaignPerformance,
  getAccountSummary,
  createSearchCampaign,
} from "../googleAds";
import { saveAiVaCredentials, getAiVaCredentials } from "../db";

const SERVICE_KEY = "google_ads";
const TOKEN_KEY = "refresh_token";

async function getRefreshToken(): Promise<string | null> {
  const creds = await getAiVaCredentials(SERVICE_KEY);
  return creds[TOKEN_KEY] ?? null;
}

export const googleAdsRouter = router({
  // Get OAuth authorization URL
  getAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string() }))
    .query(({ input }) => {
      const url = getGoogleAdsAuthUrl(input.redirectUri);
      return { url };
    }),

  // Exchange auth code for tokens and save refresh token
  handleCallback: protectedProcedure
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

  // Get account-level summary (last 30 days)
  getAccountSummary: protectedProcedure.query(async () => {
    const token = await getRefreshToken();
    if (!token) throw new Error("Google Ads not connected. Please authorize first.");
    const summary = await getAccountSummary(token);
    return { summary };
  }),

  // Push a new search campaign to Google Ads
  createCampaign: protectedProcedure
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
      })
    )
    .mutation(async ({ input }) => {
      const token = await getRefreshToken();
      if (!token) throw new Error("Google Ads not connected. Please authorize first.");
      const result = await createSearchCampaign(token, {
        ...input,
        dailyBudgetMicros: input.dailyBudget * 1_000_000,
      });
      return result;
    }),
});
