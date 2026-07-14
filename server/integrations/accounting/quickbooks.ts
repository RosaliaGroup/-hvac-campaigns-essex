/**
 * QuickBooks Online provider (Task 7) — first AccountingProvider implementation.
 *
 * Scope: OAuth connect/disconnect/status, token refresh with rotation, and
 * customer push/pull with merge protection. Estimates/invoices/payments and
 * webhooks are intentionally out of scope (interface stubs throw).
 *
 * Token safety: access/refresh tokens are AES-256-GCM encrypted at rest and
 * NEVER logged or returned to the client.
 */
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  quickbooksConnections,
  quickbooksSyncLogs,
  type QuickbooksConnection,
  type InsertQuickbooksSyncLog,
} from "../../../drizzle/schema";
import { encrypt, decrypt, isEncryptionConfigured } from "../../_core/crypto";
import { normalizePhone } from "../../routers/customers";
import type { QboEstimate, QboCustomerLite } from "./estimates";
import type { QboInvoice } from "./invoices";
import { resilientFetch, type QboFetchLogEntry } from "./qboHttp";
import {
  NotImplementedError,
  type AccountingProvider,
  type AccountingCustomerInput,
  type ConnectInput,
  type ConflictResolution,
  type ProviderEnvironment,
  type ProviderStatus,
  type PullCustomerResult,
  type PushCustomerResult,
  type RemoteCustomerSummary,
} from "./types";

/**
 * Structured log line for every QBO HTTP attempt (duration + request id +
 * outcome). The entry deliberately carries no auth material — the bearer token
 * lives only in the request headers and is never included here.
 */
function logQboHttp(entry: QboFetchLogEntry): void {
  console.log(JSON.stringify({ tag: "[QboHttp]", ...entry }));
}

// ── Constants (same host for sandbox + production; only the API base differs) ──
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const SCOPE = "com.intuit.quickbooks.accounting";
const MINOR_VERSION = "70";
/** Refresh the access token when fewer than this many ms remain. */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface QboConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: ProviderEnvironment;
}

export function getQboConfig(): QboConfig {
  const environment: ProviderEnvironment =
    process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    clientId: process.env.QUICKBOOKS_CLIENT_ID ?? "",
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET ?? "",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI ?? "",
    environment,
  };
}

export function qboApiBase(env: ProviderEnvironment): string {
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// ── Signed OAuth state (nonce) ──────────────────────────────────────────────
function stateSecret(): string {
  return process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || "quickbooks-state-fallback";
}

/** state = "<nonce>.<hmac>" — verified on callback to defeat CSRF/forged codes. */
export function signState(nonce: string = crypto.randomBytes(16).toString("hex")): string {
  const mac = crypto.createHmac("sha256", stateSecret()).update(nonce).digest("hex");
  return `${nonce}.${mac}`;
}

export function verifyState(state: string | undefined | null): boolean {
  if (!state || !state.includes(".")) return false;
  const [nonce, mac] = state.split(".");
  if (!nonce || !mac) return false;
  const expected = crypto.createHmac("sha256", stateSecret()).update(nonce).digest("hex");
  // Constant-time compare.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function buildAuthorizeUrl(cfg: QboConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ── Token exchange / refresh ────────────────────────────────────────────────
export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** seconds */
  expiresIn: number;
  /** seconds (refresh token lifetime, ~100 days) */
  refreshExpiresIn: number;
}

export function parseTokenResponse(json: Record<string, unknown>): TokenSet {
  const accessToken = String(json.access_token ?? "");
  const refreshToken = String(json.refresh_token ?? "");
  if (!accessToken || !refreshToken) {
    throw new Error("QuickBooks token response missing access_token or refresh_token");
  }
  return {
    accessToken,
    refreshToken,
    expiresIn: Number(json.expires_in ?? 3600),
    refreshExpiresIn: Number(json.x_refresh_token_expires_in ?? 8726400),
  };
}

type FetchImpl = typeof fetch;

/** Exchange an authorization code or a refresh token for a fresh TokenSet. */
export async function requestTokens(
  cfg: QboConfig,
  grant:
    | { type: "authorization_code"; code: string }
    | { type: "refresh_token"; refreshToken: string },
  fetchImpl: FetchImpl = fetch,
): Promise<TokenSet> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const body =
    grant.type === "authorization_code"
      ? new URLSearchParams({ grant_type: "authorization_code", code: grant.code, redirect_uri: cfg.redirectUri })
      : new URLSearchParams({ grant_type: "refresh_token", refresh_token: grant.refreshToken });

  // Timeout-only (maxRetries: 0): a refresh grant rotates the refresh token, so
  // a retry could race a rotation and brick the connection.
  const res = await resilientFetch(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    },
    { label: "/oauth2/token", maxRetries: 0, fetchImpl, log: logQboHttp },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QuickBooks token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return parseTokenResponse(json);
}

