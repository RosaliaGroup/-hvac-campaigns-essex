import { describe, expect, it } from "vitest";
import {
  adLibraryLinks,
  brandTermsFor,
  detectAdTech,
  keywordGap,
  normalizeDomain,
  parseSitemap,
  shareOfSearch,
  sitemapsFromRobots,
  summarizeSitemapUrls,
  weeklyChanges,
  type DomainMetrics,
} from "../../../../shared/competitorDashboard";
import { errorDetail, mapHistoricalMetrics, mapKeywordIdeas, mapPageSpeed } from "./competitorDashboard";

function metrics(over: Partial<DomainMetrics>): DomainMetrics {
  return { domain: "x.com", name: "X", isUs: false, capturedAt: "2026-11-02T10:00:00Z", brandDemand: null, siteKeywords: [], sitemap: null, adTech: null, speed: null, errors: [], ...over };
}

describe("normalizeDomain", () => {
  it("strips scheme, www, path and case", () => {
    expect(normalizeDomain("https://www.AJPerri.com/service-area/x")).toBe("ajperri.com");
    expect(normalizeDomain("goldmedalservice.com")).toBe("goldmedalservice.com");
  });
  it("rejects junk", () => {
    expect(normalizeDomain("not a site")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });
});

describe("brandTermsFor", () => {
  it("drops punctuation and dedupes", () => {
    expect(brandTermsFor("A.J. Perri")).toEqual(["a j perri", "aj perri"]);
    expect(brandTermsFor("Gold Medal", ["gold medal service"])).toEqual(["gold medal", "gold medal service"]);
  });
});

describe("detectAdTech", () => {
  it("finds Google Ads, GTM, Meta pixel, call tracking, financing, chat", () => {
    const html = `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-123456789"></script>
      <script>gtag('config','AW-123456789');</script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
      <script>!function(f){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1');</script>
      <script src="//cdn.callrail.com/companies/1/swap.js"></script>
      <a href="https://www.synchrony.com/apply">Finance</a><script src="https://connect.podium.com/widget.js"></script>`;
    const t = detectAdTech(html);
    expect(t.googleAds).toBe(true);
    expect(t.googleTagManager).toBe(true);
    expect(t.metaPixel).toBe(true);
    expect(t.callTracking).toBe("CallRail");
    expect(t.financing).toEqual(["Synchrony"]);
    expect(t.chat).toBe("Podium");
  });
  it("reports nothing on a plain page", () => {
    const t = detectAdTech("<html><body>Hello</body></html>");
    expect(t).toMatchObject({ googleAds: false, metaPixel: false, callTracking: null, financing: [], chat: null });
  });
});

describe("sitemaps", () => {
  it("parses an index and a urlset", () => {
    const idx = parseSitemap(`<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>`);
    expect(idx).toEqual({ isIndex: true, entries: [{ loc: "https://a.com/s1.xml", lastmod: null }] });
    const set = parseSitemap(`<urlset><url><loc><![CDATA[https://a.com/blog/x?a=1&amp;b=2]]></loc><lastmod>2026-10-30</lastmod></url><url><loc>https://a.com/</loc></url></urlset>`);
    expect(set.entries).toEqual([{ loc: "https://a.com/blog/x?a=1&b=2", lastmod: "2026-10-30" }, { loc: "https://a.com/", lastmod: null }]);
  });
  it("counts recent and blog URLs, deduped", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    const s = summarizeSitemapUrls(
      [
        { loc: "https://a.com/blog/new", lastmod: "2026-10-30" },
        { loc: "https://a.com/blog/new", lastmod: "2026-10-30" },
        { loc: "https://a.com/old", lastmod: "2025-01-01" },
        { loc: "https://a.com/about", lastmod: null },
      ],
      now,
    );
    expect(s).toMatchObject({ found: true, urlCount: 3, updatedLast30: 1, blogUrlCount: 1, recent: ["https://a.com/blog/new"] });
  });
  it("reads Sitemap lines from robots.txt", () => {
    expect(sitemapsFromRobots("User-agent: *\nDisallow:\nSitemap: https://a.com/sitemap_index.xml\n")).toEqual(["https://a.com/sitemap_index.xml"]);
  });
});

