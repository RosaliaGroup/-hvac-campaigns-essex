/**
 * Weekly AI-visibility check (market-intel addition). For each of the 20 target queries, ask each CONFIGURED
 * engine — Perplexity (API), OpenAI (API, web search tool), Google AI Overviews (via SerpAPI, when
 * SEO_SERP_PROVIDER=serpapi) — and record whether Mechanical Enterprise is named, which competitors are, and
 * which sources are cited, one seoIntelAiVisibility row per (week, engine, query).
 *
 * Cost control: WEEKLY, never daily. A (week, engine, query) that already has a row is never re-asked, so a
 * re-run in the same ET week only fills gaps. Keys come from env and are logged presence-only.
 *
 * The engine HTTP clients take an injectable fetch and are tested against recorded response shapes. The
 * Google AI Overview adapter follows SerpAPI's documented response shape and is NOT verified against the live
 * API in this repo yet (no key is configured) — treat its first live run as the verification.
 */
import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { seoIntelAiVisibility } from "../../../../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * Create the missing AI-visibility observation table only. This is additive,
 * idempotent, and does not touch CRM or other SEO tables.
 */
async function ensureAiVisibilityTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<void> {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`seoIntelAiVisibility\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`weekOf\` varchar(10) NOT NULL,
    \`engine\` enum('perplexity','openai','google_ai_overview') NOT NULL,
    \`query\` varchar(512) NOT NULL,
    \`obsKey\` varchar(64) NOT NULL,
    \`status\` enum('ok','no_overview','error') NOT NULL DEFAULT 'ok',
    \`named\` tinyint(1) NOT NULL DEFAULT 0,
    \`citedUs\` tinyint(1) NOT NULL DEFAULT 0,
    \`namedAs\` varchar(255) DEFAULT NULL,
    \`competitors\` json DEFAULT NULL,
    \`otherCompanies\` json DEFAULT NULL,
    \`citedDomains\` json DEFAULT NULL,
    \`citations\` json DEFAULT NULL,
    \`excerpt\` text,
    \`error\` varchar(255) DEFAULT NULL,
    \`capturedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`seoIntelAiVisibility_key_uq\` (\`obsKey\`),
    KEY \`seoIntelAiVisibility_week_engine_idx\` (\`weekOf\`,\`engine\`)
  )`));
}


import { TARGET_QUERIES } from "../../../../shared/targetQueries";
import { COMPETITOR_WATCHLIST } from "../../../../shared/competitorWatchlist";
import {
  AI_ENGINES, analyzeAnswer, compareWeeks, summarizeWeek, weekStartET,
  type AiEngine, type AiVisibilitySection, type EngineAnswer, type Observation, type WeekSummary,
} from "../../../../shared/aiVisibility";

export type AskFn = (query: string) => Promise<EngineAnswer | "no_overview">;

const SYSTEM = "You are a helpful local-services assistant. Answer the question the way you would for a person in New Jersey, naming specific companies when relevant.";

export function enginesConfigured(env: NodeJS.ProcessEnv = process.env): AiEngine[] {
  const out: AiEngine[] = [];
  if (env.PERPLEXITY_API_KEY?.trim()) out.push("perplexity");
  if (env.OPENAI_API_KEY?.trim()) out.push("openai");
  if (env.SEO_SERP_PROVIDER?.trim().toLowerCase() === "serpapi" && (env.SERPAPI_KEY?.trim() || env.SEO_SERP_API_KEY?.trim())) out.push("google_ai_overview");
  return out;
}

async function json(res: Response, what: string): Promise<any> {
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${what} ${res.status}: ${t.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return res.json();
}

/** Perplexity chat completions: answer in choices[0].message.content, sources in `citations` (URLs) / `search_results`. */
export function makePerplexityAsk(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): AskFn {
  return async (query) => {
    const body = await json(await fetchImpl("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.PERPLEXITY_MODEL?.trim() || "sonar", messages: [{ role: "system", content: SYSTEM }, { role: "user", content: query }] }),
    }), "perplexity");
    const text: string = body?.choices?.[0]?.message?.content ?? "";
    const fromCitations: string[] = Array.isArray(body?.citations) ? body.citations.filter((c: unknown) => typeof c === "string") : [];
    const fromResults: string[] = Array.isArray(body?.search_results) ? body.search_results.map((r: { url?: string }) => r?.url).filter((u: unknown): u is string => typeof u === "string") : [];
    return { text, citations: Array.from(new Set([...fromCitations, ...fromResults])) };
  };
}

