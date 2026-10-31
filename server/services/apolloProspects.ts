/**
 * Apollo.io as a prospect source for private-sector decision-makers (owner, Oct 29).
 *
 * Why: private companies rarely publish staff emails, so web search alone found ~1 verified
 * private-sector lead per hour. Apollo's People Search is free (0 credits) and filters by
 * title + location; People Enrichment reveals a work email for 1 credit, charged only when
 * data is found. Only emails Apollo marks `verified` are used.
 *
 * Off unless APOLLO_API_KEY is set. Bounded by APOLLO_DAILY_REVEALS (default 150/day,
 * about 3,300/month, inside the 4,000-credit Professional plan). Never reveals personal
 * emails or mobile phones. Public bodies/schools and all permanent exclusions are skipped
 * BEFORE any credit is spent, and every person is revealed at most once ever.
 *
 * Docs: https://docs.apollo.io/reference/people-api-search (POST /api/v1/mixed_people/api_search)
 *       https://docs.apollo.io/reference/people-enrichment   (POST /api/v1/people/match)
 */
import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import type { ResearchedProspect } from "../../shared/prospectWorkflow";
import { easternParts } from "../../shared/prospectCadence";
import { isDirectBusinessEmail, isExcludedProspect, isPublicBidEntity } from "./outreachProspectRules";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const BASE = "https://api.apollo.io/api/v1";

export function apolloEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.APOLLO_API_KEY?.trim());
}
export function apolloDailyReveals(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.APOLLO_DAILY_REVEALS);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, 500) : 150;
}

/** Private-sector buyer segments, rotated by hour. Titles are Apollo job-title filters. */
export const APOLLO_SEGMENTS: ReadonlyArray<{ label: string; titles: string[] }> = [
  { label: "property & community managers", titles: ["property manager", "senior property manager", "portfolio manager", "community manager", "regional property manager"] },
  { label: "facilities & building engineering", titles: ["facilities manager", "facilities director", "director of facilities", "building engineer", "chief engineer", "director of engineering"] },
  { label: "commercial real estate owners & asset managers", titles: ["asset manager", "owner", "principal", "managing partner", "vice president of real estate"] },
  { label: "operations & maintenance leaders", titles: ["operations manager", "director of operations", "maintenance manager", "maintenance director", "plant manager"] },
];
/** North Jersey cities used as person-location filters (Apollo accepts "City, State"). */
export const APOLLO_LOCATIONS = [
  "Newark, New Jersey", "Jersey City, New Jersey", "Hackensack, New Jersey", "Paramus, New Jersey",
  "Morristown, New Jersey", "Parsippany, New Jersey", "Elizabeth, New Jersey", "Union, New Jersey",
  "Edison, New Jersey", "New Brunswick, New Jersey", "Clifton, New Jersey", "Wayne, New Jersey",
  "Paterson, New Jersey", "Secaucus, New Jersey", "Fort Lee, New Jersey", "Livingston, New Jersey",
  "Bridgewater, New Jersey", "Somerset, New Jersey", "Montclair, New Jersey", "Hoboken, New Jersey",
] as const;

export function apolloQuery(now: Date, attempt: number) {
  const p = easternParts(now);
  const day = Math.floor(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000);
  const segment = APOLLO_SEGMENTS[(p.hour + attempt) % APOLLO_SEGMENTS.length];
  // Three cities per search, shifted each hour/attempt so the day walks through all of them.
  const start = (day * 7 + p.hour * 3 + attempt * 3) % APOLLO_LOCATIONS.length;
  const locations = [0, 1, 2].map(i => APOLLO_LOCATIONS[(start + i) % APOLLO_LOCATIONS.length]);
  const page = 1 + ((day + attempt) % 5);
  return { segment, locations, page };
}

type SearchPerson = { id: string; first_name?: string; title?: string | null; has_email?: boolean; organization?: { name?: string } | null };
type MatchPerson = {
  id?: string; first_name?: string; last_name?: string; name?: string; title?: string | null;
  email?: string | null; email_status?: string | null; linkedin_url?: string | null;
  city?: string | null; state?: string | null;
  organization?: { name?: string | null; primary_domain?: string | null; website_url?: string | null; phone?: string | null } | null;
};
export class ApolloError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "ApolloError"; }
}