describe("share of search and keyword gap", () => {
  it("computes shares, skipping domains with no data", () => {
    const rows = shareOfSearch([
      metrics({ domain: "us.com", name: "Us", isUs: true, brandDemand: { terms: [], avgMonthly: 100, monthly: [] } }),
      metrics({ domain: "big.com", name: "Big", brandDemand: { terms: [], avgMonthly: 300, monthly: [] } }),
      metrics({ domain: "none.com", name: "None" }),
    ]);
    expect(rows.map((r) => [r.name, r.share])).toEqual([["Big", 0.75], ["Us", 0.25]]);
  });
  it("leaves out brand terms and keywords we already get impressions for", () => {
    const gap = keywordGap(
      [
        { name: "A.J. Perri", brandTerms: ["aj perri"], keywords: [{ keyword: "aj perri reviews", avgMonthly: 900, competition: null }, { keyword: "heat pump installation", avgMonthly: 500, competition: "high" }, { keyword: "furnace replacement", avgMonthly: 400, competition: null }] },
        { name: "Gold Medal", brandTerms: ["gold medal"], keywords: [{ keyword: "furnace replacement", avgMonthly: 450, competition: null }] },
      ],
      ["Heat Pump Installation"],
    );
    expect(gap).toEqual([{ keyword: "furnace replacement", avgMonthly: 450, competitors: ["A.J. Perri", "Gold Medal"] }]);
  });
});

describe("weeklyChanges", () => {
  it("flags new ad tags, page spikes and big brand-search moves", () => {
    const tech = { googleAds: false, googleTagManager: false, googleAnalytics: false, metaPixel: false, callTracking: null, financing: [], chat: null, reviewsWidget: null };
    const prev = metrics({ name: "Big", adTech: tech, sitemap: { found: true, urlCount: 100, updatedLast30: 0, blogUrlCount: 0, recent: [] }, brandDemand: { terms: [], avgMonthly: 1000, monthly: [] } });
    const cur = metrics({ name: "Big", adTech: { ...tech, googleAds: true, financing: ["GreenSky"] }, sitemap: { found: true, urlCount: 115, updatedLast30: 15, blogUrlCount: 0, recent: [] }, brandDemand: { terms: [], avgMonthly: 1300, monthly: [] } });
    const out = weeklyChanges(cur, prev);
    expect(out).toHaveLength(4);
    expect(out[0]).toMatch(/Google Ads tag/);
    expect(weeklyChanges(cur, null)).toEqual([]);
  });
});

describe("ad library links", () => {
  it("encodes the domain and name", () => {
    const l = adLibraryLinks("A.J. Perri", "ajperri.com");
    expect(l.google).toBe("https://adstransparency.google.com/?region=US&domain=ajperri.com");
    expect(l.meta).toContain("q=A.J.%20Perri");
  });
});

describe("API response mappers", () => {
  it("sums historical metrics across terms and orders months", () => {
    const d = mapHistoricalMetrics(["a", "b"], {
      results: [
        { text: "a", keyword_metrics: { avg_monthly_searches: 70, monthly_search_volumes: [{ year: 2026, month: 10, monthly_searches: 60 }, { year: 2026, month: "OCTOBER", monthly_searches: 80 }] } },
        { text: "b", keyword_metrics: { avg_monthly_searches: "30", monthly_search_volumes: [{ year: 2026, month: 10, monthly_searches: 20 }] } },
      ],
    });
    // MonthOfYear enum: JANUARY = 2, so 10 = SEPTEMBER
    expect(d.avgMonthly).toBe(100);
    expect(d.monthly).toEqual([{ month: "2026-09", searches: 80 }, { month: "2026-10", searches: 80 }]);
  });
  it("maps keyword ideas from an array response", () => {
    const k = mapKeywordIdeas([{ text: "Furnace Repair", keyword_idea_metrics: { avg_monthly_searches: 50, competition: 4 } }, { text: "x", keyword_idea_metrics: { avg_monthly_searches: 90, competition: "LOW" } }]);
    expect(k).toEqual([{ keyword: "x", avgMonthly: 90, competition: "low" }, { keyword: "furnace repair", avgMonthly: 50, competition: "high" }]);
  });
  it("maps PageSpeed results", () => {
    expect(mapPageSpeed({ lighthouseResult: { categories: { performance: { score: 0.534 } }, audits: { "largest-contentful-paint": { numericValue: 4210.6 } } }, originLoadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: {} } } }))
      .toEqual({ mobileScore: 53, lcpMs: 4211, hasFieldData: true });
    expect(mapPageSpeed({})).toEqual({ mobileScore: null, lcpMs: null, hasFieldData: false });
  });
});

describe("errorDetail", () => {
  it("reads GoogleAdsFailure-style errors and plain errors", () => {
    expect(errorDetail({ errors: [{ message: "The caller does not have permission", error_code: { authorization_error: 2 } }] })).toBe('The caller does not have permission {"authorization_error":2}');
    expect(errorDetail(new Error("boom"))).toBe("boom");
  });
});
