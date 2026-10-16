/** Read-only discovery of GBP accounts and locations for the existing Google OAuth grant. */
import { getGbpAccessToken } from "../../integrations/gbp";

export async function discoverGbpLocations() {
  const token = await getGbpAccessToken();
  const headers = { Authorization: "Bearer " + token };
  const accountsResponse = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=100", {
    headers, signal: AbortSignal.timeout(12000),
  });
  if (!accountsResponse.ok) return { ok: false as const, status: accountsResponse.status, stage: "accounts" };
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
