import { describe, it, expect, afterEach } from "vitest";
import {
  fmtGoogleDate,
  parseDailyMetricSeries,
  aggregateDailyInsights,
  parseReviews,
  parseMedia,
  parsePosts,
  parseLocation,
  getGbpTarget,
} from "./gbp";

describe("fmtGoogleDate", () => {
  it("zero-pads to YYYY-MM-DD", () => {
    expect(fmtGoogleDate({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
    expect(fmtGoogleDate({ year: 2026, month: 12, day: 31 })).toBe("2026-12-31");
  });
  it("returns null on incomplete dates", () => {
    expect(fmtGoogleDate({ year: 2026, month: 1 })).toBeNull();
    expect(fmtGoogleDate(undefined)).toBeNull();
  });
});

describe("parseDailyMetricSeries + aggregateDailyInsights", () => {
  const sample = {
    multiDailyMetricTimeSeries: [
      {
        dailyMetricTimeSeries: [
          {
            dailyMetric: "CALL_CLICKS",
            timeSeries: { datedValues: [{ date: { year: 2026, month: 1, day: 1 }, value: "3" }] },
          },
          {
            dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
            timeSeries: { datedValues: [{ date: { year: 2026, month: 1, day: 1 }, value: "10" }] },
          },
          {
            dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
            timeSeries: { datedValues: [{ date: { year: 2026, month: 1, day: 1 }, value: "40" }] },
          },
          {
            dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
            timeSeries: { datedValues: [{ date: { year: 2026, month: 1, day: 1 } /* value omitted → 0 */ }] },
          },
        ],
      },
    ],
  };

  it("flattens datapoints", () => {
    const flat = parseDailyMetricSeries(sample);
    expect(flat).toContainEqual({ metric: "CALL_CLICKS", date: "2026-01-01", value: 3 });
    expect(flat.find((p) => p.metric === "BUSINESS_IMPRESSIONS_DESKTOP_MAPS")?.value).toBe(0);
  });

  it("sums mobile+desktop search/maps impressions per day", () => {
    const rows = aggregateDailyInsights(parseDailyMetricSeries(sample));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-01-01",
      callClicks: 3,
      searchViews: 50, // 10 + 40
      mapsViews: 0,
    });
  });

  it("degrades to [] on malformed input", () => {
    expect(parseDailyMetricSeries(null)).toEqual([]);
    expect(parseDailyMetricSeries({})).toEqual([]);
    expect(aggregateDailyInsights([])).toEqual([]);
  });
});

describe("parseReviews", () => {
  it("maps star enums, reviewer name and owner reply; keeps totals", () => {
    const parsed = parseReviews({
      averageRating: 4.7,
      totalReviewCount: 128,
      reviews: [
        {
          name: "accounts/1/locations/2/reviews/abc",
          reviewer: { displayName: "Jane D." },
          starRating: "FIVE",
          comment: "Excellent",
          createTime: "2026-01-01T00:00:00Z",
          reviewReply: { comment: "Thanks!", updateTime: "2026-01-02T00:00:00Z" },
        },
        { starRating: "FOUR" }, // no name → dropped
      ],
    });
    expect(parsed.averageRating).toBe(4.7);
    expect(parsed.totalReviewCount).toBe(128);
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.reviews[0]).toMatchObject({
      reviewerName: "Jane D.",
      starRating: 5,
      replyComment: "Thanks!",
      replyTime: "2026-01-02T00:00:00Z",
    });
  });
  it("degrades to empty on malformed input", () => {
    expect(parseReviews(null)).toEqual({ reviews: [], averageRating: 0, totalReviewCount: 0 });
  });
});

describe("parseMedia", () => {
  it("extracts category, url and view count", () => {
    const rows = parseMedia({
      mediaItems: [
        {
          name: "accounts/1/locations/2/media/x",
          locationAssociation: { category: "COVER" },
          googleUrl: "https://g/x",
          insights: { viewCount: "42" },
        },
        { insights: { viewCount: 5 } }, // no name → dropped
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "COVER", googleUrl: "https://g/x", viewCount: 42 });
  });
});

describe("parsePosts", () => {
  it("extracts summary/state/topic", () => {
    const rows = parsePosts({
      localPosts: [{ name: "accounts/1/locations/2/localPosts/p", summary: "Spring sale", state: "LIVE", topicType: "OFFER" }],
    });
    expect(rows[0]).toMatchObject({ summary: "Spring sale", state: "LIVE", topicType: "OFFER" });
  });
});

describe("parseLocation", () => {
  it("joins the storefront address parts", () => {
    const loc = parseLocation({
      title: "Mechanical Enterprise",
      storefrontAddress: { addressLines: ["1 Main St"], locality: "Newark", administrativeArea: "NJ", postalCode: "07102" },
      phoneNumbers: { primaryPhone: "555-1234" },
      websiteUri: "https://example.com",
    });
    expect(loc).toEqual({
      title: "Mechanical Enterprise",
      storefrontAddress: "1 Main St, Newark, NJ, 07102",
      primaryPhone: "555-1234",
      websiteUrl: "https://example.com",
    });
  });
  it("tolerates missing fields", () => {
    expect(parseLocation({})).toEqual({ title: null, storefrontAddress: null, primaryPhone: null, websiteUrl: null });
  });
});

describe("getGbpTarget", () => {
  const saved = { acct: process.env.GBP_ACCOUNT_ID, loc: process.env.GBP_LOCATION_ID };
  afterEach(() => {
    process.env.GBP_ACCOUNT_ID = saved.acct;
    process.env.GBP_LOCATION_ID = saved.loc;
  });
  it("builds v4 and performance resource names", () => {
    process.env.GBP_ACCOUNT_ID = "111";
    process.env.GBP_LOCATION_ID = "222";
    expect(getGbpTarget()).toEqual({
      accountId: "111",
      locationId: "222",
      locationName: "accounts/111/locations/222",
      locationResource: "locations/222",
    });
  });
  it("returns null when unconfigured", () => {
    delete process.env.GBP_ACCOUNT_ID;
    delete process.env.GBP_LOCATION_ID;
    expect(getGbpTarget()).toBeNull();
  });
});
