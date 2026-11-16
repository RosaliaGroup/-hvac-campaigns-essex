/**
 * Admin preview. "sales" = generic sales view; "member:<id>" = exactly what one
 * team member sees. Every API call carries `x-view-as`; the server can only
 * LOWER privileges, and preview is read-only. Stored per tab.
 */
const KEY = "me.viewAs";
const NAME = "me.viewAsName";

export function getViewAs(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get("viewAs");
    if (q === "sales") { sessionStorage.setItem(KEY, "sales"); sessionStorage.removeItem(NAME); }
    if (q === "off") { sessionStorage.removeItem(KEY); sessionStorage.removeItem(NAME); }
    const v = sessionStorage.getItem(KEY);
    return v === "sales" || /^member:\d+$/.test(v ?? "") ? v : null;
  } catch {
    return null;
  }
}

export function viewAsName(): string | null {
  try { return sessionStorage.getItem(NAME); } catch { return null; }
}

export function startSalesPreview() {
  try { sessionStorage.setItem(KEY, "sales"); sessionStorage.removeItem(NAME); } catch { /* ignore */ }
  window.location.assign("/lead-dashboard");
}

export function startMemberPreview(id: number, name: string) {
  try { sessionStorage.setItem(KEY, `member:${id}`); sessionStorage.setItem(NAME, name); } catch { /* ignore */ }
  window.location.assign("/lead-dashboard");
}

export function stopSalesPreview() {
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(NAME); } catch { /* ignore */ }
  window.location.assign("/team-management");
}
