import { describe, it, expect } from "vitest";
import {
  LEAD_STAGES, LEAD_STAGE_ENUM, PIPELINE_ORDER,
  normalizeStage, stageLabel, stageIndex, isWon, isLost, isOpen,
  deriveRelationship, relationshipLabel, leadAgeLabel,
} from "./leadPipeline";

describe("lead stages", () => {
  it("defines the 8 stages without 'Booked'", () => {
    const labels = LEAD_STAGES.map(s => s.label);
    expect(labels).toEqual([
      "New", "Contacted", "Assessment Scheduled", "Assessment Completed",
      "Proposal Sent", "Follow Up", "Won", "Lost",
    ]);
    expect(labels).not.toContain("Booked");
    expect(LEAD_STAGES.map(s => s.value)).not.toContain("booked");
  });

  it("keeps legacy values in the DB enum (additive) so old rows stay valid", () => {
    expect(LEAD_STAGE_ENUM).toContain("booked");
    expect(LEAD_STAGE_ENUM).toContain("qualified");
    expect(LEAD_STAGE_ENUM).toContain("assessment_scheduled");
    expect(LEAD_STAGE_ENUM).toContain("won");
  });
});

describe("normalizeStage (legacy mapping)", () => {
  it("maps legacy booked → assessment_scheduled", () => {
    expect(normalizeStage("booked")).toBe("assessment_scheduled");
    expect(stageLabel("booked")).toBe("Assessment Scheduled");
  });
  it("maps legacy qualified → contacted", () => {
    expect(normalizeStage("qualified")).toBe("contacted");
    expect(stageLabel("qualified")).toBe("Contacted");
  });
  it("defaults null/empty to new", () => {
    expect(normalizeStage(null)).toBe("new");
    expect(normalizeStage(undefined)).toBe("new");
    expect(stageLabel(null)).toBe("New");
  });
  it("passes through current stages unchanged", () => {
    for (const v of ["new", "contacted", "assessment_scheduled", "proposal_sent", "won", "lost"]) {
      expect(normalizeStage(v)).toBe(v);
    }
  });
});

describe("stage helpers", () => {
  it("orders the linear pipeline (Won/Lost excluded)", () => {
    expect(PIPELINE_ORDER).toEqual([
      "new", "contacted", "assessment_scheduled", "assessment_completed", "proposal_sent", "follow_up",
    ]);
    expect(stageIndex("new")).toBe(0);
    expect(stageIndex("proposal_sent")).toBe(4);
    expect(stageIndex("booked")).toBe(2); // legacy → assessment_scheduled
    expect(stageIndex("won")).toBe(-1);
  });
  it("classifies terminal + open stages", () => {
    expect(isWon("won")).toBe(true);
    expect(isLost("lost")).toBe(true);
    expect(isOpen("contacted")).toBe(true);
    expect(isOpen("won")).toBe(false);
    expect(isOpen("lost")).toBe(false);
  });
});

describe("deriveRelationship (Lead → Prospect → Customer)", () => {
  it("brand-new lead with no engagement → Lead", () => {
    expect(deriveRelationship({ stage: "new" })).toBe("lead");
    expect(relationshipLabel(deriveRelationship({ stage: "new" }))).toBe("Lead");
  });
  it("engaged lead → Prospect", () => {
    expect(deriveRelationship({ stage: "contacted" })).toBe("prospect");
    expect(deriveRelationship({ stage: "assessment_scheduled" })).toBe("prospect");
    expect(deriveRelationship({ stage: "proposal_sent" })).toBe("prospect");
    expect(deriveRelationship({ stage: "new", hasEngagement: true })).toBe("prospect");
    expect(deriveRelationship({ stage: "booked" })).toBe("prospect"); // legacy engaged
  });
  it("won or linked customer → Customer", () => {
    expect(deriveRelationship({ stage: "won" })).toBe("customer");
    expect(deriveRelationship({ stage: "new", isCustomer: true })).toBe("customer");
  });
  it("labels the three relationships", () => {
    expect(relationshipLabel("lead")).toBe("Lead");
    expect(relationshipLabel("prospect")).toBe("Prospect");
    expect(relationshipLabel("customer")).toBe("Customer");
  });
});

describe("leadAgeLabel", () => {
  const base = "2026-07-06T22:00:00.000Z";
  it("formats minutes, hours, and days", () => {
    expect(leadAgeLabel(base, "2026-07-06T22:30:00.000Z")).toBe("30m");
    expect(leadAgeLabel(base, "2026-07-07T01:00:00.000Z")).toBe("3h");
    expect(leadAgeLabel(base, "2026-07-09T22:00:00.000Z")).toBe("3d");
  });
  it("never goes negative", () => {
    expect(leadAgeLabel("2026-07-07T00:00:00.000Z", "2026-07-06T00:00:00.000Z")).toBe("0m");
  });
});
