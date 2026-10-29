import { describe, expect, it } from "vitest";
import { absolutePageUrl, gscPropertyUrl, normalizeGscLink, originFromGscLink } from "./gscLinks";

const OLD = "https://search.google.com/search-console/inspect?resource_id=https%3A%2F%2Fmechanicalenterprise.com%2F&id=https%3A%2F%2Fmechanicalenterprise.com%2Fhvac-linden-nj";

describe("gscLinks", () => {
  it("builds a property link, with authuser only when given", () => {
    expect(gscPropertyUrl("https://mechanicalenterprise.com/")).toBe("https://search.google.com/search-console?resource_id=https%3A%2F%2Fmechanicalenterprise.com%2F");
    expect(gscPropertyUrl("sc-domain:example.com", "a@b.com")).toBe("https://search.google.com/search-console?resource_id=sc-domain%3Aexample.com&authuser=a%40b.com");
  });

  it("rewrites the old /inspect deep links stored in earlier reports", () => {
    expect(normalizeGscLink(OLD)).toBe("https://search.google.com/search-console?resource_id=https%3A%2F%2Fmechanicalenterprise.com%2F");
    expect(normalizeGscLink("not a url")).toBeNull();
    expect(normalizeGscLink("https://search.google.com/search-console")).toBeNull();
  });

  it("derives the page URL from the property", () => {
    expect(originFromGscLink(OLD)).toBe("https://mechanicalenterprise.com");
    expect(originFromGscLink(gscPropertyUrl("sc-domain:example.com"))).toBeNull();
    expect(absolutePageUrl("https://mechanicalenterprise.com/", "hvac-linden-nj")).toBe("https://mechanicalenterprise.com/hvac-linden-nj");
    expect(absolutePageUrl("https://x.com", "https://y.com/a")).toBe("https://y.com/a");
  });
});
