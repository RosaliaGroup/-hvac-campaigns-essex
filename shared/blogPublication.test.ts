import { describe, expect, it } from "vitest";
import { publicationDate, blogDateIso, sortPublishedPosts } from "./blogPublication";
import { allBlogPosts } from "../client/src/data/allBlogPosts";
import { blogPosts } from "../client/src/data/blogPosts";
import { commercialGrowthPosts } from "../client/src/data/commercialGrowthPosts";

describe("publication dates and complete blog inventory", () => {
  it("uses the Eastern calendar day across UTC midnight and daylight saving time", () => {
    expect(publicationDate(new Date("2026-10-22T01:00:00Z"))).toBe("October 21, 2026");
    expect(publicationDate(new Date("2026-01-22T04:00:00Z"))).toBe("January 21, 2026");
    expect(publicationDate(new Date("2026-10-22T04:00:00Z"))).toBe("October 22, 2026");
  });

  it("produces machine-readable dates and omits invalid ones", () => {
    expect(blogDateIso("October 21, 2026")).toBe("2026-10-21");
    expect(blogDateIso("2026-10-21")).toBe("2026-10-21");
    for (const post of allBlogPosts) expect(blogDateIso(post.date), post.slug).toMatch(/^2026-\d{2}-\d{2}$/);
    expect(blogDateIso("not a date")).toBeUndefined();
    expect(blogDateIso()).toBeUndefined();
  });

  it("includes the separate commercial collection exactly once", () => {
    expect(allBlogPosts).toHaveLength(blogPosts.length + commercialGrowthPosts.length);
    expect(new Set(allBlogPosts.map(post => post.slug)).size).toBe(allBlogPosts.length);
    for (const post of commercialGrowthPosts) expect(allBlogPosts).toContainEqual(post);
  });

  it("sorts by actual updates while preserving publication history and input order", () => {
    const updated = allBlogPosts.find(post => post.slug === "central-ac-replacement-nj-cost")!;
    const untouched = allBlogPosts.find(post => post.slug === "multifamily-hvac-replacement-occupied-buildings")!;
    const input = [untouched, updated];
    expect(sortPublishedPosts(input)).toEqual([updated, untouched]);
    expect(input).toEqual([untouched, updated]);
    expect(updated.date).toBe("April 12, 2026");
    expect(updated.updatedDate).toBe("October 21, 2026");
    expect(untouched.date).toBe("October 19, 2026");
    expect(untouched.updatedDate).toBeUndefined();
  });
});