function qs(params: Record<string, string | number | string[]>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (Array.isArray(v)) for (const x of v) u.append(`${k}[]`, x); else u.append(k, String(v));
  return u.toString();
}

export function createApolloClient(apiKey: string, fetchImpl: typeof fetch = fetch) {
  const call = async (path: string, params: Record<string, string | number | string[]>) => {
    const r = await fetchImpl(`${BASE}/${path}?${qs(params)}`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      // Apollo's own error text (e.g. plan or scope) is safe to log; it never echoes the key.
      const detail = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
      const base = r.status === 429 ? "Apollo rate limit reached"
        : r.status === 401 || r.status === 403 ? "Apollo key rejected or endpoint not in the key's scope"
        : r.status === 402 || r.status === 422 ? "Apollo plan or credits do not allow this request"
        : "Apollo request failed";
      throw new ApolloError(r.status, `${base} (HTTP ${r.status}, ${path})${detail ? `: ${detail}` : ""}`);
    }
    return r.json() as Promise<any>;
  };
  return {
    /** Free: people in the given roles and places who have a verified email on file. */
    async search(titles: string[], locations: readonly string[], page: number): Promise<SearchPerson[]> {
      const r = await call("mixed_people/api_search", {
        "person_titles": titles, "person_locations": [...locations],
        "contact_email_status": ["verified"], "organization_num_employees_ranges": ["11,10000"],
        page, per_page: 25,
      });
      return Array.isArray(r?.people) ? r.people : [];
    },
    /** 1 credit when data is found. Work email only: never personal emails or mobile phones. */
    /** 1 credit when found: look a known contact up by work email (past-lead enrichment). */
    async matchByEmail(email: string): Promise<MatchPerson | null> {
      const r = await call("people/match", { email, reveal_personal_emails: "false", reveal_phone_number: "false" });
      return r?.person ?? null;
    },
    async reveal(id: string): Promise<MatchPerson | null> {
      const r = await call("people/match", { id, reveal_personal_emails: "false", reveal_phone_number: "false" });
      return r?.person ?? null;
    },
  };
}
export type ApolloClient = ReturnType<typeof createApolloClient>;

/**
 * Apollo returns LinkedIn profile URLs as "http://www.linkedin.com/in/<slug>". Accept http or
 * https (with or without www / a country subdomain) and return https://www.linkedin.com/in/<slug>.
 */
