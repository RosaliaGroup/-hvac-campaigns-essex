/**
 * Daily Googlebot-style crawl check (docs/pr1/july-collapse.md). Fetches each URL twice — once with
 * Googlebot's smartphone user agent, once as a browser — WITHOUT following redirects, and flags what
 * would have made Google drop a page: an unexpected redirect, an error status, noindex, a canonical
 * pointing elsewhere, an empty title/body, or the bot seeing something a browser doesn't.
 *
 * Honest limit: this comes from our server's IP with a spoofed UA, so it cannot see anything Netlify
 * does by IP/ASN or only for Google's real crawler. It catches a repeat of "the site redirects or
 * breaks" in a day instead of a quarter; it does not prove Google saw the same thing.
 */
import { getDb } from "../../../db";
import { seoPages } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSeoSiteUrl, getSiteOrigin } from "../../../integrations/searchConsole";
import { REINDEX_EXPERIMENT } from "../../../../shared/seoExperiment";
import type { CrawlAnomaly, CrawlCheckResult } from "../../../../shared/marketIntelTypes";
import { loadNetlifyRedirects } from "./searchDemand";

export const GOOGLEBOT_UA =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const TOP_N = 30;
const TIMEOUT_MS = 15_000;
const CONCURRENCY = 5;
const MAX_BODY = 300_000;
const MIN_BODY_BYTES = 1500;

export type Snapshot =
  | { ok: true; status: number; location: string | null; xRobots: string | null; title: string | null; canonical: string | null; metaRobots: string | null; bytes: number }
  | { ok: false; error: string };

const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? null;

export function parseHead(html: string): { title: string | null; canonical: string | null; metaRobots: string | null } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim() || null;
  const canonicalTag = /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.exec(html)?.[0];
  const robotsTag = /<meta\b[^>]*name\s*=\s*["']robots["'][^>]*>/i.exec(html)?.[0];
  return { title, canonical: canonicalTag ? attr(canonicalTag, "href") : null, metaRobots: robotsTag ? attr(robotsTag, "content") : null };
}

export async function snapshot(url: string, ua: string, fetchImpl: typeof fetch = fetch): Promise<Snapshot> {
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": ua, Accept: "text/html,*/*" }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const isHtml = res.status === 200 && (res.headers.get("content-type") ?? "").includes("html");
    const body = isHtml ? (await res.text()).slice(0, MAX_BODY) : "";
    const head = isHtml ? parseHead(body) : { title: null, canonical: null, metaRobots: null };
    return { ok: true, status: res.status, location: res.headers.get("location"), xRobots: res.headers.get("x-robots-tag"), bytes: body.length, ...head };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const normPath = (p: string) => {
  const c = p.split(/[?#]/)[0].replace(/\/+$/, "");
  return c === "" ? "/" : c;
};
const toPath = (href: string, origin: string) => {
  try { const u = new URL(href, origin); return u.origin === new URL(origin).origin ? normPath(u.pathname) : `${u.origin}${normPath(u.pathname)}`; } catch { return href; }
};

/** Everything wrong with one page, given the bot and browser snapshots. Pure. */
export function evaluatePage(path: string, origin: string, bot: Snapshot, browser: Snapshot, expectedRedirects: Map<string, string>): CrawlAnomaly[] {
  const url = `${origin.replace(/\/+$/, "")}${path}`;
  const out: CrawlAnomaly[] = [];
  const add = (kind: CrawlAnomaly["kind"], detail: string) => out.push({ url, kind, detail });

  if (!bot.ok) { add("fetch_failed", `Googlebot UA: ${bot.error}`); return out; }
  if (bot.status >= 300 && bot.status < 400) {
    if (!expectedRedirects.has(normPath(path))) add("unexpected_redirect", `${bot.status} → ${bot.location ?? "(no Location)"}`);
  } else if (bot.status >= 400) {
    add("http_error", `HTTP ${bot.status}`);
  } else if (bot.status === 200) {
    const robots = `${bot.metaRobots ?? ""} ${bot.xRobots ?? ""}`.toLowerCase();
    if (robots.includes("noindex")) add("noindex", `robots: ${robots.trim()}`);
    if (bot.canonical && toPath(bot.canonical, origin) !== normPath(path)) add("canonical_mismatch", `canonical → ${bot.canonical}`);
    if (!bot.title) add("no_title", "no <title> in the HTML Googlebot received");
    if (bot.bytes < MIN_BODY_BYTES) add("tiny_body", `${bot.bytes} bytes of HTML`);
  }

  if (browser.ok) {
    const differs =
      bot.status !== browser.status ||
      (bot.location ?? "") !== (browser.location ?? "") ||
      (bot.status === 200 && ((bot.canonical ?? "") !== (browser.canonical ?? "") || (bot.title ?? "") !== (browser.title ?? "")));
    if (differs) add("bot_diverges", `Googlebot: ${bot.status}${bot.location ? ` → ${bot.location}` : ""} "${bot.title ?? ""}" | browser: ${browser.status}${browser.location ? ` → ${browser.location}` : ""} "${browser.title ?? ""}"`);
  }
  return out;
}

/** Top `n` pages by demand (max of current and prior impressions, so collapsed pages stay in), plus / and the held pages. */
export function pickUrls(pages: Array<{ page: string; impressions: number; previousImpressions: number }>, extra: readonly string[], n = TOP_N): string[] {
  const ranked = [...pages].sort((a, b) => Math.max(b.impressions, b.previousImpressions) - Math.max(a.impressions, a.previousImpressions)).slice(0, n).map((p) => normPath(p.page));
  return Array.from(new Set([...ranked, "/", ...extra.map(normPath)]));
}

export async function runCrawlCheck(input: { origin: string; paths: string[]; redirects: Map<string, string>; fetchImpl?: typeof fetch; now?: Date }): Promise<CrawlCheckResult> {
  const origin = input.origin.replace(/\/+$/, "");
  const anomalies: CrawlAnomaly[] = [];
  const queue = [...input.paths];
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      const url = `${origin}${path}`;
      const [bot, browser] = await Promise.all([snapshot(url, GOOGLEBOT_UA, input.fetchImpl), snapshot(url, BROWSER_UA, input.fetchImpl)]);
      anomalies.push(...evaluatePage(path, origin, bot, browser, input.redirects));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, input.paths.length) }, worker));
  return { checkedAt: (input.now ?? new Date()).toISOString(), checked: input.paths.length, anomalies: anomalies.sort((a, b) => a.url.localeCompare(b.url) || a.kind.localeCompare(b.kind)) };
}

/** Real I/O. Never throws: a broken check must not take the report down with it. */
export async function collectCrawlCheck(now: Date = new Date()): Promise<CrawlCheckResult | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const pages = await db.select().from(seoPages).where(eq(seoPages.siteUrl, getSeoSiteUrl()));
    const paths = pickUrls(pages, REINDEX_EXPERIMENT.holdPaths);
    return await runCrawlCheck({ origin: getSiteOrigin(), paths, redirects: loadNetlifyRedirects(), now });
  } catch (err) {
    console.error("[SEO] crawl check failed:", (err as Error).message);
    return null;
  }
}
