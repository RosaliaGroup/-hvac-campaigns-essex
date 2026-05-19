/**
 * IndexNow Submission Script
 * Submits all sitemap URLs to Bing and Yandex via IndexNow protocol.
 * Also pings Google and Bing with the sitemap URL.
 *
 * Usage: npx tsx server/scripts/submitToIndexNow.ts
 * Options: --priority-only (submit only high-priority pages first)
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const SITEMAP_PATH = resolve(ROOT, "client/public/sitemap.xml");
const INDEXNOW_KEY = "c2dfd968b07270b1a4ac119ceea449ff";
const HOST = "mechanicalenterprise.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

// IndexNow endpoints
const INDEXNOW_ENDPOINTS = [
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

// Priority pages to submit first
const PRIORITY_PATTERNS = [
  /^\/$/, /^\/residential$/, /^\/commercial$/, /^\/services$/,
  /^\/blog$/, /^\/direct-install$/,
  /^\/rebate-calculator$/, /^\/about$/, /^\/contact$/,
  /^\/blog\/nj-heat-pump-rebates/, /^\/blog\/nj-hvac-rebates/,
  /^\/blog\/pseg-heat-pump/, /^\/blog\/heat-pump-vs-gas/,
  /^\/hvac-newark-nj$/, /^\/hvac-jersey-city-nj$/, /^\/hvac-hoboken-nj$/,
  /^\/hvac-montclair-nj$/, /^\/hvac-morristown-nj$/, /^\/hvac-elizabeth-nj$/,
];

function extractUrls(sitemapXml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>(.*?)<\/loc>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sitemapXml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function getPriorityUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    const path = url.replace(`https://${HOST}`, "");
    return PRIORITY_PATTERNS.some((p) => p.test(path));
  });
}

async function submitToEndpoint(endpoint: string, urls: string[]): Promise<boolean> {
  const BATCH_SIZE = 10000;
  let success = true;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const body = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: batch,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });

      if (res.ok || res.status === 202) {
        console.log(`  OK ${endpoint}: ${batch.length} URLs submitted (${res.status})`);
      } else {
        const text = await res.text();
        console.error(`  FAIL ${endpoint}: (${res.status}): ${text}`);
        success = false;
      }
    } catch (err) {
      console.error(`  FAIL ${endpoint}: Network error: ${err}`);
      success = false;
    }
  }

  return success;
}

async function pingSitemap(): Promise<void> {
  const pingUrls = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
  ];

  for (const pingUrl of pingUrls) {
    try {
      const res = await fetch(pingUrl);
      console.log(`  Sitemap ping: ${pingUrl.split("?")[0]} (${res.status})`);
    } catch (err) {
      console.error(`  Sitemap ping failed: ${pingUrl.split("?")[0]}`);
    }
  }
}

async function main() {
  const priorityOnly = process.argv.includes("--priority-only");

  const xml = readFileSync(SITEMAP_PATH, "utf-8");
  const allUrls = extractUrls(xml);

  if (allUrls.length === 0) {
    console.log("No URLs found in sitemap.");
    return;
  }

  const urls = priorityOnly ? getPriorityUrls(allUrls) : allUrls;
  console.log(`\nIndexNow Submission`);
  console.log(`  Total sitemap URLs: ${allUrls.length}`);
  console.log(`  Submitting: ${urls.length} URLs${priorityOnly ? " (priority only)" : ""}`);
  console.log(`  Key: ${INDEXNOW_KEY}\n`);

  console.log("Submitting to IndexNow endpoints:");
  let allSuccess = true;
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    const success = await submitToEndpoint(endpoint, urls);
    if (!success) allSuccess = false;
  }

  console.log("\nPinging sitemap to search engines:");
  await pingSitemap();

  console.log(`\n${allSuccess ? "Done" : "Warning"}: Submission complete.`);
  if (!allSuccess) {
    console.log("Some submissions failed. Check errors above.");
    process.exit(1);
  }
}

main();