export function normalizeLinkedIn(url: string | null | undefined): string | null {
  const m = /^https?:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec((url ?? "").trim());
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

/** Turn an enrichment result into a prospect, or null with the reason it was rejected. */
export function apolloToProspect(p: MatchPerson): { prospect: ResearchedProspect & { phone?: string }; reason?: never } | { prospect?: never; reason: string } {
  const email = (p.email ?? "").trim().toLowerCase();
  const name = (p.name || [p.first_name, p.last_name].filter(Boolean).join(" ")).trim();
  const company = (p.organization?.name ?? "").trim();
  const title = (p.title ?? "").trim();
  if (p.email_status !== "verified") return { reason: "email not verified by Apollo" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isDirectBusinessEmail(email)) return { reason: "no direct business email" };
  if (name.split(/\s+/).length < 2 || !company || !title) return { reason: "incomplete identity" };
  if (isPublicBidEntity({ email, company })) return { reason: "public body or school" };
  if (isExcludedProspect({ name, company, email })) return { reason: "excluded" };
  const source = normalizeLinkedIn(p.linkedin_url) ?? `https://app.apollo.io/#/people/${encodeURIComponent(p.id ?? "")}`;
  const digits = (p.organization?.phone ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return {
    prospect: {
      name, title, company, email,
      verificationUrl: source,
      evidence: `Apollo.io verified work email for ${name}, ${title} at ${company}${p.city ? ` (${p.city}${p.state ? `, ${p.state}` : ""})` : ""}: ${email}`,
      reason: "Private-sector building, property or facilities decision-maker in North Jersey",
      ...(digits.length === 10 ? { phone: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` } : {}),
    },
  };
}

// ── Durable state: each person revealed at most once; daily credit cap ───────
let ready: Promise<unknown> | undefined;
async function ensureApolloStore(db: Db) {
  ready ??= Promise.all([
    db.execute(sql`CREATE TABLE IF NOT EXISTS apolloPeopleSeen (
      personId varchar(64) NOT NULL PRIMARY KEY, outcome varchar(40) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.execute(sql`CREATE TABLE IF NOT EXISTS apolloRevealBudget (
      day date NOT NULL, slot int NOT NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (day, slot))`),
  ]).catch(e => { ready = undefined; throw e; });
  await ready;
}
export type ApolloStore = {
  claimPerson(id: string): Promise<boolean>;
  markPerson(id: string, outcome: string): Promise<void>;
  reserveReveal(now: Date): Promise<boolean>;
};
export function createApolloStore(db: Db, env: NodeJS.ProcessEnv = process.env): ApolloStore {
  const affected = (r: unknown) => Number((r as any)?.[0]?.affectedRows ?? 0);
  return {
    async claimPerson(id) {
      await ensureApolloStore(db);
      return affected(await db.execute(sql`INSERT IGNORE INTO apolloPeopleSeen (personId) VALUES (${id})`)) === 1;
    },
    async markPerson(id, outcome) {
      await db.execute(sql`UPDATE apolloPeopleSeen SET outcome = ${outcome.slice(0, 40)} WHERE personId = ${id}`);
    },
    async reserveReveal(now) {
      await ensureApolloStore(db);
      const limit = apolloDailyReveals(env);
      const p = easternParts(now);
      const day = `${p.year}-${p.month}-${p.day}`;
      for (let slot = 1; slot <= limit; slot++)
        if (affected(await db.execute(sql`INSERT IGNORE INTO apolloRevealBudget (day, slot) VALUES (${day}, ${slot})`)) === 1) return true;
      return false;
    },
  };
}

/**
 * Find up to `needed` new prospects. `accept` saves one (returns true when it was new and
 * queued). Stops at `needed`, the daily credit cap, or after `maxSearches` searches.
 */
export async function findApolloProspects(input: {
  client: ApolloClient; store: ApolloStore; now: Date; needed: number; maxSearches?: number; attemptOffset?: number;
  knownCompanies: Set<string>;
  accept: (p: ResearchedProspect & { phone?: string }) => Promise<boolean>;
}): Promise<{ added: number; searched: number; revealed: number; rejected: Record<string, number>; capped: boolean }> {
  const out = { added: 0, searched: 0, revealed: 0, rejected: {} as Record<string, number>, capped: false };
  const reject = (r: string) => { out.rejected[r] = (out.rejected[r] ?? 0) + 1; };
  const companiesThisRun = new Set<string>();
  const norm = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(llc|inc|corp|co|company|group|the|ltd|lp)\b/g, " ").replace(/\s+/g, " ").trim();
  for (let attempt = 0; attempt < (input.maxSearches ?? 3) && out.added < input.needed && !out.capped; attempt++) {
    const q = apolloQuery(input.now, attempt + (input.attemptOffset ?? 0));
    const people = await input.client.search(q.segment.titles, q.locations, q.page);
    out.searched++;
    for (const person of people) {
      if (out.added >= input.needed) break;
      if (!person?.id || person.has_email === false) continue;
      const orgName = person.organization?.name ?? "";
      // Free pre-checks: never spend a credit on a public body, a company already worked, or a repeat.
      if (orgName && isPublicBidEntity({ company: orgName })) { reject("public body or school"); continue; }
      const orgKey = norm(orgName);
      if (orgKey && (companiesThisRun.has(orgKey) || input.knownCompanies.has(orgKey))) { reject("company already in outreach"); continue; }
      if (!(await input.store.claimPerson(person.id))) { reject("already revealed before"); continue; }
      if (!(await input.store.reserveReveal(input.now))) { out.capped = true; await input.store.markPerson(person.id, "budget"); break; }
      const match = await input.client.reveal(person.id);
      out.revealed++;
      const result = match ? apolloToProspect(match) : { reason: "no match" as const };
      if (!result.prospect) { reject(result.reason); await input.store.markPerson(person.id, result.reason); continue; }
      const queued = await input.accept(result.prospect);
      await input.store.markPerson(person.id, queued ? "queued" : "duplicate");
      if (queued) { out.added++; companiesThisRun.add(norm(result.prospect.company)); } else reject("already in CRM queue");
    }
  }
  return out;
}
