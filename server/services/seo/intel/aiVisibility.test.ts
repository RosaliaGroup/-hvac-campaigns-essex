import { describe, it, expect, vi, beforeEach } from "vitest";

const store: Array<Record<string, unknown>> = [];
vi.mock("../../../db", () => ({
  getDb: vi.fn(async () => ({
    // ensureAiVisibilityTable: CREATE TABLE IF NOT EXISTS + SHOW COLUMNS (enum already has 'claude').
    execute: vi.fn(async () => [[{ Type: "enum('perplexity','openai','google_ai_overview','claude')" }]]),
    select: (cols?: unknown) => ({
      from: () => {
        const rows = () => (cols ? store.map((r) => ({ key: r.obsKey })) : store.map((r) => ({ ...r })));
        const p: any = Promise.resolve(rows());
        p.where = () => Promise.resolve(rows());
        return p;
      },
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onDuplicateKeyUpdate: async () => {
          const i = store.findIndex((r) => r.obsKey === v.obsKey);
          if (i >= 0) store[i] = { ...store[i], ...v }; else store.push({ ...v });
        },
      }),
    }),
  })),
}));

import {
  enginesConfigured, makePerplexityAsk, makeOpenAiAsk, makeSerpApiOverviewAsk, makeClaudeAsk, runAiVisibilityCheck, collectAiVisibility, obsKey,
} from "./aiVisibility";
import { buildAiVisibilityDrafts } from "./adjustments";
import type { AiVisibilitySection } from "../../../../shared/aiVisibility";

const jsonRes = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

beforeEach(() => { store.length = 0; vi.spyOn(console, "log").mockImplementation(() => {}); });

describe("engine configuration (presence only)", () => {
  it("lists only engines whose keys are set; Google AI Overviews needs serpapi + a key", () => {
    expect(enginesConfigured({} as never)).toEqual([]);
    expect(enginesConfigured({ PERPLEXITY_API_KEY: "x" } as never)).toEqual(["perplexity"]);
    expect(enginesConfigured({ PERPLEXITY_API_KEY: "x", OPENAI_API_KEY: "y", SEO_SERP_PROVIDER: "serpapi", SERPAPI_KEY: "z" } as never)).toEqual(["perplexity", "openai", "google_ai_overview"]);
    expect(enginesConfigured({ SEO_SERP_PROVIDER: "dataforseo", SERPAPI_KEY: "z" } as never)).toEqual([]);
  });
});

describe("engine clients parse the documented response shapes", () => {
  it("perplexity: message content + citations (+ search_results urls, de-duplicated)", async () => {
    const ask = makePerplexityAsk({ PERPLEXITY_API_KEY: "k" } as never, (async () =>
      jsonRes({ choices: [{ message: { content: "Mechanical Enterprise serves Essex." } }], citations: ["https://a.com/1"], search_results: [{ url: "https://a.com/1" }, { url: "https://b.com/2" }] })) as never);
    expect(await ask("q")).toEqual({ text: "Mechanical Enterprise serves Essex.", citations: ["https://a.com/1", "https://b.com/2"] });
  });
  it("openai: output_text + url_citation annotations from the Responses API", async () => {
    const ask = makeOpenAiAsk({ OPENAI_API_KEY: "k" } as never, (async () =>
      jsonRes({ output: [{ type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text: "Try Gold Medal.", annotations: [{ type: "url_citation", url: "https://yelp.com/x" }, { type: "url_citation", url: "https://yelp.com/x" }] }] }] })) as never);
    expect(await ask("q")).toEqual({ text: "Try Gold Medal.", citations: ["https://yelp.com/x"] });
  });
  it("serpapi: AI Overview text blocks + references; 'no_overview' when absent; follows a page_token", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (url.includes("engine=google_ai_overview")) return jsonRes({ ai_overview: { text_blocks: [{ type: "paragraph", snippet: "Overview text." }], references: [{ link: "https://c.com" }] } });
      if (url.includes("q=no")) return jsonRes({ organic_results: [] });
      return jsonRes({ ai_overview: { page_token: "tok" } });
    }) as never;
    const ask = makeSerpApiOverviewAsk({ SERPAPI_KEY: "k" } as never, fetchImpl);
    expect(await ask("with overview")).toEqual({ text: "Overview text.", citations: ["https://c.com"] });
    expect(calls).toHaveLength(2);
    expect(await ask("no")).toBe("no_overview");
  });
  it("an HTTP error surfaces as a thrown error (recorded as status=error, never as 'not named')", async () => {
    const ask = makePerplexityAsk({ PERPLEXITY_API_KEY: "k" } as never, (async () => jsonRes({ error: "bad" }, false, 401)) as never);
    await expect(ask("q")).rejects.toThrow(/perplexity 401/);
  });
});

