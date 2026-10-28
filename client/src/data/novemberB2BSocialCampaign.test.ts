import { describe, it, expect } from "vitest";
import { NOVEMBER_B2B_SOCIAL_POSTS, buildNovemberSocialContent, novemberDayOffset } from "./novemberB2BSocialCampaign";

describe("November B2B social campaign", () => {
  it("has 12 unique posts with no rebate/incentive/financing language", () => {
    expect(NOVEMBER_B2B_SOCIAL_POSTS).toHaveLength(12);
    expect(new Set(NOVEMBER_B2B_SOCIAL_POSTS.map(p => p.key)).size).toBe(12);
    for (const p of NOVEMBER_B2B_SOCIAL_POSTS) expect(p.text).not.toMatch(/rebate|incentive|financ|direct install|\bfree\b|guarantee/i);
  });
  it("builds tracked links on the production domain", () => {
    const c = buildNovemberSocialContent(NOVEMBER_B2B_SOCIAL_POSTS[0], "facebook");
    expect(c).toContain("https://mechanicalenterprise.com/blog/nj-multifamily-no-heat-hvac-service-checklist?");
    expect(c).toContain("utm_campaign=me_b2b_nov2026");
    expect(c).toContain("utm_content=nov_noheat");
  });
  it("spaces posts three per week over four weeks", () => {
    expect(NOVEMBER_B2B_SOCIAL_POSTS.map((_, i) => novemberDayOffset(i))).toEqual([0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25]);
  });
});
