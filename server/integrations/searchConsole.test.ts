import { describe, it, expect } from "vitest";
import { parseAnalyticsRows, mapCoverageState, toPath, getSiteOrigin } from "./searchConsole";

describe("parseAnalyticsRows", () => {
  it("maps GSC rows into typed rows", () => {
    const rows = parseAnalyticsRows({
      rows: [{ keys: ["/hvac-newark-nj"], clicks: 58, impressions: 9840, ctr: 0.0059, position: 11.2 }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ keys: ["/hvac-newark-nj"], clicks: 58, impressions: 9840 });
  });

  it("returns [] when there are no rows", () => {
    expect(parseAnalyticsRows({})).toEqual([]);
    expect(parseAnalyticsRows(null)).toEqual([]);
  });
});

describe("mapCoverageState", () => {
  it("maps Google's coverage phrasing to our enum", () => {
    expect(mapCoverageState("Submitted and indexed")).toBe("indexed");
    expect(mapCoverageState("Indexed, not submitted in sitemap")).toBe("indexed");
    expect(mapCoverageState("Crawled - currently not indexed")).toBe("crawled_not_indexed");
    expect(mapCoverageState("Discovered - currently not indexed")).toBe("discovered_not_indexed");
    expect(mapCoverageState("Duplicate without user-selected canonical")).toBe("excluded");
  });

  it("defaults to indexed when empty/unknown", () => {
    expect(mapCoverageState(undefined)).toBe("indexed");
    expect(mapCoverageState("")).toBe("indexed");
  });
});

describe("toPath", () => {
  const origin = "https://mechanicalenterprise.com";
  it("extracts a path from a full URL", () => {
    expect(toPath("https://mechanicalenterprise.com/hvac-newark-nj", origin)).toBe("/hvac-newark-nj");
  });
  it("normalises a bare path", () => {
    expect(toPath("hvac-newark-nj", origin)).toBe("/hvac-newark-nj");
    expect(toPath("/commercial", origin)).toBe("/commercial");
  });
});

describe("getSiteOrigin", () => {
  it("derives an https origin from a domain property", () => {
    const prev = process.env.SEO_GSC_SITE_URL;
    process.env.SEO_GSC_SITE_URL = "sc-domain:mechanicalenterprise.com";
    expect(getSiteOrigin()).toBe("https://mechanicalenterprise.com");
    if (prev === undefined) delete process.env.SEO_GSC_SITE_URL;
    else process.env.SEO_GSC_SITE_URL = prev;
  });
});
