/**
 * Google Calendar provider (Task 8).
 *
 * Scope: OAuth connect/disconnect/status, token refresh, and event
 * create/update/cancel so CRM appointments mirror into a Google Calendar.
 * When connected, event writes use sendUpdates=all so Google emails the
 * invites/updates/cancellations to attendees natively.
 *
 * Token safety: access/refresh tokens are AES-256-GCM encrypted at rest and
 * NEVER logged or returned to the client.
 */
import crypto from "crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  googleCalendarConnections,
  type GoogleCalendarConnection,
} from "../../../drizzle/schema";
import { encrypt, decrypt, isEncryptionConfigured } from "../../_core/crypto";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";
/** Refresh the access token when fewer than this many ms remain. */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;
export const DEFAULT_TIMEZONE = "America/New_York";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGoogleConfig(): GoogleConfig {
  return {
    // Reuse the shared Google OAuth client (also used by Google Ads).
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || "",
  };
}

// ── Signed OAuth state (CSRF) ───────────────────────────────────────────────
function stateSecret(): string {
  return process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || "google-calendar-state-fallback";
}

export function signState(nonce: string = crypto.randomBytes(16).toString("hex")): string {
  const mac = crypto.createHmac("sha256", stateSecret()).update(nonce).digest("hex");
  return `${nonce}.${mac}`;
}

export function verifyState(state: string | undefined | null): boolean {
  if (!state || !state.includes(".")) return false;
  const [nonce, mac] = state.split(".");
  if (!nonce || !mac) return false;
  const expected = crypto.createHmac("sha256", stateSecret()).update(nonce).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function buildAuthorizeUrl(cfg: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Force a refresh_token even on re-consent (Google omits it otherwise).
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ── Token exchange / refresh ────────────────────────────────────────────────
export interface TokenSet {
  accessToken: string;
  /** Present on authorization_code; absent on refresh (Google keeps the same one). */
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
}

export function parseTokenResponse(json: Record<string, unknown>): TokenSet {
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("Google token response missing access_token");
  return {
    accessToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: Number(json.expires_in ?? 3600),
    scope: json.scope ? String(json.scope) : undefined,
  };
}

type FetchImpl = typeof fetch;

export async function requestTokens(
  cfg: GoogleConfig,
  grant: { type: "authorization_code"; code: string } | { type: "refresh_token"; refreshToken: string },
  fetchImpl: FetchImpl = fetch,
): Promise<TokenSet> {
  const body =
    grant.type === "authorization_code"
      ? new URLSearchParams({
          grant_type: "authorization_code",
          code: grant.code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
        })
      : new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: grant.refreshToken,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        });

  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return parseTokenResponse((await res.json()) as Record<string, unknown>);
}

async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

// ── Pure event mapping (unit-tested) ────────────────────────────────────────
export interface CalendarEventInput {
  summary: string;
  description?: string | null;
  location?: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  attendees: { email: string; name?: string | null }[];
  timeZone?: string;
}

/** Map a normalized appointment into a Google Calendar event resource. */
export function mapToGoogleEvent(input: CalendarEventInput): Record<string, unknown> {
  const tz = input.timeZone ?? DEFAULT_TIMEZONE;
  const end = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60_000);
  return {
    summary: input.summary,
    ...(input.description ? { description: input.description } : {}),
    ...(input.location ? { location: input.location } : {}),
    start: { dateTime: input.scheduledAt.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    attendees: input.attendees.map(a => ({ email: a.email, ...(a.name ? { displayName: a.name } : {}) })),
    reminders: { useDefault: true },
  };
}

export interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  googleAccountEmail?: string | null;
  googleCalendarId?: string | null;
  connectedAt?: Date | null;
  expiresAt?: Date | null;
  lastRefreshAt?: Date | null;
  lastSyncAt?: Date | null;
  status?: "connected" | "expired" | "revoked" | "error" | null;
  lastError?: string | null;
}

// ── Provider ────────────────────────────────────────────────────────────────
export class GoogleCalendarProvider {
  readonly name = "google_calendar";

  private cfg(): GoogleConfig {
    return getGoogleConfig();
  }

  private async db() {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db;
  }

