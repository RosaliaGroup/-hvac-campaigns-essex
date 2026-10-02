/**
 * Generates client/src/data/aiFaqs.json: 3-5 conversational, facts-only, linted Q&As per service /
 * install page and for the city pages with real Search Console demand.
 *
 *   railway run --service=-hvac-campaigns-essex --environment=production \
 *     npx tsx scripts/generate-ai-faqs.ts            # writes the JSON; add DRY=1 to only list targets + seed queries
 *
 * Needs production env for the Google token (GSC queries) and ANTHROPIC_API_KEY. Presence-only logging:
 * keys are never printed. CITY_CAP (default 20) bounds how many city pages get generated Q&As — near-identical
 * templated answers across ~100 city pages would be scaled thin content, so only cities with demand ship.
 */
import fs from "fs";
import path from "path";
import { callAnthropicModelChain } from "../server/_core/anthropic";
import { getSearchConsoleAccessToken, getSeoSiteUrl, querySearchAnalytics } from "../server/integrations/searchConsole";
import { generateAll, type FaqTarget, type GscQueryRow } from "../server/services/seo/aiFaqGen";
import { VERIFIED_FACTS } from "../shared/verifiedFacts";
import { INSTALL_PAGES } from "../shared/llmsTxt";
import { ALL_CITIES, getCountyForSlug } from "../client/src/data/njCounties";

const root = path.resolve(import.meta.dirname, "..");
const CITY_CAP = Number(process.env.CITY_CAP ?? 20);
const MODELS = [process.env.SEO_AI_MODEL?.trim() || "claude-sonnet-5", "claude-haiku-4-5"];

function serviceTargets(): FaqTarget[] {
  const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
  const out: FaqTarget[] = [];
  const installPaths = new Set(INSTALL_PAGES.map((p) => p.path));
  for (const m of app.matchAll(/<ServicePage service="([^"]+)" slug="([^"]+)"/g)) {
    const p = `/${m[2]}`;
    out.push({ path: p, kind: installPaths.has(p) ? "install" : "service", name: `${m[1]} installation in NJ` });
  }
  out.push({ path: "/residential", kind: "install", name: "Residential HVAC installation in NJ" });
  return out;
}

async function fetchRows(): Promise<GscQueryRow[]> {
  const siteUrl = getSeoSiteUrl();
  const origin = new URL(siteUrl.startsWith("sc-domain:") ? "https://mechanicalenterprise.com" : siteUrl).origin;
  const end = new Date(Date.now() - 3 * 86_400_000);
  const start = new Date(end.getTime() - 89 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const accessToken = await getSearchConsoleAccessToken();
  const rows = await querySearchAnalytics({ accessToken, siteUrl, startDate: iso(start), endDate: iso(end), dimensions: ["page", "query"], rowLimit: 5000 });
  return rows.map((r) => {
    let p = r.keys[0] ?? "";
    try { p = new URL(p).pathname; } catch { p = p.replace(origin, ""); }
    return { page: p.length > 1 ? p.replace(/\/+$/, "") : p, query: r.keys[1] ?? "", impressions: r.impressions, clicks: r.clicks };
  });
}

(async () => {
  console.log("env presence:", JSON.stringify({ ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY?.trim() }));
  const rows = await fetchRows();
  console.log(`GSC page+query rows: ${rows.length}`);

  const impressionsByPage = new Map<string, number>();
  for (const r of rows) impressionsByPage.set(r.page, (impressionsByPage.get(r.page) ?? 0) + r.impressions);
  const cityTargets: FaqTarget[] = ALL_CITIES
    .map((c) => ({ c, path: `/hvac-${c.slug}-nj`, imp: impressionsByPage.get(`/hvac-${c.slug}-nj`) ?? 0 }))
    .filter((x) => x.imp > 0 || x.c.slug === "newark")
    .sort((a, b) => b.imp - a.imp)
    .slice(0, CITY_CAP)
    .map(({ c, path: p }) => ({ path: p, kind: "city" as const, name: `HVAC in ${c.city}, NJ`, city: c.city, county: getCountyForSlug(c.slug) }));

  const targets = [...serviceTargets(), ...cityTargets];
  console.log(`targets: ${targets.length} (${serviceTargets().length} service/install, ${cityTargets.length} city)`);
  if (process.env.DRY === "1") {
    for (const t of targets) console.log(t.path, t.kind, impressionsByPage.get(t.path) ?? 0);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const callModel = async (system: string) => {
    const r = await callAnthropicModelChain({ apiKey, models: MODELS, system, messages: [{ role: "user", content: "Write the FAQ JSON now." }], maxTokens: 4000, retry: { timeoutMs: 90_000 } });
    if (!r.ok || r.text === undefined) throw new Error(r.error ?? "model call failed");
    return r.text;
  };
  // ONLY=/path1,/path2 regenerates just those pages and merges them into the existing file.
  const only = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const selected = only.length ? targets.filter((t) => only.includes(t.path)) : targets;
  const outPath = path.join(root, "client/src/data/aiFaqs.json");
  const prior = only.length && fs.existsSync(outPath) ? (JSON.parse(fs.readFileSync(outPath, "utf8")) as { pages: Record<string, unknown> }) : null;
  const gen = await generateAll(selected, VERIFIED_FACTS, rows, callModel);
  const results = gen.results;
  const file = prior ? { generatedAt: gen.file.generatedAt, pages: { ...prior.pages, ...gen.file.pages } } : gen.file;
  if (prior) for (const t of selected) if (!gen.file.pages[t.path]) delete (file.pages as Record<string, unknown>)[t.path]; // a page that no longer yields clean Q&As ships none
  for (const r of results) console.log(r.page ? "OK  " : "FAIL", r.target.path, `attempts=${r.attempts}`, r.page ? `${r.page.items.length} items, ${r.page.queries.length} seed queries` : r.issues.join(" | ").slice(0, 200));
  fs.writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`wrote ${outPath}: ${Object.keys(file.pages).length}/${targets.length} pages`);
})().catch((e) => { console.error("ERR", String(e?.message ?? e).slice(0, 300)); process.exit(1); });
