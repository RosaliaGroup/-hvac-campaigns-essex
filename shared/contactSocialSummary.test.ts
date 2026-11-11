import { describe, expect, it } from "vitest";
import { socialLinksFromProfiles, socialLinkLabel } from "./contactSocialSummary";

describe("socialLinksFromProfiles", () => {
  it("lists person profiles first, then company pages, without duplicates or bad links", () => {
    const links = socialLinksFromProfiles([
      { social: [{ platform: "LinkedIn", url: "https://www.linkedin.com/in/pat/" }], companySocial: [{ platform: "Facebook", url: "https://facebook.com/realco" }] },
      { social: [{ platform: "LinkedIn", url: "https://www.linkedin.com/in/pat" }, { platform: "X", url: "javascript:alert(1)" }] },
    ]);
    expect(links).toEqual([
      { platform: "LinkedIn", url: "https://www.linkedin.com/in/pat/", company: false },
      { platform: "Facebook", url: "https://facebook.com/realco", company: true },
    ]);
    expect(socialLinkLabel(links[1])).toBe("Facebook (company)");
  });
  it("handles contacts with no research yet", () => {
    expect(socialLinksFromProfiles([null, undefined, { social: null }])).toEqual([]);
  });
});
