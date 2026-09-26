import { describe, it, expect, afterEach } from "vitest";
import {
  getSocialPostsPerWeekCap,
  getPlatformWeeklyCap,
  isUnderWeeklyCap,
  pickNextContentSource,
  violatesRotationRule,
  enabledContentSources,
  HARD_MAX_POSTS_PER_WEEK,
} from "./cadence";

describe("cadence caps", () => {
  afterEach(() => {
    delete process.env.SOCIAL_POSTS_PER_WEEK;
  });

  it("defaults the global cap to the hard max (7)", () => {
    expect(getSocialPostsPerWeekCap()).toBe(HARD_MAX_POSTS_PER_WEEK);
  });

  it("clamps an env override above 7 down to 7", () => {
    process.env.SOCIAL_POSTS_PER_WEEK = "20";
    expect(getSocialPostsPerWeekCap()).toBe(7);
  });

  it("respects a lower env override", () => {
    process.env.SOCIAL_POSTS_PER_WEEK = "3";
    expect(getSocialPostsPerWeekCap()).toBe(3);
    // and it clamps each platform's default down to that ceiling
    expect(getPlatformWeeklyCap("facebook")).toBe(3);
  });

  it("facebook/instagram default to 3/week, GBP to 2, nextdoor to 1", () => {
    expect(getPlatformWeeklyCap("facebook")).toBe(3);
    expect(getPlatformWeeklyCap("instagram")).toBe(3);
    expect(getPlatformWeeklyCap("google_business")).toBe(2);
    expect(getPlatformWeeklyCap("nextdoor")).toBe(1);
  });

  it("isUnderWeeklyCap enforces the cap", () => {
    expect(isUnderWeeklyCap("facebook", 2)).toBe(true);
    expect(isUnderWeeklyCap("facebook", 3)).toBe(false);
  });
});

describe("content-source rotation", () => {
  const enabled = enabledContentSources({ jobPhotosEnabled: false, videoEnabled: false });

  it("never repeats the immediately-preceding type when an alternative exists", () => {
    const next = pickNextContentSource(["offer"], enabled);
    expect(next).not.toBe("offer");
  });

  it("violatesRotationRule flags a same-as-last candidate", () => {
    expect(violatesRotationRule("offer", ["offer", "blog"])).toBe(true);
    expect(violatesRotationRule("blog", ["offer", "blog"])).toBe(false);
  });

  it("cycles through all enabled sources over repeated picks without ever repeating consecutively", () => {
    let history: string[] = [];
    for (let i = 0; i < 20; i++) {
      const next = pickNextContentSource(history as any, enabled);
      expect(next).not.toBe(history[0]);
      history = [next, ...history];
    }
  });

  it("excludes job_photo/video from rotation when their flags are off", () => {
    expect(enabled).not.toContain("job_photo");
    expect(enabled).not.toContain("video");
  });

  it("includes job_photo when the flag is on", () => {
    const withPhotos = enabledContentSources({ jobPhotosEnabled: true, videoEnabled: false });
    expect(withPhotos).toContain("job_photo");
  });
});
