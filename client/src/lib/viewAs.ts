/**
 * Admin "preview as sales rep". An admin turns it on (?viewAs=sales, or the
 * button on Team) and every API call carries `x-view-as: sales`; the server then
 * treats the session as a sales rep (it can only LOWER privileges), so the admin
 * sees exactly the menus, pages and data a setter sees. Stored per tab.
 */
const KEY = "me.viewAs";

export function getViewAs(): "sales" | null {
  try {
    const q = new URLSearchParams(window.location.search).get("viewAs");
    if (q === "sales") sessionStorage.setItem(KEY, "sales");
    if (q === "off") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "sales" ? "sales" : null;
  } catch {
    return null;
  }
}

export function startSalesPreview() {
  try { sessionStorage.setItem(KEY, "sales"); } catch { /* ignore */ }
  window.location.assign("/lead-dashboard");
}

export function stopSalesPreview() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  window.location.assign("/team-management");
}
