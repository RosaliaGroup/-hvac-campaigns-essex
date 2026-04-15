import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getMetaAuthUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  getPageAccessToken,
  getAdAccounts,
  getCampaignPerformance,
  createLeadCampaign,
  testAdAccount,
} from "../metaAds";
import { saveAiVaCredentials, getAiVaCredentials, getAiVaCredentialTimestamp } from "../db";
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

  // Exchange code for long-lived user token, then get Page Access Token
  handleCallback: protectedProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ input }) => {
      const shortToken = await exchangeCodeForToken(input.code, input.redirectUri);
      const longUserToken = await getLongLivedToken(shortToken.access_token);

      // Exchange user token for a Page Access Token (never expires, has pages_manage_ads)
      const PAGE_ID = "844109052114327"; // Mechanical Enterprise
      const pageToken = await getPageAccessToken(longUserToken, PAGE_ID);

      await saveAiVaCredentials(SERVICE_KEY, {
        access_token: pageToken,
        page_id: PAGE_ID,
        token_type: "page_access_token",
        token_created_at: new Date().toISOString(),
      });
      return { success: true, message: "Meta Ads connected with Page Access Token!" };
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

    // Get token age for expiry warning (Meta long-lived tokens last ~60 days)
    let tokenCreatedAt: string | null = null;
    const creds = await getAiVaCredentials(SERVICE_KEY);
    if (creds["token_created_at"]) {
      tokenCreatedAt = creds["token_created_at"];
    } else if (token) {
      // Fallback: check DB row timestamp
      const ts = await getAiVaCredentialTimestamp(SERVICE_KEY, "access_token");
      if (ts) tokenCreatedAt = ts.toISOString();
    }

    return {
      connected: !!token && !!adAccountId && !!pageId,
      hasToken: !!token,
      hasAdAccount: !!adAccountId,
      hasPageId: !!pageId,
      adAccountId: adAccountId ?? null,
      pageId: pageId ?? null,
      tokenCreatedAt,
    };
  }),

  // Test connection — verifies token + ad account are valid
  testConnection: protectedProcedure.query(async () => {
    const token = await getToken();
    const adAccountId = await getAdAccountId();
    if (!token) return { ok: false, error: "No access token found." };
    if (!adAccountId) return { ok: false, error: "No ad account ID configured." };
    try {
      const account = await testAdAccount(token, adAccountId);
      return {
        ok: true,
        account: {
          id: account.id,
          name: account.name,
          status: account.account_status,
          currency: account.currency,
          timezone: account.timezone_name,
        },
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
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

  // Create a lead generation campaign (OUTCOME_LEADS with Instant Form)
  createCampaign: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        objective: z.enum(["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"]),
        dailyBudget: z.number().min(1), // USD
        headline: z.string(),
        primaryText: z.string(),
        description: z.string(),
        callToAction: z.string().default("LEARN_MORE"),
        websiteUrl: z.string().url(),
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
      });
      return result;
    }),
});
