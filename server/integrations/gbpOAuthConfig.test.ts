import { describe, expect, it } from "vitest";
import { getDedicatedGbpConfig, buildDedicatedGbpAuthorizeUrl } from "./gbpOAuthConfig";
describe("dedicated GBP OAuth isolation", () => {
  it("fails closed when GBP variables are missing", () => {
    const before = [process.env.GBP_GOOGLE_CLIENT_ID, process.env.GBP_GOOGLE_CLIENT_SECRET, process.env.GBP_GOOGLE_REDIRECT_URI];
    try {
      delete process.env.GBP_GOOGLE_CLIENT_ID;
      delete process.env.GBP_GOOGLE_CLIENT_SECRET;
      delete process.env.GBP_GOOGLE_REDIRECT_URI;
      expect(getDedicatedGbpConfig().configured).toBe(false);
      expect(() => buildDedicatedGbpAuthorizeUrl("state")).toThrow();
    } finally {
      ["GBP_GOOGLE_CLIENT_ID","GBP_GOOGLE_CLIENT_SECRET","GBP_GOOGLE_REDIRECT_URI"].forEach((key, i) => {
        if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i];
      });
    }
  });
  it("accepts only the approved project and callback", () => {
    const prior = [process.env.GBP_GOOGLE_CLIENT_ID, process.env.GBP_GOOGLE_CLIENT_SECRET, process.env.GBP_GOOGLE_REDIRECT_URI];
    try {
      process.env.GBP_GOOGLE_CLIENT_ID = "408029125716-test.apps.googleusercontent.com";
      process.env.GBP_GOOGLE_CLIENT_SECRET = "test";
      process.env.GBP_GOOGLE_REDIRECT_URI = "https://mechanicalenterprise.com/api/integrations/google-business/callback";
      expect(getDedicatedGbpConfig().configured).toBe(true);
      expect(new URL(buildDedicatedGbpAuthorizeUrl("signed")).searchParams.get("scope")).toBe("https://www.googleapis.com/auth/business.manage");
      process.env.GBP_GOOGLE_CLIENT_ID = "1011116946696-test.apps.googleusercontent.com";
      expect(getDedicatedGbpConfig().configured).toBe(false);
    } finally {
      ["GBP_GOOGLE_CLIENT_ID","GBP_GOOGLE_CLIENT_SECRET","GBP_GOOGLE_REDIRECT_URI"].forEach((key, i) => {
        if (prior[i] === undefined) delete process.env[key]; else process.env[key] = prior[i];
      });
    }
  });
});