/**
 * Build the DB field patch for a fresh/rotated token set.
 * CRITICAL: QuickBooks rotates the refresh token on EVERY refresh — the new
 * one is persisted here; failing to store it bricks the connection.
 */
export function buildConnectionUpdate(tokens: TokenSet, now: Date = new Date()) {
  return {
    accessTokenEncrypted: encrypt(tokens.accessToken),
    refreshTokenEncrypted: encrypt(tokens.refreshToken),
    expiresAt: new Date(now.getTime() + tokens.expiresIn * 1000),
    refreshExpiresAt: new Date(now.getTime() + tokens.refreshExpiresIn * 1000),
    lastRefreshAt: now,
    status: "connected" as const,
    lastError: null as string | null,
  };
}

// ── Pure mapping / matching helpers (unit-tested) ───────────────────────────

/** Minimal shape of a QBO Customer we read back from queries. */
export interface QboCustomer {
  Id: string;
  DisplayName?: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  Active?: boolean;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
}

/**
 * Collapse a phrase that is the SAME words repeated twice into a single copy,
 * e.g. "QBO Test Customer QBO Test Customer" → "QBO Test Customer". Guards the
 * common bug where a stored displayName duplicated first+last (or the whole
 * name) and got pushed to QBO verbatim.
 */
export function collapseRepeatedPhrase(value: string): string {
  const words = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const a = words.slice(0, half).join(" ");
    const b = words.slice(half).join(" ");
    if (a.toLowerCase() === b.toLowerCase()) return a;
  }
  return words.join(" ");
}

/** Join first + last, dropping a duplicate when they are identical. */
function personName(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f && l) return f.toLowerCase() === l.toLowerCase() ? f : `${f} ${l}`;
  return f || l;
}

/**
 * Pick a clean QBO DisplayName: commercial → company name, residential →
 * person name, always de-duplicated. Falls back to the stored displayName
 * (also de-duplicated) and finally "Customer" so a name is never empty.
 */
export function resolveDisplayName(c: AccountingCustomerInput): string {
  const company = c.companyName?.trim() || "";
  const person = personName(c.firstName, c.lastName);
  const stored = collapseRepeatedPhrase(c.displayName ?? "");
  const chosen = c.type === "commercial" ? company || person || stored : person || company || stored;
  return collapseRepeatedPhrase(chosen) || "Customer";
}

/** Build a QBO physical address resource, or null when there's nothing to send. */
export function buildQboAddress(a: AccountingCustomerInput["address"]): Record<string, unknown> | null {
  if (!a) return null;
  const addr: Record<string, unknown> = {};
  if (a.line1) addr.Line1 = a.line1;
  if (a.line2) addr.Line2 = a.line2;
  if (a.city) addr.City = a.city;
  if (a.state) addr.CountrySubDivisionCode = a.state;
  if (a.zip) addr.PostalCode = a.zip;
  return Object.keys(addr).length ? addr : null;
}

/** Map a local customer → QBO Customer create/update payload. */
export function mapCustomerToQbo(c: AccountingCustomerInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    DisplayName: resolveDisplayName(c),
  };
  const first = c.firstName?.trim();
  const last = c.lastName?.trim();
  if (first) payload.GivenName = first;
  // Only set FamilyName when it adds information (not a duplicate of GivenName).
  if (last && last.toLowerCase() !== (first ?? "").toLowerCase()) payload.FamilyName = last;
  if (c.companyName?.trim()) payload.CompanyName = c.companyName.trim();
  if (c.email) payload.PrimaryEmailAddr = { Address: c.email };
  if (c.phone) payload.PrimaryPhone = { FreeFormNumber: c.phone };
  const addr = buildQboAddress(c.address);
  if (addr) {
    payload.BillAddr = addr;
    // QBO keeps billing/shipping separate; mirror bill → ship so both are populated.
    payload.ShipAddr = { ...addr };
  }
  if (c.notes?.trim()) payload.Notes = c.notes.trim();
  return payload;
}

