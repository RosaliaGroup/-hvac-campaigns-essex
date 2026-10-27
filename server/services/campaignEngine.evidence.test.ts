import { describe, expect, it } from "vitest";
import { buildEvidenceBasedRecommendations } from "./campaignEngine";

describe("Marketing Autopilot — evidence-based CRM priorities", () => {
  it("prioritizes real unassigned and overdue CRM records without calling them verified qualified leads", () => {
    const recs = buildEvidenceBasedRecommendations({
      rawCaptures: 14, newUnassigned: 3, overdueFollowUps: 2,
      unknownChannel: 4, advancedStageRecords: 5,
    });
    expect(recs[0].title).toContain("3 unassigned");
    expect(recs[1].title).toContain("2 overdue");
    expect(recs[2].title).toContain("4 website lead");
    expect(recs).toHaveLength(5);
    expect(recs.every(r => r.actionType === "manual" && r.campaignData === null)).toBe(true);
    expect(recs.some(r => /guaranteed|80 qualified leads generated/i.test(r.description))).toBe(false);
  });

  it("does not invent zeros when the CRM is inaccessible", () => {
    const recs = buildEvidenceBasedRecommendations(null);
    expect(recs.some(r => r.title.includes("CRM intake data unavailable"))).toBe(true);
    expect(recs.every(r => r.expectedImpact === "Not yet measured")).toBe(true);
  });

  it("does not invent follow-up problems when all relevant counts are zero", () => {
    const recs = buildEvidenceBasedRecommendations({
      rawCaptures: 0, newUnassigned: 0, overdueFollowUps: 0,
      unknownChannel: 0, advancedStageRecords: 0,
    });
    expect(recs.some(r => /unassigned|overdue|unknown source/i.test(r.title))).toBe(false);
    expect(recs.some(r => /Google Ads/i.test(r.title))).toBe(true);
  });
});
