import { describe, it, expect } from "vitest";
import {
  starRatingToInt,
  summarizeMetric,
  ratingTrend,
  averageRating,
  reviewSnippet,
  type GbpInsightPoint,
} from "./gbp";

function pt(date: string, over: Partial<GbpInsightPoint> = {}): GbpInsightPoint {
  return {
    date,
    callClicks: 0,
    directionRequests: 0,
    websiteClicks: 0,
    searchViews: 0,
    mapsViews: 0,
    rating: 0,
    reviewCount: 0,
    ...over,
  };
}

describe("starRatingToInt", () => {
  it("maps the enum strings to 1–5", () => {
    expect(starRatingToInt("ONE")).toBe(1);
    expect(starRatingToInt("THREE")).toBe(3);
    expect(starRatingToInt("FIVE")).toBe(5);
  });
  it("returns 0 for unspecified / unknown / nullish", () => {
    expect(starRatingToInt("STAR_RATING_UNSPECIFIED")).toBe(0);
    expect(starRatingToInt("banana")).toBe(0);
    expect(starRatingToInt(null)).toBe(0);
    expect(starRatingToInt(undefined)).toBe(0);
  });
  it("clamps and rounds numeric input", () => {
    expect(starRatingToInt(4)).toBe(4);
    expect(starRatingToInt(4.6)).toBe(5);
    expect(starRatingToInt(9)).toBe(5);
    expect(starRatingToInt(-2)).toBe(0);
  });
});

describe("summarizeMetric", () => {
  it("sums the current window and computes the delta vs previous", () => {
    const current = [pt("2026-01-01", { callClicks: 10 }), pt("2026-01-02", { callClicks: 20 })];
    const previous = [pt("2025-12-30", { callClicks: 5 }), pt("2025-12-31", { callClicks: 5 })];
    const s = summarizeMetric(current, previous, "callClicks");
    expect(s.total).toBe(30);
    expect(s.delta).toBeCloseTo(2, 5); // (30-10)/10
  });
  it("delta is 0 when the previous window is empty", () => {
    const s = summarizeMetric([pt("2026-01-01", { mapsViews: 7 })], [], "mapsViews");
    expect(s).toEqual({ total: 7, delta: 0 });
  });
});

describe("ratingTrend", () => {
  it("uses the earliest and latest non-zero snapshots", () => {
    const points = [pt("2026-01-01", { rating: 0 }), pt("2026-01-02", { rating: 4.2 }), pt("2026-01-05", { rating: 4.6 })];
    expect(ratingTrend(points)).toEqual({ current: 4.6, previous: 4.2, delta: expect.closeTo(0.4, 5) });
  });
  it("returns zeros when there are no rated snapshots", () => {
    expect(ratingTrend([pt("2026-01-01"), pt("2026-01-02")])).toEqual({ current: 0, previous: 0, delta: 0 });
  });
});

describe("averageRating", () => {
  it("averages only rated reviews, rounded to 2 dp", () => {
    expect(averageRating([{ starRating: 5 }, { starRating: 4 }, { starRating: 0 }])).toBe(4.5);
  });
  it("is 0 for an empty / all-unrated set", () => {
    expect(averageRating([])).toBe(0);
    expect(averageRating([{ starRating: 0 }])).toBe(0);
  });
});

describe("reviewSnippet", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(reviewSnippet("  great   service  ")).toBe("great service");
    expect(reviewSnippet("abcdefghij", 5)).toBe("abcd…");
  });
  it("handles nullish comments", () => {
    expect(reviewSnippet(null)).toBe("");
    expect(reviewSnippet(undefined)).toBe("");
  });
});