export type CustomerPushPlan =
  | { action: "update-by-id"; qbId: string }
  | { action: "match" };

/**
 * Decide how to push a customer (pure, unit-tested):
 *  - already linked (existingRemoteId set) → update THAT record by id;
 *  - otherwise → run duplicate matching.
 * A linked customer NEVER routes to match/create, so re-pushing a synced
 * customer can't spawn a duplicate in QuickBooks.
 */
export function planCustomerPush(customer: AccountingCustomerInput): CustomerPushPlan {
  const id = customer.existingRemoteId?.trim();
  return id ? { action: "update-by-id", qbId: id } : { action: "match" };
}

export interface MergeMatch {
  matchedBy: "email" | "phone" | "name";
  candidate: QboCustomer;
}

/**
 * Decide whether any QBO candidate is the same person/business as the local
 * customer. Priority: email > phone > exact display name. Returns null if none.
 */
export function pickMergeMatch(c: AccountingCustomerInput, candidates: QboCustomer[]): MergeMatch | null {
  const emailKey = c.email?.trim().toLowerCase() || null;
  const phoneKey = normalizePhone(c.phone);
  const nameKey = c.displayName?.trim().toLowerCase() || null;

  const byEmail = emailKey
    ? candidates.find(q => (q.PrimaryEmailAddr?.Address ?? "").trim().toLowerCase() === emailKey)
    : undefined;
  if (byEmail) return { matchedBy: "email", candidate: byEmail };

  const byPhone = phoneKey
    ? candidates.find(q => normalizePhone(q.PrimaryPhone?.FreeFormNumber) === phoneKey)
    : undefined;
  if (byPhone) return { matchedBy: "phone", candidate: byPhone };

  const byName = nameKey
    ? candidates.find(q => (q.DisplayName ?? "").trim().toLowerCase() === nameKey)
    : undefined;
  if (byName) return { matchedBy: "name", candidate: byName };

  return null;
}

export function toSummary(q: QboCustomer): RemoteCustomerSummary {
  return {
    qbId: q.Id,
    displayName: q.DisplayName ?? "",
    companyName: q.CompanyName ?? null,
    email: q.PrimaryEmailAddr?.Address ?? null,
    phone: q.PrimaryPhone?.FreeFormNumber ?? null,
    active: q.Active ?? true,
  };
}

/** QBO query-literal escaping (single quotes doubled). */
export function escapeQboLiteral(v: string): string {
  return v.replace(/'/g, "''");
}

// ── Sync-log writer (unit-tested) ───────────────────────────────────────────
export async function writeSyncLog(entry: InsertQuickbooksSyncLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(quickbooksSyncLogs).values(entry);
  } catch (e) {
    // Logging must never break the sync path.
    console.warn("[QuickBooks] Failed to write sync log:", (e as Error).message);
  }
}

// ── Provider ────────────────────────────────────────────────────────────────
export class QuickBooksProvider implements AccountingProvider {
  readonly name = "quickbooks";

  private cfg(): QboConfig {
    return getQboConfig();
  }

  private async db() {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db;
  }