describe("runAiVisibilityCheck", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  it("skips (no calls, no cost) when no engine is configured", async () => {
    const r = await runAiVisibilityCheck({ now, env: {} as never });
    expect(r).toMatchObject({ skipped: true });
    expect(store).toHaveLength(0);
  });
  it("records one row per (engine, query) and never logs the key", async () => {
    const ask = vi.fn(async (q: string) => ({ text: q.includes("Newark") ? "Mechanical Enterprise and Gold Medal." : "Nobody in particular.", citations: ["https://yelp.com/z"] }));
    const logs: string[] = [];
    (console.log as any).mockImplementation((...a: unknown[]) => logs.push(a.join(" ")));
    const r = await runAiVisibilityCheck({ now, engines: ["perplexity"], queries: ["HVAC contractor Newark NJ", "PTAC replacement NJ"], ask: { perplexity: ask }, env: { PERPLEXITY_API_KEY: "SECRET-KEY-123" } as never });
    expect(r).toMatchObject({ weekOf: "2026-10-05", asked: 2, skippedExisting: 0, failed: 0 });
    expect(store).toHaveLength(2);
    expect(store.find((s) => s.query === "HVAC contractor Newark NJ")).toMatchObject({ named: true, engine: "perplexity" });
    expect(logs.join("\n")).not.toContain("SECRET-KEY-123");
    expect(logs.join("\n")).toContain("presence only");
  });
  it("is weekly + idempotent: a second run in the same ET week asks nothing, a new week asks again", async () => {
    const ask = vi.fn(async () => ({ text: "x", citations: [] as string[] }));
    const opts = { engines: ["openai" as const], queries: ["a", "b"], ask: { openai: ask }, env: { OPENAI_API_KEY: "k" } as never };
    await runAiVisibilityCheck({ ...opts, now });
    expect(ask).toHaveBeenCalledTimes(2);
    const again = await runAiVisibilityCheck({ ...opts, now: new Date("2026-10-07T12:00:00Z") });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(again).toMatchObject({ asked: 0, skippedExisting: 2 });
    await runAiVisibilityCheck({ ...opts, now: new Date("2026-10-12T12:00:00Z") });
    expect(ask).toHaveBeenCalledTimes(4);
  });
  it("a failing engine call is recorded as an error row and counted, not as 'not named'", async () => {
    const r = await runAiVisibilityCheck({ now, engines: ["openai"], queries: ["a"], ask: { openai: async () => { throw new Error("openai 429: rate limited"); } }, env: { OPENAI_API_KEY: "k" } as never });
    expect(r).toMatchObject({ failed: 1 });
    expect(store[0]).toMatchObject({ status: "error", named: false });
    expect(String(store[0].error)).toContain("429");
  });
  it("obsKey is stable per (week, engine, query)", () => {
    expect(obsKey("2026-10-05", "openai", "a")).toBe(obsKey("2026-10-05", "openai", "a"));
    expect(obsKey("2026-10-05", "openai", "a")).not.toBe(obsKey("2026-10-12", "openai", "a"));
  });
});

describe("collectAiVisibility (read-only report section)", () => {
  it("explains itself when nothing is configured / nothing recorded yet", async () => {
    const s = await collectAiVisibility(new Date("2026-10-05T12:00:00Z"), {} as never);
    expect(s.checked).toBe(false);
    expect(s.reason).toMatch(/PERPLEXITY_API_KEY|OPENAI_API_KEY/);
  });
  it("latest week vs previous week, with gaps for target queries nobody named us for", async () => {
    const base = { citedUs: false, namedAs: null, otherCompanies: [], citations: [], excerpt: "", error: null, status: "ok" };
    store.push(
      { ...base, weekOf: "2026-09-28", engine: "perplexity", query: "HVAC warranty NJ", named: true, competitors: [], citedDomains: [], obsKey: "1" },
      { ...base, weekOf: "2026-10-05", engine: "perplexity", query: "HVAC warranty NJ", named: false, competitors: ["Gold Medal"], citedDomains: ["yelp.com"], obsKey: "2" },
    );
    const s = await collectAiVisibility(new Date("2026-10-06T12:00:00Z"), { PERPLEXITY_API_KEY: "k" } as never);
    expect(s.checked).toBe(true);
    expect(s.current?.weekOf).toBe("2026-10-05");
    expect(s.change?.lost).toEqual(["HVAC warranty NJ"]);
    expect(s.gaps).toEqual([{ query: "HVAC warranty NJ", competitors: ["Gold Medal"], citedDomains: ["yelp.com"] }]);
  });
});

