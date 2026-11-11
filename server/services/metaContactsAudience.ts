/**
 * Nightly sync of CRM business contacts to a Meta Custom Audience (owner, Nov 11, 2026:
 * "nothing manual" — replaces the manual "Follow on social" tasks).
 *
 * Who is included: prospects the outreach workflow has emailed (still in good standing) and
 * commercial Contacts. Never included: opt-outs/bounces/DNC (crmOutreachSuppressions),
 * public bodies and schools, permanently excluded prospects, residential contacts.
 * Emails are normalized and SHA-256 hashed before they leave the server, as Meta requires;
 * Meta matches them privately and nobody looks up anyone's profile.
 *
 * Each night: every eligible hash is (re)added (idempotent on Meta's side) and every
 * suppressed address is removed, so an opt-out also leaves the audience within a day.
 */
import { createHash } from "node:crypto";
import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { customers, prospectWorkflowQueue as queue } from "../../drizzle/schema";
import { crmOutreachSuppressions } from "./outreachSuppression";
import { isExcludedProspect, isPublicBidEntity } from "./outreachProspectRules";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const GRAPH = "https://graph.facebook.com/v25.0";
export const AUDIENCE_NAME = "ME — CRM Business Contacts (auto-synced)";
/** Ad account that runs the ads (personal account "Ana Haynes"; Nov 11 the business account's ads sat in review). */
export const DEFAULT_AUDIENCE_AD_ACCOUNT = "1045370987135100";
const BATCH = 5000;
const GOOD_STATES = ["waiting", "nurture", "complete", "queued", "email_sending"];

export function normalizeEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
export const hashEmail = (normalized: string) => createHash("sha256").update(normalized).digest("hex");

export type Candidate = { email: string; name?: string | null; company?: string | null };
/** Eligible, de-duplicated normalized emails (pure; suppression set already lower-case). */
export function eligibleEmails(candidates: Candidate[], suppressed: Set<string>): string[] {
  const out = new Set<string>();
  for (const c of candidates) {
    const e = normalizeEmail(c.email ?? "");
    if (!e || suppressed.has(e)) continue;
    const who = { name: c.name ?? "", company: c.company ?? "", email: e };
    if (isPublicBidEntity(who) || isExcludedProspect(who)) continue;
    out.add(e);
  }
  return Array.from(out);
}

export type GraphCall = (method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, string>) => Promise<any>;

export function graphCaller(token: string, fetchImpl: typeof fetch = fetch): GraphCall {
  return async (method, path, body = {}) => {
    const params = new URLSearchParams({ access_token: token, ...body });
    const url = method === "GET" ? `${GRAPH}${path}?${params}` : `${GRAPH}${path}`;
    const res = await fetchImpl(url, method === "GET" ? undefined : { method, body: params });
    const json = await res.json();
    if (json?.error) throw new Error(`Meta API error: ${json.error.message} (code ${json.error.code}${json.error.error_subcode ? `/${json.error.error_subcode}` : ""})`);
    return json;
  };
}

export async function findOrCreateAudience(call: GraphCall, adAccountId: string): Promise<{ id: string; created: boolean }> {
  const act = `act_${adAccountId.replace(/^act_/, "")}`;
  const list = await call("GET", `/${act}/customaudiences`, { fields: "id,name", limit: "500" });
  const hit = (list?.data ?? []).find((a: any) => a.name === AUDIENCE_NAME);
  if (hit) return { id: String(hit.id), created: false };
  const made = await call("POST", `/${act}/customaudiences`, {
    name: AUDIENCE_NAME, subtype: "CUSTOM", customer_file_source: "USER_PROVIDED_ONLY",
    description: "Business contacts from the Mechanical Enterprise CRM (outreach prospects and commercial contacts). Synced nightly; opt-outs removed.",
  });
  return { id: String(made.id), created: true };
}

async function sendHashes(call: GraphCall, audienceId: string, method: "POST" | "DELETE", emails: string[]) {
  let received = 0;
  for (let i = 0; i < emails.length; i += BATCH) {
    const data = emails.slice(i, i + BATCH).map(hashEmail);
    const r = await call(method, `/${audienceId}/users`, { payload: JSON.stringify({ schema: "EMAIL_SHA256", data }) });
    received += Number(r?.num_received ?? data.length);
  }
  return received;
}

export type AudienceSyncResult = { audienceId: string; created: boolean; added: number; removed: number; eligible: number };

export async function syncContactsAudience(db: Db, call: GraphCall, adAccountId: string): Promise<AudienceSyncResult> {
  const suppressedRows = await db.select({ email: crmOutreachSuppressions.email }).from(crmOutreachSuppressions);
  const suppressed = new Set(suppressedRows.map(r => r.email.trim().toLowerCase()));

  const prospects = await db.select({ email: queue.email, name: queue.name, company: queue.company }).from(queue)
    .where(and(inArray(queue.state, GOOD_STATES), gte(queue.touchCount, 1))).limit(20000);
  const commercial = await db.select({ email: customers.email, name: customers.displayName, company: customers.companyName })
    .from(customers).where(and(eq(customers.type, "commercial"), isNotNull(customers.email), sql`${customers.email} <> ''`)).limit(20000);

  const eligible = eligibleEmails([...prospects, ...commercial.map(c => ({ ...c, email: c.email ?? "" }))], suppressed);
  const { id, created } = await findOrCreateAudience(call, adAccountId);
  const added = eligible.length ? await sendHashes(call, id, "POST", eligible) : 0;
  const toRemove = Array.from(suppressed).map(normalizeEmail).filter((e): e is string => Boolean(e));
  const removed = toRemove.length ? await sendHashes(call, id, "DELETE", toRemove) : 0;
  return { audienceId: id, created, added, removed, eligible: eligible.length };
}

/** Run at most once per Eastern calendar day (claimed in crmBackfillRuns). */
export async function claimDailyAudienceRun(db: Db, etDay: string): Promise<boolean> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS crmBackfillRuns (
    name varchar(64) NOT NULL PRIMARY KEY, ranAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, summary text NULL)`);
  const r = await db.execute(sql`INSERT IGNORE INTO crmBackfillRuns (name) VALUES (${`meta-audience-${etDay}`})`);
  return Number((r as any)?.[0]?.affectedRows ?? 0) === 1;
}
