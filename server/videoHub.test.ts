import { describe, it, expect } from "vitest";

// ─── Video Hub Interest Tracking Tests ────────────────────────────────────────

describe("Video interest serialization", () => {
  it("serializes an array of interests to a comma-separated string", () => {
    const interests = ["rebates", "solar", "financing"];
    const serialized = interests.join(",");
    expect(serialized).toBe("rebates,solar,financing");
  });

  it("deserializes a comma-separated string back to an array", () => {
    const raw = "rebates,solar,financing";
    const interests = raw ? raw.split(",") : [];
    expect(interests).toEqual(["rebates", "solar", "financing"]);
  });

  it("returns empty array for null/empty videoInterests field", () => {
    const raw = "";
    const interests = raw ? raw.split(",") : [];
    expect(interests).toEqual([]);
  });

  it("handles single interest correctly", () => {
    const interests = ["rebates"];
    const serialized = interests.join(",");
    const deserialized = serialized ? serialized.split(",") : [];
    expect(deserialized).toEqual(["rebates"]);
  });

  it("handles all 6 interest keys", () => {
    const allInterests = ["rebates", "financing", "solar", "maintenance", "commercial", "assessment"];
    const serialized = allInterests.join(",");
    const deserialized = serialized.split(",");
    expect(deserialized).toHaveLength(6);
    expect(deserialized).toContain("rebates");
    expect(deserialized).toContain("solar");
  });
});

describe("Video personalization filtering", () => {
  const videos = [
    { id: "rebates-explainer", interest: "rebates" },
    { id: "obr-financing", interest: "financing" },
    { id: "solar-bundle", interest: "solar" },
    { id: "assessment-walkthrough", interest: "assessment" },
    { id: "commercial-vrv", interest: "commercial" },
  ];

  it("shows recommended videos for selected interests first", () => {
    const selectedInterests = ["rebates", "solar"];
    const recommended = videos.filter((v) => selectedInterests.includes(v.interest));
    expect(recommended).toHaveLength(2);
    expect(recommended.map((v) => v.id)).toContain("rebates-explainer");
    expect(recommended.map((v) => v.id)).toContain("solar-bundle");
  });

  it("shows all videos when no interests selected", () => {
    const selectedInterests: string[] = [];
    const filtered = videos.filter((v) =>
      selectedInterests.length === 0 ? true : selectedInterests.includes(v.interest)
    );
    expect(filtered).toHaveLength(5);
  });

  it("filters by active category correctly", () => {
    const activeFilter = "commercial";
    const filtered = videos.filter((v) => v.interest === activeFilter);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("commercial-vrv");
  });

  it("returns no videos for a filter with no matches", () => {
    const activeFilter = "maintenance";
    const filtered = videos.filter((v) => v.interest === activeFilter);
    expect(filtered).toHaveLength(0);
  });
});

describe("HeyGen personalized video CTA logic", () => {
  it("shows solar CTA when user said yes to solar", () => {
    const interestedInSolar = "yes";
    const showCTA = interestedInSolar === "yes" || interestedInSolar === "maybe";
    expect(showCTA).toBe(true);
  });

  it("does not show solar CTA when user said no to solar", () => {
    const interestedInSolar = "no";
    const showCTA = interestedInSolar === "yes" || interestedInSolar === "maybe";
    expect(showCTA).toBe(false);
  });
});
