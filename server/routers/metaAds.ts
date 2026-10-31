import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
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
  createNjTrafficCampaign,
  setMetaCampaignStatus,
} from "../metaAds";
import { saveAiVaCredentials, getAiVaCredentials, getAiVaCredentialTimestamp } from "../db";
import { ENV } from "../_core/env";

const SERVICE_KEY = "meta_ads";

async function getToken(): Promise<string | null> {
  // First try DB (user-provided via OAuth flow)
  const creds = await getAiVaCredentials(SERVICE_KEY);
  if (creds["user_access_token"]) return creds["user_access_token"];
  if (creds["token_type"] !== "page_access_token" && creds["access_token"]) {
    return creds["access_token"];
  }
  // Legacy Page-only credentials cannot read ad-account insights.
  // A valid environment-provided user/system token may still be used.
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
    .query(() => {
      // Always use one production callback; Meta requires an exact allowlist match.
      // Do not derive redirect_uri from window.location.origin or a client hint.
      const url = getMetaAuthUrl("https://mechanicalenterprise.com/api/oauth/meta/callback");
      return { url };
    }),

  // Exchange code for long-lived user token, then get Page Access Token
  handleCallback: adminProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ input }) => {
      const shortToken = await exchangeCodeForToken(input.code, input.redirectUri);
      const longUserToken = await getLongLivedToken(shortToken.access_token);

      const current = await getAiVaCredentials(SERVICE_KEY);
      const PAGE_ID = current["page_id"] || "844109052114327";
      const pageToken = await getPageAccessToken(longUserToken, PAGE_ID);

      await saveAiVaCredentials(SERVICE_KEY, {
        access_token: longUserToken,
        user_access_token: longUserToken,
        page_access_token: pageToken,
        page_id: PAGE_ID,
        token_type: "long_lived_user_access_token",
        token_created_at: new Date().toISOString(),
      });
      return { success: true, message: "Meta Ads reauthorized; account and Page access saved." };
    }),

  // Save ad account ID and page ID manually
  saveConfig: adminProcedure
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

  /** NJ-only website-traffic campaign to a mechanicalenterprise.com landing page (created PAUSED). Admin-only. */
  createNjTrafficCampaign: adminProcedure
    .input(z.object({
      name: z.string().min(3).max(120),
      dailyBudget: z.number().min(1).max(50),
      landingUrl: z.string().url(),
      imageUrl: z.string().url(),
      primaryText: z.string().min(10).max(600),
      headline: z.string().min(3).max(60),
      description: z.string().max(120).default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = await getToken();
      const adAccountId = await getAdAccountId();
      const pageId = await getPageId();
      if (!token || !adAccountId || !pageId) throw new Error("Meta Ads not fully configured.");
      try {
        const r = await createNjTrafficCampaign(token, { ...input, dailyBudgetCents: Math.round(input.dailyBudget * 100), adAccountId, pageId });
        console.log("[Meta Ads] nj_traffic_campaign_created", JSON.stringify({ actor: (ctx.user as { email?: string } | null)?.email ?? null, name: input.name, dailyBudget: input.dailyBudget, ...r }));
        return r;
      } catch (err) {
        console.error("[Meta Ads] nj_traffic_campaign_failed", (err as Error).message.slice(0, 1000));
        throw err;
      }
    }),

  setCampaignStatus: adminProcedure
    .input(z.object({ campaignId: z.string().regex(/^\d+$/), status: z.enum(["ACTIVE", "PAUSED"]) }))
    .mutation(async ({ input, ctx }) => {
      const token = await getToken();
      if (!token) throw new Error("Meta Ads not connected.");
      const r = await setMetaCampaignStatus(token, input.campaignId, input.status);
      console.log("[Meta Ads] campaign_status_changed", JSON.stringify({ actor: (ctx.user as { email?: string } | null)?.email ?? null, ...r }));
      return r;
    }),

  // Create a lead generation campaign (OUTCOME_LEADS with Instant Form)
  createCampaign: adminProcedure
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
