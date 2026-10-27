import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { encrypt, decrypt } from "../_core/crypto";
import { gbpOAuthConnections } from "../../drizzle/schema";
import { GBP_SCOPE, getDedicatedGbpConfig, buildDedicatedGbpAuthorizeUrl } from "./gbpOAuthConfig";

const STATE_TTL = 10 * 60 * 1000;
function stateKey() {
  const secret = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("OAuth state signing key not configured");
  return secret;
}
export function startGbpAuthorization() {
  const value = "gbp." + Date.now() + "." + crypto.randomBytes(16).toString("hex");
  const mac = crypto.createHmac("sha256", stateKey()).update(value).digest("hex");
  return buildDedicatedGbpAuthorizeUrl(value + "." + mac);
}
export function verifyGbpState(state: string) {
  const match = /^(gbp\.(\d+)\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(state);
  if (!match || Math.abs(Date.now() - Number(match[2])) > STATE_TTL) return false;
  const expected = crypto.createHmac("sha256", stateKey()).update(match[1]).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(match[3], "hex"), Buffer.from(expected, "hex"));
}
async function exchange(body: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("GBP OAuth token exchange failed (HTTP " + response.status + ")");
  return response.json() as Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }>;
}
async function dbRequired() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}
export async function connectDedicatedGbp(code: string) {
  const cfg = getDedicatedGbpConfig();
  if (!cfg.configured) throw new Error("GBP OAuth not configured");
  const tokens = await exchange(new URLSearchParams({
    grant_type: "authorization_code", code, client_id: cfg.clientId,
    client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri,
  }));
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("Google did not return offline GBP access; reconnect with consent");
  if (!tokens.scope?.split(" ").includes(GBP_SCOPE)) throw new Error("Google did not grant business.manage");
  const db = await dbRequired();
  await db.insert(gbpOAuthConnections).values({
    id: 1, accessTokenEncrypted: encrypt(tokens.access_token),
    refreshTokenEncrypted: encrypt(tokens.refresh_token),
    expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000), scope: tokens.scope,
  }).onDuplicateKeyUpdate({ set: {
    accessTokenEncrypted: encrypt(tokens.access_token),
    refreshTokenEncrypted: encrypt(tokens.refresh_token),
    expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000), scope: tokens.scope,
  } });
}
export async function dedicatedGbpStatus() {
  const cfg = getDedicatedGbpConfig();
  try {
    const db = await dbRequired();
    const [row] = await db.select({ id: gbpOAuthConnections.id, expiresAt: gbpOAuthConnections.expiresAt })
      .from(gbpOAuthConnections).where(eq(gbpOAuthConnections.id, 1)).limit(1);
    return { configured: cfg.configured, connected: !!row, expiresAt: row?.expiresAt ?? null, reason: cfg.reason, storageReady: true };
  } catch {
    // Do not prevent OAuth authorization from starting because the token table is absent.
    // The callback still requires the migration before tokens can be persisted.
    return { configured: cfg.configured, connected: false, expiresAt: null, reason: cfg.reason, storageReady: false };
  }
}
export async function dedicatedGbpAccessToken(): Promise<string> {
  const db = await dbRequired();
  const [row] = await db.select().from(gbpOAuthConnections).where(eq(gbpOAuthConnections.id, 1)).limit(1);
  if (!row) throw new Error("Connect Google Business Profile in CRM Integrations");
  if (row.expiresAt.getTime() > Date.now() + 300000) return decrypt(row.accessTokenEncrypted);
  const cfg = getDedicatedGbpConfig();
  if (!cfg.configured) throw new Error("GBP OAuth credentials unavailable");
  const tokens = await exchange(new URLSearchParams({
    grant_type: "refresh_token", refresh_token: decrypt(row.refreshTokenEncrypted),
    client_id: cfg.clientId, client_secret: cfg.clientSecret,
  }));
  if (!tokens.access_token) throw new Error("GBP token refresh returned no access token");
  await db.update(gbpOAuthConnections).set({
    accessTokenEncrypted: encrypt(tokens.access_token),
    expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
  }).where(eq(gbpOAuthConnections.id, 1));
  return tokens.access_token;
}
