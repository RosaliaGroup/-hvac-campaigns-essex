/**
 * Search Console links for the CRM.
 *
 * Google no longer accepts a page URL in the URL Inspection deep link: the `id`
 * on /search-console/inspect is now an opaque token, and a link carrying the
 * page URL returns Google's 404 page (verified 2026-10-29). There is no other
 * documented deep link into an inspection. So the CRM opens the property's
 * Search Console home and copies the page URL to the clipboard; the owner pastes
 * it into the "Inspect any URL" bar.
 *
 * `authuser` picks the Google account that owns the property. Without it, Google
 * opens the browser's first signed-in account, which may have no access.
 */

export const GSC_HOME = "https://search.google.com/search-console";

/** Search Console home for one property, opened as `accountEmail` when given. */
export function gscPropertyUrl(siteUrl: string, accountEmail?: string | null): string {
  const params = new URLSearchParams({ resource_id: siteUrl });
  if (accountEmail) params.set("authuser", accountEmail);
  return `${GSC_HOME}?${params.toString()}`;
}

/** Absolute URL of `page` on `origin`. */
export function absolutePageUrl(origin: string, page: string): string {
  if (/^https?:\/\//i.test(page)) return page;
  return `${origin.replace(/\/+$/, "")}${page.startsWith("/") ? page : `/${page}`}`;
}

/**
 * Turn any stored link (including the old /inspect deep links saved in earlier
 * reports) into a working property link. Returns null if no property is in it.
 */
export function normalizeGscLink(stored: string, accountEmail?: string | null): string | null {
  try {
    const u = new URL(stored);
    const siteUrl = u.searchParams.get("resource_id");
    if (!siteUrl) return null;
    return gscPropertyUrl(siteUrl, accountEmail ?? u.searchParams.get("authuser"));
  } catch {
    return null;
  }
}

/** The site origin implied by a link's property (URL-prefix properties only). */
export function originFromGscLink(stored: string): string | null {
  try {
    const siteUrl = new URL(stored).searchParams.get("resource_id");
    if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) return null;
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}