describe("buildAiVisibilityDrafts (suggestions route to existing lanes; nothing auto-executes)", () => {
  const section = (over: Partial<AiVisibilitySection> = {}): AiVisibilitySection => ({
    checked: true, reason: "", enginesConfigured: ["perplexity"],
    current: { weekOf: "2026-10-05", engines: {}, namedQueries: [], competitorCounts: {}, topCited: [{ domain: "yelp.com", count: 8 }, { domain: "google.com", count: 4 }, { domain: "angi.com", count: 2 }], reviewPlatformShare: 0.9, totalAnswers: 20 },
    previous: null, change: null,
    gaps: [{ query: "HVAC warranty NJ", competitors: ["Gold Medal"], citedDomains: ["yelp.com"] }],
    ...over,
  });
  it("review platforms dominating citations -> an owner-decision item pointing at the review engine", () => {
    const items = buildAiVisibilityDrafts(section());
    const rev = items.find((i) => i.kind === "owner_decision")!;
    expect(rev.suggestion).toMatch(/review-request engine/i);
    expect(rev.targetQueue).toBe("report_only");
  });
  it("each gap -> a content-queue new_post suggestion that names the competitors and sources", () => {
    const gap = buildAiVisibilityDrafts(section()).find((i) => i.kind === "new_post")!;
    expect(gap.targetQueue).toBe("content_queue");
    expect(gap.suggestion).toContain("Gold Medal");
    expect(gap.suggestion).toContain("yelp.com");
    expect(gap.factsBlocked).toBe(false);
  });
  it("queries we lost week over week -> a report-only refresh item", () => {
    const items = buildAiVisibilityDrafts(section({ gaps: [], change: { namedQueriesDelta: -1, gained: [], lost: ["PTAC replacement NJ"], newCompetitors: [], droppedCompetitors: [] } }));
    expect(items.find((i) => i.kind === "refresh_post")?.title).toContain("PTAC replacement NJ");
  });
  it("nothing when the section did not run", () => {
    expect(buildAiVisibilityDrafts(undefined)).toEqual([]);
    expect(buildAiVisibilityDrafts(section({ checked: false, current: null }))).toEqual([]);
  });
});

describe("Claude engine (existing ANTHROPIC_API_KEY)", () => {
  it("is configured by ANTHROPIC_API_KEY and can be switched off", () => {
    expect(enginesConfigured({ ANTHROPIC_API_KEY: "k" } as never)).toEqual(["claude"]);
    expect(enginesConfigured({ ANTHROPIC_API_KEY: "k", SEO_AI_VISIBILITY_CLAUDE: "false" } as never)).toEqual([]);
  });

  it("sends a web-search request and collects text, citations and search results", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return jsonRes({
        stop_reason: "end_turn",
        content: [
          { type: "server_tool_use", name: "web_search", input: { query: "hvac newark" } },
          { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://www.yelp.com/x" }, { type: "web_search_result", url: "https://ajperri.com/" }] },
          { type: "text", text: "A.J. Perri and Mechanical Enterprise both serve Newark.", citations: [{ type: "web_search_result_location", url: "https://mechanicalenterprise.com/hvac-newark-nj" }] },
        ],
      });
    }) as unknown as typeof fetch;
    const ans = await makeClaudeAsk({ ANTHROPIC_API_KEY: "secret" } as never, fetchImpl)("HVAC Newark NJ");
    expect(ans).not.toBe("no_overview");
    if (ans === "no_overview") return;
    expect(ans.text).toContain("Mechanical Enterprise");
    expect(ans.citations).toEqual(expect.arrayContaining(["https://mechanicalenterprise.com/hvac-newark-nj", "https://www.yelp.com/x", "https://ajperri.com/"]));
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.tools[0].type).toBe("web_search_20250305");
    expect((calls[0].init.headers as Record<string, string>)["x-api-key"]).toBe("secret");
  });

  it("continues a paused server-tool turn, then stops", async () => {
    let n = 0;
    const fetchImpl = (async () => jsonRes(n++ === 0
      ? { stop_reason: "pause_turn", content: [{ type: "text", text: "Looking… " }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text: "Done." }] })) as unknown as typeof fetch;
    const ans = await makeClaudeAsk({ ANTHROPIC_API_KEY: "k" } as never, fetchImpl)("q");
    expect(n).toBe(2);
    expect(ans !== "no_overview" && ans.text).toBe("Looking… Done.");
  });

  it("surfaces API errors so the run records an error row", async () => {
    const fetchImpl = (async () => jsonRes({ error: { type: "authentication_error" } }, false, 401)) as unknown as typeof fetch;
    await expect(makeClaudeAsk({ ANTHROPIC_API_KEY: "bad" } as never, fetchImpl)("q")).rejects.toThrow(/anthropic 401/);
  });
});
