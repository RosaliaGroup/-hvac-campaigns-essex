import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const SITEMAP_PATH = resolve(ROOT, "client/public/sitemap.xml");

const INDEXNOW_KEY = "c2dfd968b07270b1a4ac119ceea449ff";
const HOST = "mechanicalenterprise.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

function extractUrls(sitemapXml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>(.*?)<\/loc>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sitemapXml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function main() {
  const xml = readFileSync(SITEMAP_PATH, "utf-8");
  const urls = extractUrls(xml);

  if (urls.length === 0) {
    console.log("No URLs found in sitemap.");
    return;
  }

  console.log(`Found ${urls.length} URLs in sitemap. Submitting to IndexNow...`);

  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 202) {
    console.log(`Success (${res.status}): ${urls.length} URLs submitted.`);
  } else {
    const text = await res.text();
    console.error(`Failed (${res.status}): ${text}`);
    process.exit(1);
  }
}

main();
