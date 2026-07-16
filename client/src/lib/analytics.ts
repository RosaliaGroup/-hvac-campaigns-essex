/**
 * Frontend GA4 analytics helper.
 *
 * GA4 is *configured* at page load in `client/index.html`, through the SAME
 * gtag.js instance that already powers Google Ads (`AW-17768263516`) — there is
 * no second gtag.js load. That config uses `send_page_view: false`, so gtag does
 * NOT auto-send a page_view. This module is therefore the SINGLE source of GA4
 * page_view events: `client/src/App.tsx` calls `trackPageView` on initial load
 * and on every wouter route change, giving exactly one page_view per view (no
 * duplicate initial hit).
 *
 * Every export no-ops safely when `VITE_GA4_MEASUREMENT_ID` is unset or when
 * `window.gtag` is unavailable (SSR / tests / builds without the env var), so
 * the site is inert rather than throwing when GA4 isn't configured.
 */

/**
 * The GA4 **Web Data Stream Measurement ID** (e.g. "G-XXXXXXXXXX") for this
 * build, or `undefined` when GA4 is not configured. NOTE: this is the frontend
 * measurement id, distinct from the backend's numeric GA4 *property* id
 * (`GA4_PROPERTY_ID`). Returns undefined unless the value looks like a real
 * `G-…` id, so an unset or unsubstituted placeholder keeps GA4 off.
 */
export function getGa4MeasurementId(): string | undefined {
  const id = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  return typeof id === "string" && id.startsWith("G-") ? id : undefined;
}

/** True when a valid GA4 measurement id is configured for this build. */
export function isGa4Enabled(): boolean {
  return getGa4MeasurementId() !== undefined;
}

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  const g = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof g === "function" ? g : undefined;
}

/**
 * Reduce a router location to a GA4 `page_path`: the pathname only. The query
 * string and hash are stripped so tokens / emails / other sensitive query
 * params (e.g. `?token=…`, `?email=…`) are never sent to GA4. A path with no
 * leading slash is normalised to one.
 */
export function toPagePath(location: string): string {
  const path = (location || "/").split(/[?#]/)[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Send one GA4 `page_view` for `location`. No-ops when GA4 is disabled or
 * `window.gtag` is unavailable. The event is scoped to the GA4 stream via
 * `send_to`, so it never reaches the Google Ads account. Query/hash are stripped
 * from the path (see {@link toPagePath}).
 */
export function trackPageView(location: string): void {
  const id = getGa4MeasurementId();
  if (!id) return;
  const gtag = getGtag();
  if (!gtag) return;

  const params: Record<string, unknown> = {
    page_path: toPagePath(location),
    send_to: id,
  };
  if (typeof document !== "undefined" && document.title) {
    params.page_title = document.title;
  }
  gtag("event", "page_view", params);
}
