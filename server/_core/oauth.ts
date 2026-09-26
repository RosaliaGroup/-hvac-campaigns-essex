import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { exchangeCodeForTokens } from "../googleAds";
import { exchangeCodeForToken, getLongLivedToken, getPageAccessToken, getInstagramBusinessAccountId } from "../metaAds";
import { saveAiVaCredentials } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { logAuthEventFromReq } from "./authLog";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Google Ads OAuth callback — exchanges code for refresh token and saves it
  app.get("/api/oauth/google-ads/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const stateParam = getQueryParam(req, "state");

    if (!code) {
      res.redirect(302, "/google-ads-campaigns?error=missing_code");
      return;
    }

    // Decode redirectUri from state (base64 encoded by getGoogleAdsAuthUrl)
    // This ensures we use the exact same URI that was registered in Google Cloud Console
    let redirectUri: string;
    if (stateParam) {
      try {
        const decoded = Buffer.from(stateParam, "base64").toString("utf8");
        // Validate it looks like a URL before trusting it
        if (decoded.startsWith("http")) {
          redirectUri = decoded;
        } else {
          redirectUri = "https://mechanicalenterprise.com/api/oauth/google-ads/callback";
        }
      } catch {
        redirectUri = "https://mechanicalenterprise.com/api/oauth/google-ads/callback";
      }
    } else {
      redirectUri = "https://mechanicalenterprise.com/api/oauth/google-ads/callback";
    }

    try {
      console.log("[Google Ads] Exchanging code with redirectUri:", redirectUri);
      const tokens = await exchangeCodeForTokens(code, redirectUri);
      await saveAiVaCredentials("google_ads", { refresh_token: tokens.refresh_token });
      console.log("[Google Ads] OAuth connected successfully");
      res.redirect(302, "/google-ads-campaigns?connected=1");
    } catch (error) {
      console.error("[Google Ads] OAuth callback failed", error);
      res.redirect(302, "/google-ads-campaigns?error=auth_failed");
    }
  });

  // Meta (Facebook) Ads OAuth callback — exchanges code for long-lived token
  app.get("/api/oauth/meta/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const stateParam = getQueryParam(req, "state");

    if (!code) {
      res.redirect(302, "/facebook-campaigns?error=missing_code");
      return;
    }

    let redirectUri: string;
    if (stateParam) {
      try {
        const decoded = Buffer.from(stateParam, "base64").toString("utf8");
        if (decoded.startsWith("http")) {
          redirectUri = decoded;
        } else {
          redirectUri = "https://mechanicalenterprise.com/api/oauth/meta/callback";
        }
      } catch {
        redirectUri = "https://mechanicalenterprise.com/api/oauth/meta/callback";
      }
    } else {
      redirectUri = "https://mechanicalenterprise.com/api/oauth/meta/callback";
    }

    try {
      console.log("[Meta Ads] Exchanging code with redirectUri:", redirectUri);
      const shortToken = await exchangeCodeForToken(code, redirectUri);
      const longUserToken = await getLongLivedToken(shortToken.access_token);

      // Exchange user token for a Page Access Token (never expires, has pages_manage_ads)
      const PAGE_ID = "844109052114327"; // Mechanical Enterprise
      const pageToken = await getPageAccessToken(longUserToken, PAGE_ID);

      await saveAiVaCredentials("meta_ads", {
        access_token: pageToken,
        page_id: PAGE_ID,
        token_type: "page_access_token",
        token_created_at: new Date().toISOString(),
      });
      console.log("[Meta Ads] OAuth connected with Page Access Token");
      res.redirect(302, "/facebook-campaigns?connected=1");
    } catch (error) {
      console.error("[Meta Ads] OAuth callback failed", error);
      res.redirect(302, "/facebook-campaigns?error=auth_failed");
    }
  });

  // Social Lane "Connect Facebook/Instagram" (docs/social-lane-spec.md, owner
  // build instruction #5) — reuses the SAME Meta OAuth app + token-exchange
  // helpers as the Meta Ads callback above, just with the posting-scoped
  // dialog URL and saved under the "facebook" aiVaCredentials service (the
  // shape server/services/socialPublisher.ts's defaultPublishToPlatform
  // already reads: accessToken/pageId/instagramAccountId).
  app.get("/api/oauth/meta-social/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const stateParam = getQueryParam(req, "state");

    if (!code) {
      res.redirect(302, "/ai-va-settings?social_error=missing_code");
      return;
    }

    let redirectUri: string;
    if (stateParam) {
      try {
        const decoded = Buffer.from(stateParam, "base64").toString("utf8");
        redirectUri = decoded.startsWith("http") ? decoded : "https://mechanicalenterprise.com/api/oauth/meta-social/callback";
      } catch {
        redirectUri = "https://mechanicalenterprise.com/api/oauth/meta-social/callback";
      }
    } else {
      redirectUri = "https://mechanicalenterprise.com/api/oauth/meta-social/callback";
    }

    try {
      const shortToken = await exchangeCodeForToken(code, redirectUri);
      const longUserToken = await getLongLivedToken(shortToken.access_token);

      const PAGE_ID = "844109052114327"; // Mechanical Enterprise — same page as the Meta Ads connection
      const pageToken = await getPageAccessToken(longUserToken, PAGE_ID);
      const instagramAccountId = await getInstagramBusinessAccountId(pageToken, PAGE_ID).catch(() => null);

      await saveAiVaCredentials("facebook", {
        accessToken: pageToken,
        pageId: PAGE_ID,
        ...(instagramAccountId ? { instagramAccountId } : {}),
      });
      console.log("[Social Lane] Meta connect completed", { hasInstagram: !!instagramAccountId });
      res.redirect(302, "/ai-va-settings?social_connected=1");
    } catch (error) {
      console.error("[Social Lane] Meta connect failed", error);
      res.redirect(302, "/ai-va-settings?social_error=auth_failed");
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Hardened session: 8h absolute cap + 30m idle window (same as staff login).
      const { token, ttlMs } = await sdk.issueSession(
        { openId: userInfo.openId, appId: ENV.appId, name: userInfo.name || "" },
        { rememberDevice: false }
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ttlMs });

      logAuthEventFromReq(req, { event: "login", outcome: "success", userId: userInfo.openId, reason: "oauth" });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
