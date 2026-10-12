import { mkdirSync, writeFileSync } from "node:fs";
import { verifyLiveBlogPath } from "../server/services/seo/livePublicationCheck";

const site = "https://mechanicalenterprise.com";
const response = await fetch(site + "/sitemap.xml", { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error("Sitemap fetch failed: " + response.status);
const xml = await response.text();
const paths = Array.from(new Set(Array.from(xml.matchAll(/<loc>\s*([^<]+)<\/loc>/g), match => {
  try {
    const url = new URL(match[1].trim());
    return url.origin === site && /^\/blog\/[a-z0-9-]+$/.test(url.pathname) ? url.pathname : "";
  } catch { return ""; }
}).filter(Boolean)));
if (!paths.length) throw new Error("No blog URLs in sitemap");
const results = [];
for (let i = 0; i < paths.length; i += 5) {
  results.push(...await Promise.all(paths.slice(i, i + 5).map(verifyLiveBlogPath)));
}
const failures = results.filter(result => result.status !== "verified_live");
mkdirSync("artifacts/seo", { recursive: true });
writeFileSync("artifacts/seo/publication-audit.json", JSON.stringify({
  checkedAt: new Date().toISOString(), total: results.length, failures: failures.length, results
}, null, 2));
console.log("Checked", results.length, "blog URLs; failures:", failures.length);
for (const failure of failures) console.error(failure.path, failure.reason);
if (failures.length) process.exitCode = 1;
