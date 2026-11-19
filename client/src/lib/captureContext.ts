/**
 * Capture-time marketing context for public lead-capture submissions.
 *
 * Every public form sends the current page URL (which carries UTM/gclid in its
 * query string) plus document.referrer. The server (see @shared/attribution)
 * parses UTM/gclid from pageUrl and derives the channel; the referrer only
 * decides organic/referral/social/direct when there is no paid signal.
 *
 * Honesty rules mirrored here:
 *   - We send document.referrer verbatim. When the browser reports no referrer
 *     it is the empty string "" — we forward that as-is and NEVER fabricate a
 *     value. The server reads "" as an affirmative "direct" visit, whereas a
 *     missing field would mean "unknown".
 *   - We never touch pageUrl's query string, so UTM/gclid precedence stays
 *     deterministic and server-owned.
 *
 * Injectable (`win`) so it is unit-testable without a DOM.
 */
export interface CaptureContext {
  pageUrl: string;
  referrer: string;
  /** First page of this visit (see recordFirstTouch); omitted when unknown or same as pageUrl. */
  landingUrl?: string;
}

interface WindowLike {
  location?: { href?: string };
  document?: { referrer?: string };
}

export function captureContext(win?: WindowLike): CaptureContext {
  const w: WindowLike | undefined = win ?? (typeof window !== "undefined" ? (window as unknown as WindowLike) : undefined);
  const pageUrl = w?.location?.href ?? "";
  const ctx: CaptureContext = {
    pageUrl,
    // Always a string. "" == browser reported no referrer (direct). Not fabricated.
    referrer: typeof w?.document?.referrer === "string" ? w.document.referrer : "",
  };
  // Only read the real session store when not injected (keeps tests DOM-free).
  const landing = win ? "" : firstTouchUrl();
  if (landing && landing !== pageUrl) ctx.landingUrl = landing;
  return ctx;
}

// ── First-touch landing page ─────────────────────────────────────────────────
// The site is a single-page app: someone who lands on a blog post and then taps
// through to /qualify submits with location.href = /qualify, which hides the
// page (and any UTM/gclid) they arrived on. recordFirstTouch() runs once at app
// start and keeps the entry URL for the browser tab's session.
const FIRST_TOUCH_KEY = "me_first_touch_url";

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function sessionStore(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // blocked storage / private mode
  }
}

export function recordFirstTouch(href?: string, store: StorageLike | null = sessionStore()): void {
  if (!store) return;
  try {
    if (store.getItem(FIRST_TOUCH_KEY)) return;
    const url = href ?? (typeof window !== "undefined" ? window.location.href : "");
    if (url) store.setItem(FIRST_TOUCH_KEY, url.slice(0, 2000));
  } catch {
    /* ignore */
  }
}

/** The URL this visitor first landed on in this tab, or "" if unknown. */
export function firstTouchUrl(store: StorageLike | null = sessionStore()): string {
  try {
    return store?.getItem(FIRST_TOUCH_KEY) ?? "";
  } catch {
    return "";
  }
}
