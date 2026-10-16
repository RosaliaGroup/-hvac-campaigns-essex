/** Read-only discovery of GBP accounts and locations for the existing Google OAuth grant. */
import { getGbpAccessToken } from "../../integrations/gbp";

let blockedUntil = 0;
export async function discoverGbpLocations() {
  if (Date.now() < blockedUntil) return { ok: false as const, status: 429, stage: "accounts", reason: "rate_limited", retryAfterSeconds: Math.ceil((blockedUntil - Date.now()) / 1000) };
  const token = await getGbpAccessToken();
  const headers = { Authorization: "Bearer " + token };
  const accountsResponse = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=100", {
    headers, signal: AbortSignal.timeout(12000),
  });
  if (!accountsResponse.ok) {
    const payload = await accountsResponse.json().catch(() => null) as { error?: { status?: string; details?: Array<{ reason?: string; metadata?: { quota_limit?: string; service?: string } }> } } | null;
    const reason = payload?.error?.details?.find(d => d.reason)?.reason ?? payload?.error?.status ?? "google_api_error";
    const retryHeader = Number(accountsResponse.headers.get("retry-after"));
    const retryAfterSeconds = accountsResponse.status === 429 ? Math.min(3600, Math.max(300, Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : 900)) : undefined;
    if (retryAfterSeconds) blockedUntil = Date.now() + retryAfterSeconds * 1000;
    return { ok: false as const, status: accountsResponse.status, stage: "accounts", reason: String(reason).slice(0, 120), retryAfterSeconds };
  }
  const accounts = await accountsResponse.json() as { accounts?: Array<{ name: string; accountName?: string }> };
  const locations: Array<{ accountId: string; locationId: string; title: string; accountName: string }> = [];
  for (const account of accounts.accounts ?? []) {
    if (!/^accounts\/\d+$/.test(account.name)) continue;
    const accountId = account.name.slice("accounts/".length);
    const response = await fetch("https://mybusinessbusinessinformation.googleapis.com/v1/" + account.name + "/locations?readMask=name,title&pageSize=100", {
      headers, signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { ok: false as const, status: response.status, stage: "locations", accountId };
    const data = await response.json() as { locations?: Array<{ name: string; title?: string }> };
    for (const loc of data.locations ?? []) {
      if (!/^locations\/\d+$/.test(loc.name)) continue;
      locations.push({ accountId, locationId: loc.name.slice("locations/".length), title: loc.title ?? "", accountName: account.accountName ?? "" });
    }
  }
  return { ok: true as const, locations };
}
