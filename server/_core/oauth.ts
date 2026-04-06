import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { exchangeCodeForTokens } from "../googleAds";
import { exchangeCodeForToken, getLongLivedToken } from "../metaAds";
import { saveAiVaCredentials } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

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
      const longToken = await getLongLivedToken(shortToken.access_token);
      await saveAiVaCredentials("meta_ads", {
        access_token: longToken,
        token_created_at: new Date().toISOString(),
      });
      console.log("[Meta Ads] OAuth connected successfully");
      res.redirect(302, "/facebook-campaigns?connected=1");
    } catch (error) {
      console.error("[Meta Ads] OAuth callback failed", error);
      res.redirect(302, "/facebook-campaigns?error=auth_failed");
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

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
