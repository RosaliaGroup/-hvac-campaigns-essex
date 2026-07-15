import { describe, it, expect } from "vitest";
import { captureContext } from "./captureContext";
import { extractAttribution } from "@shared/attribution";

/** Build a fake window with a given href + referrer for injection. */
function fakeWin(href: string, referrer: string | undefined) {
  return { location: { href }, document: referrer === undefined ? {} : { referrer } };
}

describe("captureContext", () => {
  it("captures pageUrl and referrer from the window", () => {
    const ctx = captureContext(fakeWin("https://mechanicalenterprise.com/ac-repair?utm_source=google", "https://www.google.com/"));
    expect(ctx.pageUrl).toBe("https://mechanicalenterprise.com/ac-repair?utm_source=google");
    expect(ctx.referrer).toBe("https://www.google.com/");
  });

  it("does NOT fabricate a referrer when the browser reports none (empty string)", () => {
    const ctx = captureContext(fakeWin("https://mechanicalenterprise.com/", ""));
    expect(ctx.referrer).toBe(""); // forwarded verbatim, never a made-up value
  });

  it("falls back to empty strings when window/document are unavailable", () => {
    expect(captureContext({})).toEqual({ pageUrl: "", referrer: "" });
    expect(captureContext(fakeWin("https://x/y", undefined)).referrer).toBe("");
  });
});

/**
 * End-to-end: the client context, fed through the SAME server parser, must
 * produce the correct channel for the four required scenarios. This locks the
 * capture → classification contract without a live network round-trip.
 */
describe("referrer capture → server classification", () => {
  const selfHost = "mechanicalenterprise.com";

  it("search-engine referrer → organic", () => {
    const ctx = captureContext(fakeWin("https://mechanicalenterprise.com/hvac-newark-nj", "https://www.google.com/search?q=hvac"));
    const a = extractAttribution(ctx.pageUrl, ctx.referrer, selfHost);
    expect(a.channel).toBe("organic");
    expect(a.referrerHost).toBe("google.com");
  });

  it("direct visit with empty referrer → direct (not organic, not unknown)", () => {
    const ctx = captureContext(fakeWin("https://mechanicalenterprise.com/", ""));
    const a = extractAttribution(ctx.pageUrl, ctx.referrer, selfHost);
    expect(a.channel).toBe("direct");
  });

  it("internal referrer (same host) → treated as direct, not a referral", () => {
    const ctx = captureContext(fakeWin("https://mechanicalenterprise.com/quote", "https://mechanicalenterprise.com/ac-repair"));
    const a = extractAttribution(ctx.pageUrl, ctx.referrer, selfHost);
    expect(a.channel).toBe("direct");
  });

  it("UTM/gclid precedence is deterministic: gclid + organic referrer → paid", () => {
    const ctx = captureContext(fakeWin("https://mechanicalenterprise.com/lp/heat-pump?utm_medium=cpc&gclid=abc123", "https://www.google.com/"));
    const a = extractAttribution(ctx.pageUrl, ctx.referrer, selfHost);
    expect(a.channel).toBe("paid"); // paid signal wins over the search referrer
    expect(a.gclid).toBe("abc123");
    expect(a.utmMedium).toBe("cpc");
  });
});
