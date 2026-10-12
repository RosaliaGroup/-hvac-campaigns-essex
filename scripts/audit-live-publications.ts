import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { verifyLiveBlogPath, type LivePageCheck } from "../server/services/seo/livePublicationCheck";
import { planPublicationRepair } from "../server/services/seo/publicationRepairPlan";

const site = "https://mechanicalenterprise.com";
const dir = "artifacts/seo";
mkdirSync(dir, { recursive: true });
const response = await fetch(site + "/sitemap.xml", { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error("Sitemap fetch failed: " + response.status);
const xml = await response.text();
const paths = Array.from(new Set(Array.from(xml.matchAll(/<loc>\s*([^<]+)<\/loc>/g), m => {
  try { const u = new URL(m[1].trim()); return u.origin === site && /^\/blog\/[a-z0-9-]+$/.test(u.pathname) ? u.pathname : ""; }
  catch { return ""; }
}).filter(Boolean)));
if (!paths.length) throw new Error("No blog URLs in sitemap");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function checkWithRetry(path: string) {
  let result: LivePageCheck = await verifyLiveBlogPath(path);
  let attempts = 1;
  while (attempts < 3 && (result.status === "unreachable" || result.httpStatus === 429 || (result.httpStatus !== null && result.httpStatus >= 500))) {
    await sleep(1000 * attempts);
    result = await verifyLiveBlogPath(path);
    attempts++;
  }
  return { ...result, attempts };
}
const results: Awaited<ReturnType<typeof checkWithRetry>>[] = [];
for (let i = 0; i < paths.length; i += 5) results.push(...await Promise.all(paths.slice(i, i + 5).map(checkWithRetry)));
const checkedAt = new Date().toISOString();
const failures = results.filter(r => r.status !== "verified_live");
const priorPath = dir + "/previous-audit.json";
let previous: Record<string, number> = {};
if (existsSync(priorPath)) {
  try { previous = JSON.parse(readFileSync(priorPath, "utf8")).failureStreaks ?? {}; } catch { /* reset corrupt history */ }
}
const failureStreaks: Record<string, number> = {};
for (const r of results) if (r.status !== "verified_live") failureStreaks[r.path] = (previous[r.path] ?? 0) + 1;
const report = { checkedAt, total: results.length, failures: failures.length, failureStreaks,
  results: results.map(r => ({ ...r, repairPlan: planPublicationRepair(r) })) };
writeFileSync(dir + "/publication-audit.json", JSON.stringify(report, null, 2));
writeFileSync(priorPath, JSON.stringify(report, null, 2));
const summary = "SEO publication audit: " + results.length + " checked; " + failures.length + " failed.\n" +
  failures.slice(0, 40).map(r => r.path + " (" + r.reason + "; attempts " + r.attempts + "; consecutive runs " + failureStreaks[r.path] + ")").join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## SEO publication audit\n\n" + summary + "\n");
}
if (failures.length) process.exitCode = 1;