  /** The single active connection row, or null. */
  async getConnection(): Promise<GoogleCalendarConnection | null> {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(googleCalendarConnections)
      .orderBy(desc(googleCalendarConnections.connectedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async isConnected(): Promise<boolean> {
    const conn = await this.getConnection();
    return Boolean(conn && conn.status === "connected");
  }

  async getStatus(): Promise<GoogleStatus> {
    const cfg = this.cfg();
    const configured = isEncryptionConfigured() && Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
    const conn = await this.getConnection();
    if (!conn) return { connected: false, configured };
    return {
      connected: conn.status === "connected",
      configured,
      googleAccountEmail: conn.googleAccountEmail,
      googleCalendarId: conn.googleCalendarId,
      connectedAt: conn.connectedAt,
      expiresAt: conn.expiresAt,
      lastRefreshAt: conn.lastRefreshAt,
      lastSyncAt: conn.lastSyncAt,
      status: conn.status,
      lastError: conn.lastError,
    };
  }

  async connect(input: { code: string }): Promise<GoogleStatus> {
    const cfg = this.cfg();
    const tokens = await requestTokens(cfg, { type: "authorization_code", code: input.code });
    if (!tokens.refreshToken) {
      throw new Error("Google did not return a refresh token — revoke access and reconnect with consent.");
    }
    const email = (await fetchAccountEmail(tokens.accessToken)) ?? "unknown";
    const now = new Date();
    const patch = {
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: encrypt(tokens.refreshToken),
      expiresAt: new Date(now.getTime() + tokens.expiresIn * 1000),
      scope: tokens.scope ?? SCOPE,
      lastRefreshAt: now,
      status: "connected" as const,
      lastError: null as string | null,
    };

    const db = await this.db();
    const existing = await db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.googleAccountEmail, email))
      .limit(1);
    if (existing[0]) {
      await db
        .update(googleCalendarConnections)
        .set({ ...patch, connectedAt: now })
        .where(eq(googleCalendarConnections.googleAccountEmail, email));
    } else {
      await db.insert(googleCalendarConnections).values({
        googleAccountEmail: email,
        googleCalendarId: "primary",
        ...patch,
        connectedAt: now,
      });
    }
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    const conn = await this.getConnection();
    if (!conn) return;
    try {
      const refreshToken = decrypt(conn.refreshTokenEncrypted);
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch {
      /* ignore — still remove the local connection */
    }
    const db = await this.db();
    await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.id, conn.id));
  }

  /**
   * Return a valid access token, refreshing when within REFRESH_SKEW_MS of
   * expiry. Google refresh responses do NOT return a new refresh token, so the
   * stored one is preserved. ALL Calendar API calls go through this.
   */
  async getValidAccessToken(): Promise<{ accessToken: string; calendarId: string }> {
    const conn = await this.getConnection();
    if (!conn) throw new Error("Google Calendar is not connected");

    const remaining = conn.expiresAt.getTime() - Date.now();
    if (remaining > REFRESH_SKEW_MS && conn.status === "connected") {
      return { accessToken: decrypt(conn.accessTokenEncrypted), calendarId: conn.googleCalendarId };
    }

    const cfg = this.cfg();
    const db = await this.db();
    try {
      const refreshToken = decrypt(conn.refreshTokenEncrypted);
      const tokens = await requestTokens(cfg, { type: "refresh_token", refreshToken });
      await db
        .update(googleCalendarConnections)
        .set({
          accessTokenEncrypted: encrypt(tokens.accessToken),
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          lastRefreshAt: new Date(),
          status: "connected",
          lastError: null,
        })
        .where(eq(googleCalendarConnections.id, conn.id));
      return { accessToken: tokens.accessToken, calendarId: conn.googleCalendarId };
    } catch (e) {
      await db
        .update(googleCalendarConnections)
        .set({ status: "expired", lastError: `Token refresh failed: ${(e as Error).message}` })
        .where(eq(googleCalendarConnections.id, conn.id));
      throw new Error("Google Calendar token refresh failed — reconnect required");
    }
  }

  private async calFetch(path: string, init?: RequestInit): Promise<Response> {
    const { accessToken, calendarId } = await this.getValidAccessToken();
    const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  }

  /** Create an event; sendUpdates=all makes Google email the invites. */
  async createEvent(event: Record<string, unknown>): Promise<{ id: string; calendarId: string; htmlLink?: string }> {
    const { calendarId } = await this.getValidAccessToken();
    const res = await this.calFetch(`/events?sendUpdates=all`, { method: "POST", body: JSON.stringify(event) });
    if (!res.ok) throw new Error(`Google create event failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { id: string; htmlLink?: string };
    return { id: json.id, calendarId, htmlLink: json.htmlLink };
  }

  /** Full update of an existing event (also notifies attendees). */
  async updateEvent(eventId: string, event: Record<string, unknown>): Promise<{ id: string; htmlLink?: string }> {
    const res = await this.calFetch(`/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: "PUT",
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`Google update event failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { id: string; htmlLink?: string };
    return { id: json.id, htmlLink: json.htmlLink };
  }

  /** Cancel (delete) an event; sendUpdates=all sends cancellation notices. */
  async cancelEvent(eventId: string): Promise<void> {
    const res = await this.calFetch(`/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE" });
    // 410 Gone = already deleted; treat as success.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google cancel event failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }

  async touchLastSync(): Promise<void> {
    const conn = await this.getConnection();
    if (!conn) return;
    const db = await this.db();
    await db
      .update(googleCalendarConnections)
      .set({ lastSyncAt: new Date() })
      .where(eq(googleCalendarConnections.id, conn.id));
  }
}

export const googleCalendarProvider = new GoogleCalendarProvider();
