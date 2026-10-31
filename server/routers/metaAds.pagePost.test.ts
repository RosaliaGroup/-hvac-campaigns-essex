import { describe, expect, it, vi } from "vitest";
vi.mock("../services/socialPublisher", () => ({ publishSocialPost: vi.fn() }));
import { pagePostFromAd } from "./metaAds";

describe("pagePostFromAd", () => {
  it("keeps the ad text and tags the link as organic social", () => {
    const text = pagePostFromAd({ primaryText: " Hello NJ ", landingUrl: "https://mechanicalenterprise.com/lp/x?utm_source=facebook&utm_medium=paid_social&utm_campaign=c" });
    expect(text).toBe("Hello NJ\n\nhttps://mechanicalenterprise.com/lp/x?utm_source=facebook&utm_medium=organic_social&utm_campaign=c");
  });
  it("leaves untagged links alone", () => {
    expect(pagePostFromAd({ primaryText: "Hi", landingUrl: "https://mechanicalenterprise.com/a" })).toBe("Hi\n\nhttps://mechanicalenterprise.com/a");
  });
});
