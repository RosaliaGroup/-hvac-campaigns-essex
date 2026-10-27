import { describe,expect,it } from "vitest";
import { VERIFIED_SOCIAL_LINKS } from "./verifiedSocialLinks";

describe("verified public LinkedIn matches",()=>{
  it("requires exact email and source provenance",()=>{
    expect(VERIFIED_SOCIAL_LINKS.length).toBeGreaterThanOrEqual(6);
    const keys=new Set<string>();
    for(const entry of VERIFIED_SOCIAL_LINKS){
      expect(entry.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
      expect(entry.url).toMatch(/^https:\/\/www\.linkedin\.com\/(in|company)\//);
      expect(entry.source).toBe(entry.url);
      expect(entry.evidence.length).toBeGreaterThan(10);
      expect(entry.kind==="company"?entry.url.includes("/company/"):entry.url.includes("/in/")).toBe(true);
      const key=`${entry.email}:${entry.url}`;
      expect(keys.has(key)).toBe(false);keys.add(key);
    }
  });
  it("does not include suppressed companies or people",()=>{
    expect(VERIFIED_SOCIAL_LINKS.every(p=>!/(onyxequities|vizapropertymanagement|giga)/i.test(p.email))).toBe(true);
  });
});