/** OpenAI Responses API with the web-search tool: text + url_citation annotations on the output message. */
export function makeOpenAiAsk(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): AskFn {
  return async (query) => {
    const body = await json(await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_VISIBILITY_MODEL?.trim() || "gpt-4.1", tools: [{ type: "web_search_preview" }], instructions: SYSTEM, input: query }),
    }), "openai");
    let text = "";
    const citations: string[] = [];
    for (const item of Array.isArray(body?.output) ? body.output : []) {
      if (item?.type !== "message") continue;
      for (const c of Array.isArray(item.content) ? item.content : []) {
        if (typeof c?.text === "string") text += (text ? "\n" : "") + c.text;
        for (const a of Array.isArray(c?.annotations) ? c.annotations : []) {
          if (a?.type === "url_citation" && typeof a.url === "string" && !citations.includes(a.url)) citations.push(a.url);
        }
      }
    }
    return { text, citations };
  };
}

/** Google AI Overview through SerpAPI: ai_overview.text_blocks[] + references[]; a page_token needs a second call. */
export function makeSerpApiOverviewAsk(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): AskFn {
  const key = (env.SERPAPI_KEY || env.SEO_SERP_API_KEY || "").trim();
  const call = async (params: Record<string, string>) =>
    json(await fetchImpl(`https://serpapi.com/search.json?${new URLSearchParams({ ...params, api_key: key })}`), "serpapi");
  const blocksText = (blocks: unknown): string => {
    const parts: string[] = [];
    for (const b of Array.isArray(blocks) ? blocks : []) {
      if (typeof b?.snippet === "string") parts.push(b.snippet);
      for (const li of Array.isArray(b?.list) ? b.list : []) parts.push([li?.title, li?.snippet].filter((x) => typeof x === "string").join(" "));
    }
    return parts.join("\n");
  };
  return async (query) => {
    let body = await call({ engine: "google", q: query, location: "New Jersey, United States", hl: "en", gl: "us" });
    let overview = body?.ai_overview;
    if (overview?.page_token && !overview?.text_blocks) {
      body = await call({ engine: "google_ai_overview", page_token: String(overview.page_token) });
      overview = body?.ai_overview;
    }
    if (!overview || (!overview.text_blocks && !overview.references)) return "no_overview";
    const citations = (Array.isArray(overview.references) ? overview.references : []).map((r: { link?: string }) => r?.link).filter((u: unknown): u is string => typeof u === "string");
    return { text: blocksText(overview.text_blocks), citations };
  };
}

export function askFor(engine: AiEngine, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): AskFn {
  if (engine === "perplexity") return makePerplexityAsk(env, fetchImpl);
  if (engine === "openai") return makeOpenAiAsk(env, fetchImpl);
  return makeSerpApiOverviewAsk(env, fetchImpl);
}

export function obsKey(weekOf: string, engine: AiEngine, query: string): string {
  return crypto.createHash("sha256").update(`${weekOf}|${engine}|${query}`).digest("hex");
}

export type RunOptions = {
  now?: Date;
  queries?: string[];
  engines?: AiEngine[];
  ask?: Partial<Record<AiEngine, AskFn>>;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  concurrency?: number;
};

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

export type RunResult = { weekOf: string; engines: AiEngine[]; asked: number; skippedExisting: number; failed: number };

