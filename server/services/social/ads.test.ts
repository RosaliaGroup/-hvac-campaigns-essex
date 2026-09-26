import { describe, it, expect, afterEach } from "vitest";
import { flagBoostCandidates, maybeAutoBoost, isSocialBoostEnabled, getSocialBoostDailyCapCents } from "./ads";
import { MockSocialPlatformClient } from "./platformClient";

describe("flagBoostCandidates", () => {
  it("flags a post beating the median by 2x", () => {
    const candidates = flagBoostCandidates(
      [{ postId: 1, platform: "facebook", engagementScore: 100, postUrl: "https://x" }],
      40,
    );
    expect(candidates).toHaveLength(1);
  });

  it("does not flag a post under the 2x threshold", () => {
    const candidates = flagBoostCandidates(
      [{ postId: 1, platform: "facebook", engagementScore: 50, postUrl: "https://x" }],
      40,
    );
    expect(candidates).toHaveLength(0);
  });
});

describe("SOCIAL_BOOST_ENABLED / cap defaults", () => {
  afterEach(() => {
    delete process.env.SOCIAL_BOOST_ENABLED;
    delete process.env.SOCIAL_BOOST_DAILY_CAP;
  });

  it("defaults SOCIAL_BOOST_ENABLED to false", () => {
    expect(isSocialBoostEnabled()).toBe(false);
  });

  it("defaults the daily cap to $10 (1000 cents)", () => {
    expect(getSocialBoostDailyCapCents()).toBe(1000);
  });
});

describe("maybeAutoBoost", () => {
  afterEach(() => {
    delete process.env.SOCIAL_BOOST_ENABLED;
  });

  it("never boosts when SOCIAL_BOOST_ENABLED is false (default)", async () => {
    const client = new MockSocialPlatformClient();
    const outcome = await maybeAutoBoost(
      { postId: 1, platform: "facebook", engagementScore: 100, postUrl: "https://x", isBoostCandidate: true, medianEngagement: 40 },
      client, 0, "https://x", ["Essex"],
    );
    expect(outcome.attempted).toBe(false);
    expect(client.boosts).toHaveLength(0);
  });

  it("boosts through the platform client when enabled and under the cap", async () => {
    process.env.SOCIAL_BOOST_ENABLED = "true";
    const client = new MockSocialPlatformClient();
    const outcome = await maybeAutoBoost(
      { postId: 1, platform: "facebook", engagementScore: 100, postUrl: "https://x", isBoostCandidate: true, medianEngagement: 40 },
      client, 0, "https://x", ["Essex"],
    );
    expect(outcome.attempted).toBe(true);
    expect(client.boosts).toHaveLength(1);
  });

  it("skips when today's spend already hit the daily cap", async () => {
    process.env.SOCIAL_BOOST_ENABLED = "true";
    const client = new MockSocialPlatformClient();
    const outcome = await maybeAutoBoost(
      { postId: 1, platform: "facebook", engagementScore: 100, postUrl: "https://x", isBoostCandidate: true, medianEngagement: 40 },
      client, 1000, "https://x", ["Essex"],
    );
    expect(outcome.attempted).toBe(false);
    expect(client.boosts).toHaveLength(0);
  });
});
