import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  SESSION_TTL_MS,
  sessionTtlMs,
  signSessionToken,
  verifySessionToken,
  type StaffSessionClaims,
} from "./session";
import { logAuthEventFromReq } from "./authLog";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

/**
 * Result of authenticating a request. `refreshedToken` (present only on success)
 * is a re-minted cookie value that slides the idle window forward; the caller
 * sets it with `refreshMaxAgeMs`.
 */
export type AuthResult = {
  user: (User & { teamRole?: "admin" | "member" | "viewer" }) | null;
  refreshedToken?: string;
  refreshMaxAgeMs?: number;
};

const TEAM_SESSION_PREFIX = "team:";

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  /**
   * Mint a HARDENED staff/OAuth session (Auth Hardening 2026-07): an absolute
   * cap (8h, or 30d when `rememberDevice`) plus a sliding 30-minute idle window.
   * Returns the token and the cookie `maxAge` (ms) to use. Distinct from the
   * legacy `signSession` used by the customer portal, which is left unchanged.
   */
  async issueSession(
    payload: SessionPayload,
    options: { rememberDevice?: boolean } = {}
  ): Promise<{ token: string; absExp: number; ttlMs: number }> {
    const now = Date.now();
    const remember = options.rememberDevice === true;
    const ttlMs = sessionTtlMs(remember);
    const absExp = now + ttlMs;
    const claims: StaffSessionClaims = {
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      absExp,
      rmb: remember,
    };
    const token = await signSessionToken(claims, ENV.cookieSecret, now);
    return { token, absExp, ttlMs };
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  /**
   * Authenticate an incoming request from the hardened staff/OAuth session
   * cookie. On success returns the resolved user AND a freshly re-minted token
   * that slides the 30-minute idle window forward (bounded by the absolute cap);
   * the caller (createContext) writes that cookie. Auth failures never throw —
   * they return { user: null } and log the security event.
   */
  async authenticateRequest(req: Request): Promise<AuthResult> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);

    const verified = await verifySessionToken(sessionCookie, ENV.cookieSecret);
    if (!verified.ok) {
      // Anonymous visitors (no cookie) are expected, not a security event.
      if (verified.reason !== "missing") {
        const event =
          verified.reason === "expired"
            ? "session_expired"
            : verified.reason === "invalid_signature"
              ? "invalid_signature"
              : "invalid_token";
        logAuthEventFromReq(req, { event, outcome: "failure", reason: `jwt_${verified.reason}` });
      }
      return { user: null };
    }

    const claims = verified.claims;
    const now = Date.now();
    // Legacy pre-hardening cookies carry no absExp — migrate them onto a fresh
    // 8h cap so idle + absolute enforcement begins from the next request.
    const absExp = claims.absExp > 0 ? claims.absExp : now + SESSION_TTL_MS;
    if (now >= absExp) {
      logAuthEventFromReq(req, { event: "session_expired", outcome: "failure", reason: "absolute_cap" });
      return { user: null };
    }

    const sessionUserId = claims.openId;
    const signedInAt = new Date();
    let resolved: (User & { teamRole?: "admin" | "member" | "viewer" }) | null = null;

    // ── Team member session (openId starts with "team:") ──────────────────
    if (sessionUserId.startsWith(TEAM_SESSION_PREFIX)) {
      const memberId = parseInt(sessionUserId.slice(TEAM_SESSION_PREFIX.length), 10);
      const member = await db.getTeamMemberById(memberId);
      if (!member || member.status !== "active") {
        logAuthEventFromReq(req, {
          event: "invalid_token",
          outcome: "failure",
          userId: memberId,
          reason: "member_not_found_or_suspended",
        });
        return { user: null };
      }
      await db.updateTeamMemberLastSignedIn(memberId);
      // A User-shaped object so the rest of the app works unchanged.
      resolved = {
        id: -(memberId), // negative to distinguish from OAuth users
        openId: sessionUserId,
        name: member.name,
        email: member.email,
        loginMethod: "team",
        role: member.role === "admin" ? "admin" : "user",
        // Phase 1 security: preserve the REAL team role so viewer can be
        // enforced as read-only (previously flattened to "user").
        teamRole: member.role,
        videoInterests: null,
        createdAt: member.createdAt,
        updatedAt: member.createdAt,
        lastSignedIn: signedInAt,
      } as User & { teamRole: "admin" | "member" | "viewer" };
    } else {
      // ── Regular Manus OAuth session ─────────────────────────────────────
      let user = await db.getUserByOpenId(sessionUserId);
      // If user not in DB, sync from OAuth server automatically.
      if (!user) {
        try {
          const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
          await db.upsertUser({
            openId: userInfo.openId,
            name: userInfo.name || null,
            email: userInfo.email ?? null,
            loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
            lastSignedIn: signedInAt,
          });
          user = await db.getUserByOpenId(userInfo.openId);
        } catch (error) {
          console.error("[Auth] Failed to sync user from OAuth:", error);
          return { user: null };
        }
      }
      if (!user) {
        return { user: null };
      }
      await db.upsertUser({ openId: user.openId, lastSignedIn: signedInAt });
      resolved = user;
    }

    // Slide the idle window forward, never past the absolute cap. Cookie maxAge
    // tracks the remaining absolute lifetime.
    const refreshedToken = await signSessionToken(
      {
        openId: claims.openId,
        appId: claims.appId,
        name: claims.name,
        absExp,
        rmb: claims.rmb,
      },
      ENV.cookieSecret,
      now,
    );
    return { user: resolved, refreshedToken, refreshMaxAgeMs: absExp - now };
  }
}

export const sdk = new SDKServer();
