import { describe, it, expect } from "vitest";
import {
  deriveTrafficType,
  pctChange,
  addMetrics,
  emptyChannelSplit,
  EMPTY_METRICS,
  GA4_RANGE_DAYS,
  type Ga4Metrics,
} from "./ga4";

describe("deriveTrafficType", () => {
  it("classifies organic from medium", () => {
    expect(deriveTrafficType("google", "organic")).toBe("organic");
  });

  it("classifies paid from common paid mediums", () => {
    for (const m of ["cpc", "ppc", "paid", "display", "cpm", "paidsocial"]) {
      expect(deriveTrafficType("google", m)).toBe("paid");
    }
  });

  it("prefers a decisive channel group over medium", () => {
    expect(deriveTrafficType("", "", "Paid Search")).toBe("paid");
    expect(deriveTrafficType("", "", "Organic Search")).toBe("organic");
    expect(deriveTrafficType("", "", "Display")).toBe("paid");
  });

  it("still honours a custom-tagged paid campaign when the channel group is blank", () => {
    expect(deriveTrafficType("google", "cpc", "")).toBe("paid");
  });

  it("treats direct / unknown traffic as other (never guessed)", () => {
    expect(deriveTrafficType("(direct)", "(none)")).toBe("other");
    expect(deriveTrafficType(null, null, null)).toBe("other");
    expect(deriveTrafficType("newsletter", "referral")).toBe("other");
  });
});

describe("pctChange", () => {
  it("returns 0 when the previous value is 0 (no divide-by-zero)", () => {
    expect(pctChange(50, 0)).toBe(0);
  });
  it("computes a signed fraction", () => {
    expect(pctChange(120, 100)).toBeCloseTo(0.2);
    expect(pctChange(80, 100)).toBeCloseTo(-0.2);
  });
});

describe("addMetrics", () => {
  it("accumulates every field and returns the accumulator", () => {
    const acc: Ga4Metrics = { ...EMPTY_METRICS };
    const a: Ga4Metrics = { pageViews: 1, sessions: 2, users: 3, conversions: 4, events: 5 };
    const out = addMetrics(acc, a);
    expect(out).toBe(acc);
    expect(out).toEqual(a);
    addMetrics(acc, a);
    expect(acc).toEqual({ pageViews: 2, sessions: 4, users: 6, conversions: 8, events: 10 });
  });
});

describe("emptyChannelSplit", () => {
  it("has independent zeroed buckets per traffic type", () => {
    const s = emptyChannelSplit();
    s.organic.sessions += 1;
    expect(s.paid.sessions).toBe(0);
    expect(s.other.sessions).toBe(0);
  });
});

describe("GA4_RANGE_DAYS", () => {
  it("maps each preset to its day count", () => {
    expect(GA4_RANGE_DAYS).toEqual({ "7d": 7, "28d": 28, "90d": 90 });
  });
});