  /** The single active connection row (one realm), or null. */
  async getConnection(): Promise<QuickbooksConnection | null> {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(quickbooksConnections)
      .orderBy(desc(quickbooksConnections.connectedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async getStatus(): Promise<ProviderStatus> {
    const cfg = this.cfg();
    const configured = isEncryptionConfigured() && Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
    const conn = await this.getConnection();
    if (!conn) {
      return { connected: false, provider: this.name, environment: cfg.environment, configured };
    }
    return {
      connected: conn.status === "connected",
      provider: this.name,
      environment: cfg.environment,
      realmId: conn.realmId,
      companyName: conn.companyName,
      connectedAt: conn.connectedAt,
      expiresAt: conn.expiresAt,
      refreshExpiresAt: conn.refreshExpiresAt,
      lastRefreshAt: conn.lastRefreshAt,
      lastSyncAt: conn.lastSyncAt,
      status: conn.status,
      lastError: conn.lastError,
      configured,
    };
  }

  async connect(input: ConnectInput): Promise<ProviderStatus> {
    const cfg = this.cfg();
    const tokens = await requestTokens(cfg, { type: "authorization_code", code: input.code });
    const now = new Date();
    const patch = buildConnectionUpdate(tokens, now);
    const companyName = await this.fetchCompanyName(input.realmId, tokens.accessToken).catch(() => null);

    const db = await this.db();
    const existing = await db
      .select()
      .from(quickbooksConnections)
      .where(eq(quickbooksConnections.realmId, input.realmId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(quickbooksConnections)
        .set({ ...patch, companyName: companyName ?? existing[0].companyName, connectedAt: now })
        .where(eq(quickbooksConnections.realmId, input.realmId));
    } else {
      await db.insert(quickbooksConnections).values({
        realmId: input.realmId,
        companyName,
        ...patch,
        connectedAt: now,
      });
    }
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    const conn = await this.getConnection();
    if (!conn) return;
    // Best-effort token revocation.
    try {
      const cfg = this.cfg();
      const refreshToken = decrypt(conn.refreshTokenEncrypted);
      const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
      await resilientFetch(
        REVOKE_URL,
        {
          method: "POST",
          headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
          body: JSON.stringify({ token: refreshToken }),
        },
        { label: "/oauth2/revoke", maxRetries: 0, log: logQboHttp },
      );
    } catch {
      /* ignore — we still remove the local connection */
    }
    const db = await this.db();
    await db.delete(quickbooksConnections).where(eq(quickbooksConnections.realmId, conn.realmId));
  }

  /**
   * Return a valid access token, refreshing (and persisting the rotated refresh
   * token) when it is within REFRESH_SKEW_MS of expiry. Marks status=expired on
   * refresh failure. ALL QBO API calls must go through this.
   */
  async getValidAccessToken(): Promise<{ accessToken: string; realmId: string }> {
    const conn = await this.getConnection();
    if (!conn) throw new Error("QuickBooks is not connected");

    const remaining = conn.expiresAt.getTime() - Date.now();
    if (remaining > REFRESH_SKEW_MS && conn.status === "connected") {
      return { accessToken: decrypt(conn.accessTokenEncrypted), realmId: conn.realmId };
    }

    // Refresh.
    const cfg = this.cfg();
    const db = await this.db();
    try {
      const refreshToken = decrypt(conn.refreshTokenEncrypted);
      const tokens = await requestTokens(cfg, { type: "refresh_token", refreshToken });
      const patch = buildConnectionUpdate(tokens);
      await db
        .update(quickbooksConnections)
        .set(patch)
        .where(eq(quickbooksConnections.realmId, conn.realmId));
      return { accessToken: tokens.accessToken, realmId: conn.realmId };
    } catch (e) {
      await db
        .update(quickbooksConnections)
        .set({ status: "expired", lastError: `Token refresh failed: ${(e as Error).message}` })
        .where(eq(quickbooksConnections.realmId, conn.realmId));
      throw new Error("QuickBooks token refresh failed — reconnect required");
    }
  }

  private async fetchCompanyName(realmId: string, accessToken: string): Promise<string | null> {
    const base = qboApiBase(this.cfg().environment);
    const res = await resilientFetch(
      `${base}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${MINOR_VERSION}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      { label: "/companyinfo", log: logQboHttp },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { CompanyInfo?: { CompanyName?: string } };
    return json.CompanyInfo?.CompanyName ?? null;
  }

  private async qboFetch(path: string, init?: RequestInit): Promise<Response> {
    const { accessToken, realmId } = await this.getValidAccessToken();
    const base = qboApiBase(this.cfg().environment);
    const sep = path.includes("?") ? "&" : "?";
    return resilientFetch(
      `${base}/v3/company/${realmId}${path}${sep}minorversion=${MINOR_VERSION}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      },
      { label: path.split("?")[0], log: logQboHttp },
    );
  }

  /** Query QBO for possible matches to a local customer (merge protection). */
  async findMatches(customer: AccountingCustomerInput): Promise<QboCustomer[]> {
    const found = new Map<string, QboCustomer>();
    const add = (list: QboCustomer[]) => list.forEach(q => q?.Id && found.set(q.Id, q));

    // Exact display-name query (indexed, supported by QBO query language).
    if (customer.displayName) {
      const q = `SELECT * FROM Customer WHERE DisplayName = '${escapeQboLiteral(customer.displayName)}'`;
      add(await this.runQuery(q));
    }
    // Email/phone aren't reliably filterable in QBO's query language, so pull a
    // bounded page of active customers and match in memory. Fine for SMB volumes;
    // revisit with change-data-capture if a company exceeds ~1000 customers.
    if (customer.email || customer.phone) {
      add(await this.runQuery("SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000"));
    }
    return Array.from(found.values());
  }

  private async runQuery(query: string): Promise<QboCustomer[]> {
    const res = await this.qboFetch(`/query?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { QueryResponse?: { Customer?: QboCustomer[] } };
    return json.QueryResponse?.Customer ?? [];
  }

  async pushCustomer(
    customer: AccountingCustomerInput,
    resolution?: ConflictResolution,
  ): Promise<PushCustomerResult> {
    // Already linked → update THAT QBO record by id; never match or create a
    // duplicate. (Falls through only if the linked record is gone from QBO.)
    const plan = planCustomerPush(customer);
    if (plan.action === "update-by-id") {
      const updated = await this.updateCustomerById(plan.qbId, customer);
      if (updated) return updated;
    }

    // Merge protection (skip when the caller already resolved a conflict).
    if (!resolution) {
      const candidates = await this.findMatches(customer);
      const match = pickMergeMatch(customer, candidates);
      if (match) {
        return { outcome: "conflict", matchedBy: match.matchedBy, candidate: toSummary(match.candidate) };
      }
      return this.createCustomer(customer);
    }

    if (resolution === "skip") {
      // Nothing to do; caller decides how to record it.
      const match = pickMergeMatch(customer, await this.findMatches(customer));
      return { outcome: "linked", qbId: match?.candidate.Id ?? "", summary: match ? toSummary(match.candidate) : undefined };
    }

    const match = pickMergeMatch(customer, await this.findMatches(customer));
    if (!match) return this.createCustomer(customer);

    if (resolution === "link") {
      return { outcome: "linked", qbId: match.candidate.Id, summary: toSummary(match.candidate) };
    }
    // resolution === "update": sparse update on the existing record, then link.
    return this.updateCustomer(match.candidate, customer);
  }

  private async createCustomer(customer: AccountingCustomerInput): Promise<PushCustomerResult> {
    const res = await this.qboFetch(`/customer`, { method: "POST", body: JSON.stringify(mapCustomerToQbo(customer)) });
    const json = (await res.json().catch(() => ({}))) as {
      Customer?: QboCustomer;
      Fault?: { Error?: Array<{ code?: string; Message?: string; Detail?: string }> };
    };
    if (!res.ok || json.Fault) {
      const err = json.Fault?.Error?.[0];
      // QBO code 6240 = "Duplicate Name Exists Error" — surface as a conflict, not a failure.
      if (err?.code === "6240" || /duplicate name/i.test(err?.Message ?? "")) {
        const match = pickMergeMatch(customer, await this.findMatches(customer));
        if (match) {
          return { outcome: "conflict", matchedBy: match.matchedBy, candidate: toSummary(match.candidate) };
        }
        return { outcome: "conflict", matchedBy: "name", candidate: { qbId: "", displayName: customer.displayName } };
      }
      throw new Error(`QuickBooks create failed: ${err?.Message ?? err?.Detail ?? res.status}`);
    }
    return { outcome: "created", qbId: json.Customer!.Id, summary: toSummary(json.Customer!) };
  }

  /**
   * Update an already-linked QBO customer by id (sparse update). Returns null
   * when the record no longer exists remotely, so the caller can fall back to
   * the normal create/match path (a re-create is not a duplicate).
   */
  private async updateCustomerById(qbId: string, customer: AccountingCustomerInput): Promise<PushCustomerResult | null> {
    const current = await this.readCustomer(qbId);
    if (!current) return null; // deleted/inactive remotely — not a duplicate to recreate
    const body = {
      ...mapCustomerToQbo(customer),
      Id: qbId,
      SyncToken: (current as unknown as { SyncToken?: string })?.SyncToken ?? "0",
      sparse: true,
    };
    const res = await this.qboFetch(`/customer`, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`QuickBooks update-by-id failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { Customer?: QboCustomer };
    return {
      outcome: "updated",
      qbId,
      summary: json.Customer ? toSummary(json.Customer) : { qbId, displayName: String(mapCustomerToQbo(customer).DisplayName ?? "") },
    };
  }

  private async updateCustomer(existing: QboCustomer, customer: AccountingCustomerInput): Promise<PushCustomerResult> {
    // Sparse update needs Id + SyncToken; re-read to get the current SyncToken.
    const current = await this.readCustomer(existing.Id);
    const body = {
      ...mapCustomerToQbo(customer),
      Id: existing.Id,
      SyncToken: (current as unknown as { SyncToken?: string })?.SyncToken ?? "0",
      sparse: true,
    };
    const res = await this.qboFetch(`/customer`, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`QuickBooks update failed: ${res.status}`);
    const json = (await res.json()) as { Customer?: QboCustomer };
    return { outcome: "updated", qbId: existing.Id, summary: json.Customer ? toSummary(json.Customer) : toSummary(existing) };
  }

  private async readCustomer(qbId: string): Promise<QboCustomer | null> {
    const res = await this.qboFetch(`/customer/${qbId}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { Customer?: QboCustomer };
    return json.Customer ?? null;
  }

  async pullCustomer(qbId: string): Promise<PullCustomerResult> {
    const q = await this.readCustomer(qbId);
    if (!q) {
      return { qbId, summary: { qbId, displayName: "" }, active: false };
    }
    return { qbId, summary: toSummary(q), active: q.Active ?? true };
  }

  async touchLastSync(): Promise<void> {
    const conn = await this.getConnection();
    if (!conn) return;
    const db = await this.db();
    await db
      .update(quickbooksConnections)
      .set({ lastSyncAt: new Date() })
      .where(eq(quickbooksConnections.realmId, conn.realmId));
  }

  // ── Sales documents (Estimates) — read-only mirror ──────────────────────────

  /**
   * Fetch one page of Estimates for the given QBO query string. Returns [] on a
   * non-OK response so a transient error skips the page rather than throwing
   * mid-sync (the orchestrator logs the run outcome).
   */
  async fetchEstimates(query: string): Promise<QboEstimate[]> {
    const res = await this.qboFetch(`/query?query=${encodeURIComponent(query)}`);
    if (!res.ok) {
      // FAIL CLOSED: a non-2xx here (incl. an exhausted-retry 429/502/503/504
      // returned by resilientFetch) must NOT read as "0 estimates" — that would
      // let the sync record success and advance the cursor over an unread
      // window. Throw so syncSalesDocuments writes a failed sync-log and the
      // cursor stays put. The message carries only the numeric status and at
      // most the first 200 chars of the response body — never the request URL,
      // Authorization header, or access token (none of which appear in the body).
      const body = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`QBO estimate query failed: ${res.status} ${body}`);
    }
    const json = (await res.json()) as { QueryResponse?: { Estimate?: QboEstimate[] } };
    return json.QueryResponse?.Estimate ?? [];
  }

  /**
   * Read one page of QBO Invoices. READ-ONLY. Fails closed exactly like
   * fetchEstimates: a non-2xx (incl. exhausted-retry 429/502/503/504) throws so
   * the invoice sync records a failure and leaves invoiceCursor put — never
   * reads as "0 invoices". Error carries only status + ≤200 body chars.
   */
  async fetchInvoices(query: string): Promise<QboInvoice[]> {
    const res = await this.qboFetch(`/query?query=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`QBO invoice query failed: ${res.status} ${body}`);
    }
    const json = (await res.json()) as { QueryResponse?: { Invoice?: QboInvoice[] } };
    return json.QueryResponse?.Invoice ?? [];
  }

  /** Read a full QBO Customer (for contact auto-creation). Null if absent. */
  async fetchQboCustomer(qbId: string): Promise<QboCustomerLite | null> {
    const res = await this.qboFetch(`/customer/${qbId}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { Customer?: QboCustomerLite };
    return json.Customer ?? null;
  }

  // ── Not implemented in Task 7 (interface stubs) ──
  async pushEstimate(): Promise<never> {
    throw new NotImplementedError("QuickBooks estimate push");
  }
  async pushInvoice(): Promise<never> {
    throw new NotImplementedError("QuickBooks invoice push");
  }
}

export const quickbooksProvider = new QuickBooksProvider();
