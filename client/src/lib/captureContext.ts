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
}

interface WindowLike {
  location?: { href?: string };
  document?: { referrer?: string };
}

export function captureContext(win?: WindowLike): CaptureContext {
  const w: WindowLike | undefined = win ?? (typeof window !== "undefined" ? (window as unknown as WindowLike) : undefined);
  return {
    pageUrl: w?.location?.href ?? "",
    // Always a string. "" == browser reported no referrer (direct). Not fabricated.
    referrer: typeof w?.document?.referrer === "string" ? w.document.referrer : "",
  };
}
