/** Cached, read-only discovery using the existing GBP OAuth grant. */
import { createHash } from "node:crypto";
import { getGbpAccessToken } from "../../integrations/gbp";
import { getGbpJson, GbpHttpError } from "../../integrations/gbpHttp";

type Location = { accountId: string; locationId: string; title: string; accountName: string };
type Result =
  | { ok: true; locations: Location[] }
  | { ok: false; status: number; stage: "accounts" | "locations"; reason: string; retryAfterSeconds?: number };
let cache: { key: string; until: number; result: Result } | undefined;
const pending = new Map<string, Promise<Result>>();

export async function discoverGbpLocations(): Promise<Result> {
  const token = await getGbpAccessToken();
  // A different/reconnected Google grant must never reuse another grant's data.
  const key = createHash("sha256").update(token).digest("hex");
  if (cache?.key === key && cache.until > Date.now()) return cache.result;
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = discover(token).then(result => {
    if (result.ok) cache = { key, until: Date.now() + 5 * 60_000, result };
    return result;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

async function discover(token: string): Promise<Result> {
  let stage: "accounts" | "locations" = "accounts";
  const locations: Location[] = [];
  try {
    const accounts = await pages<{ name: string; accountName?: string }>(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=100", "accounts", token,
    );
    stage = "locations";
    for (const account of accounts) {
      if (!/^accounts\/\d+$/.test(account.name)) continue;
      const accountId = account.name.slice("accounts/".length);
      const rows = await pages<{ name: string; title?: string }>(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title&pageSize=100`, "locations", token,
      );
      for (const loc of rows) {
        if (!/^locations\/\d+$/.test(loc.name)) continue;
        locations.push({ accountId, locationId: loc.name.slice("locations/".length), title: loc.title ?? "", accountName: account.accountName ?? "" });
      }
    }
    return { ok: true, locations };
  } catch (error) {
    if (!(error instanceof GbpHttpError)) throw error;
    return { ok: false, status: error.status, stage, reason: error.reason, retryAfterSeconds: error.retryAfterSeconds };
  }
}

async function pages<T>(url: string, field: "accounts" | "locations", token: string): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let next = "";
  do {
    const pageUrl = new URL(url);
    if (next) pageUrl.searchParams.set("pageToken", next);
    const page = await getGbpJson<{ accounts?: T[]; locations?: T[]; nextPageToken?: string }>(pageUrl.toString(), token);
    rows.push(...(page[field] ?? []));
    next = page.nextPageToken ?? "";
    if (next && seen.has(next)) throw new Error("Google returned a repeated page token");
    seen.add(next);
  } while (next);
  return rows;
}
