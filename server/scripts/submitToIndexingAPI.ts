import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const SITEMAP_PATH = resolve(ROOT, "client/public/sitemap.xml");
const KEY_PATH = resolve(__dirname, "indexing-api-key.json");
const SUBMITTED_PATH = resolve(ROOT, "logs/submitted-urls.json");
const LOG_DIR = resolve(ROOT, "logs");

const MAX_PER_DAY = 200;
const SKIP_DAYS = 7;

function getLogPath(): string {
  const date = new Date().toISOString().slice(0, 10);
  return resolve(LOG_DIR, `indexing-api-${date}.log`);
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  const logPath = getLogPath();
  writeFileSync(logPath, line + "\n", { flag: "a" });
}

function extractUrls(sitemapXml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = regex.exec(sitemapXml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

function loadSubmitted(): Record<string, string> {
  if (!existsSync(SUBMITTED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SUBMITTED_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveSubmitted(data: Record<string, string>) {
  writeFileSync(SUBMITTED_PATH, JSON.stringify(data, null, 2));
}

function isRecentlySubmitted(
  url: string,
  submitted: Record<string, string>
): boolean {
  const lastDate = submitted[url];
  if (!lastDate) return false;
  const diff = Date.now() - new Date(lastDate).getTime();
  return diff < SKIP_DAYS * 24 * 60 * 60 * 1000;
}

async function main() {
  // Validate key file
  if (!existsSync(KEY_PATH)) {
    console.error(
      `\nService account key not found at:\n  ${KEY_PATH}\n\nSee server/scripts/INDEXING-API-SETUP.md for setup instructions.\n`
    );
    process.exit(1);
  }

  // Read sitemap
  if (!existsSync(SITEMAP_PATH)) {
    console.error(`Sitemap not found at: ${SITEMAP_PATH}`);
    process.exit(1);
  }
  const sitemapXml = readFileSync(SITEMAP_PATH, "utf-8");
  const allUrls = extractUrls(sitemapXml);
  log(`Found ${allUrls.length} URLs in sitemap`);

  // Filter recently submitted
  const submitted = loadSubmitted();
  const toSubmit = allUrls.filter((u) => !isRecentlySubmitted(u, submitted));
  const skipped = allUrls.length - toSubmit.length;
  log(`Skipping ${skipped} URLs submitted in last ${SKIP_DAYS} days`);

  // Cap at daily quota
  const batch = toSubmit.slice(0, MAX_PER_DAY);
  if (batch.length < toSubmit.length) {
    log(
      `Capping to ${MAX_PER_DAY}/day quota — ${toSubmit.length - MAX_PER_DAY} will be submitted next run`
    );
  }

  // Auth
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });
  const indexing = google.indexing({ version: "v3", auth });

  let successCount = 0;
  let errorCount = 0;
  const today = new Date().toISOString();

  for (const url of batch) {
    try {
      const res = await indexing.urlNotifications.publish({
        requestBody: {
          url,
          type: "URL_UPDATED",
        },
      });
      log(`OK ${res.status} — ${url}`);
      submitted[url] = today;
      successCount++;
    } catch (err: any) {
      const msg = err?.message || String(err);
      log(`ERROR — ${url} — ${msg}`);
      errorCount++;
    }

    // Small delay to be respectful to the API
    await new Promise((r) => setTimeout(r, 100));
  }

  // Save tracking
  saveSubmitted(submitted);

  // Summary
  const summary = [
    "",
    "=== SUMMARY ===",
    `Total in sitemap: ${allUrls.length}`,
    `Skipped (recent): ${skipped}`,
    `Submitted:        ${successCount}`,
    `Errors:           ${errorCount}`,
    `Remaining:        ${toSubmit.length - batch.length}`,
    "",
  ].join("\n");
  log(summary);
}

main();
