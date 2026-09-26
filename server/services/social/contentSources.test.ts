import { describe, it, expect } from "vitest";
import { generateJobPhotoPost, generateReviewPost, generateSeasonalPost, generateBlogAmplificationPost, generateVideoPost } from "./contentSources";

describe("generateJobPhotoPost — photoConsent gate", () => {
  it("refuses to generate a post when photoConsent is false", () => {
    const result = generateJobPhotoPost({
      jobId: 1,
      jobType: "heat_pump",
      photoConsent: false,
      photos: [{ url: "https://example.com/before.jpg", category: "before" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/photoConsent/);
  });

  it("refuses when consented but no photos exist", () => {
    const result = generateJobPhotoPost({ jobId: 2, jobType: "heat_pump", photoConsent: true, photos: [] });
    expect(result.ok).toBe(false);
  });

  it("generates a post with no customer/address text when consented with photos", () => {
    const result = generateJobPhotoPost({
      jobId: 3,
      jobType: "heat_pump",
      photoConsent: true,
      photos: [
        { url: "https://example.com/before.jpg", category: "before" },
        { url: "https://example.com/after.jpg", category: "after" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mediaUrls).toHaveLength(2);
      expect(result.content).not.toMatch(/\d{1,5}\s+\w+\s+(St|Ave|Rd)/);
    }
  });
});

describe("generateReviewPost", () => {
  it("skips a review under 20 words", () => {
    const result = generateReviewPost({ reviewerFirstName: "Maria", rating: 5, text: "Great job, fast and clean!", reviewUrl: "https://g.co/r/1" });
    expect(result.ok).toBe(false);
  });

  it("skips a review below 4 stars", () => {
    const result = generateReviewPost({
      reviewerFirstName: "Maria",
      rating: 3,
      text: "It was fine overall, they showed up when they said they would and did the work as described in the estimate, nothing more.",
      reviewUrl: "https://g.co/r/1",
    });
    expect(result.ok).toBe(false);
  });

  it("skips a review mentioning a full name", () => {
    const result = generateReviewPost({
      reviewerFirstName: "Maria",
      rating: 5,
      text: "Our technician Mike Johnson was fantastic, explained everything clearly and left the place spotless, would absolutely recommend to anyone in the area.",
      reviewUrl: "https://g.co/r/1",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a qualifying review, quoting first name only", () => {
    const result = generateReviewPost({
      reviewerFirstName: "Maria",
      rating: 5,
      text: "Fantastic service from start to finish, the crew was on time, explained everything clearly, and cleaned up perfectly before they left. Highly recommend this company.",
      reviewUrl: "https://g.co/r/1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain("Maria");
      // Only the quoted review text itself needs to be free of a full-name-shaped
      // pair — the byline ("— Maria") and the following "Read more reviews" line
      // are expected/safe and would otherwise produce a cross-line false positive.
      const quoted = result.content.split(" — ")[0];
      expect(quoted).not.toMatch(/[A-Z][a-z]+\s+[A-Z][a-z]+/);
    }
  });
});

describe("generateSeasonalPost", () => {
  it("returns a fact-only post for a configured month", () => {
    const result = generateSeasonalPost(new Date("2026-09-15T00:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("skips a month with no calendar entry", () => {
    const result = generateSeasonalPost(new Date("2026-04-15T00:00:00Z"));
    expect(result.ok).toBe(false);
  });
});

describe("generateBlogAmplificationPost", () => {
  it("amplifies a post published within the last 24h", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const result = generateBlogAmplificationPost(
      { slug: "heat-pump-guide", title: "Heat Pump Guide", summary: "Everything you need to know.", publishedAt: new Date("2026-09-26T02:00:00Z") },
      now,
    );
    expect(result.ok).toBe(true);
  });

  it("skips a post outside both windows", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const result = generateBlogAmplificationPost(
      { slug: "old-post", title: "Old Post", summary: "...", publishedAt: new Date("2026-09-01T12:00:00Z") },
      now,
    );
    expect(result.ok).toBe(false);
  });
});

describe("generateVideoPost", () => {
  it("is disabled by default (SOCIAL_VIDEO_ENABLED unset)", () => {
    delete process.env.SOCIAL_VIDEO_ENABLED;
    const result = generateVideoPost();
    expect(result.ok).toBe(false);
  });
});