/** One weekly run: asks only the (engine, query) pairs that have no row yet this ET week. */
export async function runAiVisibilityCheck(opts: RunOptions = {}): Promise<RunResult | { skipped: true; reason: string }> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const weekOf = weekStartET(now);
  const engines = opts.engines ?? enginesConfigured(env);
  console.log("[AIVis] engines configured (presence only):", JSON.stringify({ perplexity: engines.includes("perplexity"), openai: engines.includes("openai"), google_ai_overview: engines.includes("google_ai_overview") }));
  if (engines.length === 0) return { skipped: true, reason: "No AI-visibility engine configured (set PERPLEXITY_API_KEY and/or OPENAI_API_KEY; Google AI Overviews also need SEO_SERP_PROVIDER=serpapi + SERPAPI_KEY)." };
  const db = await getDb();
  if (!db) return { skipped: true, reason: "Database unavailable." };

  const queries = opts.queries ?? TARGET_QUERIES;
  await ensureAiVisibilityTable(db);
  const existing = await db.select({ key: seoIntelAiVisibility.obsKey }).from(seoIntelAiVisibility).where(and(eq(seoIntelAiVisibility.weekOf, weekOf), inArray(seoIntelAiVisibility.engine, engines)));
  const have = new Set(existing.map((r) => r.key));
  const jobs: Array<{ engine: AiEngine; query: string }> = [];
  for (const engine of engines) for (const query of queries) if (!have.has(obsKey(weekOf, engine, query))) jobs.push({ engine, query });
  const skippedExisting = engines.length * queries.length - jobs.length;
  const watch = COMPETITOR_WATCHLIST.map((c) => ({ name: c.name, domain: c.domain }));
  let failed = 0;

  await pool(jobs, opts.concurrency ?? 3, async ({ engine, query }) => {
    let obs: Observation;
    try {
      const ask = opts.ask?.[engine] ?? askFor(engine, env, opts.fetchImpl);
      const ans = await ask(query);
      obs = ans === "no_overview"
        ? { engine, query, status: "no_overview", named: false, citedUs: false, namedAs: null, competitors: [], otherCompanies: [], citedDomains: [], citations: [], excerpt: "" }
        : analyzeAnswer(query, engine, ans, watch);
    } catch (err) {
      failed++;
      obs = { engine, query, status: "error", named: false, citedUs: false, namedAs: null, competitors: [], otherCompanies: [], citedDomains: [], citations: [], excerpt: "", error: (err as Error).message.slice(0, 250) };
    }
    await db.insert(seoIntelAiVisibility).values({
      weekOf, engine, query, obsKey: obsKey(weekOf, engine, query), status: obs.status, named: obs.named, citedUs: obs.citedUs,
      namedAs: obs.namedAs, competitors: obs.competitors, otherCompanies: obs.otherCompanies, citedDomains: obs.citedDomains,
      citations: obs.citations, excerpt: obs.excerpt, error: obs.error ?? null,
    }).onDuplicateKeyUpdate({ set: { status: obs.status, named: obs.named, citedUs: obs.citedUs, namedAs: obs.namedAs, competitors: obs.competitors, otherCompanies: obs.otherCompanies, citedDomains: obs.citedDomains, citations: obs.citations, excerpt: obs.excerpt, error: obs.error ?? null } });
  });
  console.log(`[AIVis] week ${weekOf}: asked ${jobs.length}, skipped ${skippedExisting} already recorded, failed ${failed}`);
  return { weekOf, engines, asked: jobs.length, skippedExisting, failed };
}

type Row = typeof seoIntelAiVisibility.$inferSelect;
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const toObs = (r: Row): Observation => ({
  engine: r.engine, query: r.query, status: r.status, named: r.named, citedUs: r.citedUs, namedAs: r.namedAs,
  competitors: asStrings(r.competitors), otherCompanies: asStrings(r.otherCompanies), citedDomains: asStrings(r.citedDomains),
  citations: asStrings(r.citations), excerpt: r.excerpt ?? "", error: r.error,
});

/** Read-only: the report section — latest stored week vs the one before. No API calls. */
export async function collectAiVisibility(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): Promise<AiVisibilitySection> {
  const configured = enginesConfigured(env);
  const empty = (reason: string): AiVisibilitySection => ({ checked: false, reason, enginesConfigured: configured, current: null, previous: null, change: null, gaps: [] });
  try {
    const db = await getDb();
    if (!db) return empty("Database unavailable.");
    await ensureAiVisibilityTable(db);
    const rows = await db.select().from(seoIntelAiVisibility);
    if (rows.length === 0) return empty(configured.length ? "Configured, but the first weekly run hasn't happened yet." : "No AI-visibility engine configured (PERPLEXITY_API_KEY / OPENAI_API_KEY).");
    const weeks = Array.from(new Set(rows.map((r) => r.weekOf))).sort().reverse();
    const byWeek = (w: string) => rows.filter((r) => r.weekOf === w).map(toObs);
    const curObs = byWeek(weeks[0]);
    const current = summarizeWeek(weeks[0], curObs);
    const previous: WeekSummary | null = weeks[1] ? summarizeWeek(weeks[1], byWeek(weeks[1])) : null;
    const named = new Set(current.namedQueries);
    const gaps = TARGET_QUERIES.filter((q) => !named.has(q) && curObs.some((o) => o.query === q && o.status !== "error")).map((query) => {
      const o = curObs.filter((x) => x.query === query);
      return { query, competitors: Array.from(new Set(o.flatMap((x) => x.competitors))), citedDomains: Array.from(new Set(o.flatMap((x) => x.citedDomains))).slice(0, 6) };
    });
    return { checked: true, reason: `Week of ${weeks[0]}.`, enginesConfigured: configured, current, previous, change: compareWeeks(current, previous), gaps };
  } catch (err) {
    // Surface the underlying DB error and actionable migration diagnosis.
    // Never mutate the schema or swallow the failure as an empty report.
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    const detail = [message, cause].filter(Boolean).join(" | ").slice(0, 600);
    const schemaMismatch = /unknown column|doesn't exist|does not exist|ER_BAD_FIELD_ERROR|ER_NO_SUCH_TABLE|table .* doesn't exist/i.test(detail);
    console.error("[MarketIntel] AI visibility read failure:", detail);
    return empty(schemaMismatch
      ? `AI visibility schema needs migration review: ${detail}`
      : `AI-visibility read failed: ${detail}`);
  }
}

export { AI_ENGINES };
