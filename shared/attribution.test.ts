import { describe, it, expect } from "vitest";
import { normalizePath, classifyChannel, extractAttribution, normalizeHost } from "./attribution";

describe("normalizePath", () => {
  it("extracts pathname from a full URL, dropping query and fragment", () => {
    expect(normalizePath("https://mechanicalenterprise.com/hvac-newark-nj?utm_source=google#top")).toBe("/hvac-newark-nj");
  });

  it("lowercases and strips a trailing slash (except root)", () => {
    expect(normalizePath("https://site.com/HVAC/Newark/")).toBe("/hvac/newark");
    expect(normalizePath("https://site.com/")).toBe("/");
    expect(normalizePath("HTTPS://SITE.COM")).toBe("/");
  });

  it("handles bare paths, protocol-relative, and query-only tails", () => {
    expect(normalizePath("/hvac-newark-nj/")).toBe("/hvac-newark-nj");
    expect(normalizePath("hvac-newark-nj")).toBe("/hvac-newark-nj");
    expect(normalizePath("//site.com/hvac?x=1")).toBe("/hvac");
    expect(normalizePath("/a//b///c?q=1")).toBe("/a/b/c");
  });

  it("percent-decodes and defaults empty/garbage to root", () => {
    expect(normalizePath("/heat%20pump")).toBe("/heat pump");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath(null)).toBe("/");
    expect(normalizePath(undefined)).toBe("/");
  });

  it("produces identical output for a lead URL and the GSC-style pathname (the join contract)", () => {
    const leadSide = normalizePath("https://mechanicalenterprise.com/Commercial-HVAC/?utm_medium=cpc&gclid=abc");
    const gscSide = normalizePath("/commercial-hvac"); // seoPages.page (raw pathname) re-normalized at read time
    expect(leadSide).toBe(gscSide);
  });
});

describe("classifyChannel — honest, deterministic", () => {
  it("paid: gclid alone forces paid regardless of other signals", () => {
    expect(classifyChannel({ gclid: "Cj0abc", referrerHost: "google.com" })).toBe("paid");
  });

  it("paid: paid utm_medium values", () => {
    for (const m of ["cpc", "ppc", "paid", "display", "paid-search"]) {
      expect(classifyChannel({ utmMedium: m })).toBe("paid");
    }
  });

  it("organic ONLY from an affirmative signal, never from absence", () => {
    expect(classifyChannel({ referrerHost: "www.google.com" })).toBe("organic");
    expect(classifyChannel({ utmMedium: "organic" })).toBe("organic");
    // No signals at all is NOT organic.
    expect(classifyChannel({})).toBe("unknown");
  });

  it("a paid utm on a google referrer is paid, not organic", () => {
    expect(classifyChannel({ utmMedium: "cpc", referrerHost: "google.com" })).toBe("paid");
  });

  it("social from referrer host or utm_medium", () => {
    expect(classifyChannel({ referrerHost: "l.facebook.com" })).toBe("social");
    expect(classifyChannel({ referrerHost: "t.co" })).toBe("social");
    expect(classifyChannel({ utmMedium: "social" })).toBe("social");
  });

  it("email from utm_medium or webmail host", () => {
    expect(classifyChannel({ utmMedium: "email" })).toBe("email");
    expect(classifyChannel({ referrerHost: "mail.google.com" })).toBe("email");
  });

  it("referral from an explicit non-search external site", () => {
    expect(classifyChannel({ referrerHost: "someblog.com" })).toBe("referral");
    expect(classifyChannel({ utmMedium: "referral" })).toBe("referral");
  });

  it("direct requires an affirmatively-empty referrer with no campaign params", () => {
    expect(classifyChannel({ referrerHost: "" })).toBe("direct");
  });

  it("missing referrer (undefined) stays unknown, not direct", () => {
    expect(classifyChannel({ referrerHost: undefined })).toBe("unknown");
    expect(classifyChannel({})).toBe("unknown");
  });

  it("a self-referral is treated as no external referrer (direct)", () => {
    expect(classifyChannel({ referrerHost: "mechanicalenterprise.com" }, "www.mechanicalenterprise.com")).toBe("direct");
  });
});

describe("normalizeHost", () => {
  it("lowercases and strips www.", () => {
    expect(normalizeHost("WWW.Google.com")).toBe("google.com");
    expect(normalizeHost(null)).toBe("");
  });
});

describe("extractAttribution", () => {
  it("pulls utm/gclid from the URL and derives channel + landing path", () => {
    const a = extractAttribution(
      "https://mechanicalenterprise.com/hvac-newark-nj/?utm_source=google&utm_medium=cpc&utm_campaign=summer&gclid=xyz",
      "https://www.google.com/",
    );
    expect(a.firstTouchLandingPath).toBe("/hvac-newark-nj");
    expect(a.utmSource).toBe("google");
    expect(a.utmMedium).toBe("cpc");
    expect(a.utmCampaign).toBe("summer");
    expect(a.gclid).toBe("xyz");
    expect(a.referrerHost).toBe("google.com");
    expect(a.channel).toBe("paid"); // gclid + cpc
  });

  it("organic search visit with no campaign params", () => {
    const a = extractAttribution("https://mechanicalenterprise.com/ac-repair", "https://www.google.com/search?q=ac+repair");
    expect(a.channel).toBe("organic");
    expect(a.utmSource).toBeNull();
    expect(a.gclid).toBeNull();
  });

  it("no referrer reported → unknown; empty referrer → direct", () => {
    expect(extractAttribution("https://site.com/x").channel).toBe("unknown");
    expect(extractAttribution("https://site.com/x", "").channel).toBe("direct");
  });

  it("accepts gbraid/wbraid as paid click ids", () => {
    expect(extractAttribution("https://site.com/x?gbraid=abc", "").channel).toBe("paid");
    expect(extractAttribution("https://site.com/x?wbraid=abc", "").channel).toBe("paid");
  });
});
