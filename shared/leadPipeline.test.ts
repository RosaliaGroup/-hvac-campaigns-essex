import { describe, it, expect } from "vitest";
import {
  LEAD_STAGES, LEAD_STAGE_ENUM, PIPELINE_ORDER,
  normalizeStage, stageLabel, stageIndex, isWon, isLost, isOpen,
  deriveRelationship, relationshipLabel, leadAgeLabel,
  deriveContactRelationship, furthestStage, isWonJobStatus, buildLeadCapturePatch,
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

describe("isWonJobStatus", () => {
  it("treats approved/completed/invoiced/paid/closed jobs as won business", () => {
    for (const s of ["approved", "completed", "invoice_sent", "paid", "closed"]) {
      expect(isWonJobStatus(s)).toBe(true);
    }
  });
  it("does not treat in-progress jobs (or none) as won", () => {
    for (const s of ["new", "scheduled", "in_progress", "waiting_parts", "cancelled", null, undefined]) {
      expect(isWonJobStatus(s)).toBe(false);
    }
  });
});

describe("furthestStage (most-advanced linked capture)", () => {
  it("prefers a won capture over open ones", () => {
    expect(furthestStage(["new", "won", "contacted"])).toBe("won");
  });
  it("returns the furthest open stage when none are won", () => {
    expect(furthestStage(["new", "contacted", "assessment_scheduled"])).toBe("assessment_scheduled");
  });
  it("normalizes legacy values", () => {
    expect(furthestStage(["booked"])).toBe("assessment_scheduled");
  });
  it("returns null for an empty list", () => {
    expect(furthestStage([])).toBeNull();
  });
});

describe("deriveContactRelationship (lifecycle rules)", () => {
  it("website submission with no engagement → Lead", () => {
    expect(deriveContactRelationship({ leadStages: ["new"] })).toBe("lead");
  });
  it("brand-new manual contact (no signals at all) → Lead, never Customer", () => {
    expect(deriveContactRelationship({})).toBe("lead");
    expect(deriveContactRelationship({ leadStages: [], jobStatuses: [] })).toBe("lead");
  });
  it("assessment scheduled → Prospect", () => {
    expect(deriveContactRelationship({ leadStages: ["assessment_scheduled"] })).toBe("prospect");
    expect(deriveContactRelationship({ leadStages: ["proposal_sent"] })).toBe("prospect");
    expect(deriveContactRelationship({ leadStages: ["follow_up"] })).toBe("prospect");
  });
  it("an appointment makes a fresh lead a Prospect", () => {
    expect(deriveContactRelationship({ leadStages: ["new"], hasAppointment: true })).toBe("prospect");
  });
  it("won lead → Customer", () => {
    expect(deriveContactRelationship({ leadStages: ["won"] })).toBe("customer");
  });
  it("a completed job or accepted proposal → Customer", () => {
    expect(deriveContactRelationship({ leadStages: ["new"], jobStatuses: ["completed"] })).toBe("customer");
    expect(deriveContactRelationship({ leadStages: ["contacted"], acceptedProposal: true })).toBe("customer");
  });
  it("a mere customer link (open stage, no won business) is NOT a Customer", () => {
    // Regression: Hector is linked to a customer record but only 'contacted'.
    expect(deriveContactRelationship({ leadStages: ["contacted"], jobStatuses: ["new"] })).toBe("prospect");
    expect(deriveContactRelationship({ leadStages: ["new"], jobStatuses: ["scheduled"] })).toBe("lead");
  });
});

describe("buildLeadCapturePatch (editing lead saves)", () => {
  it("maps editable fields and recomputes name from first/last", () => {
    const patch = buildLeadCapturePatch({ firstName: "Ana", lastName: "Haynes", phone: "8624191763" });
    expect(patch).toMatchObject({ firstName: "Ana", lastName: "Haynes", phone: "8624191763", name: "Ana Haynes" });
  });
  it("coerces empty strings to null", () => {
    const patch = buildLeadCapturePatch({ email: "", phone: "" });
    expect(patch.email).toBeNull();
    expect(patch.phone).toBeNull();
  });
  it("omits fields that were not provided (partial edit never nulls untouched columns)", () => {
    const patch = buildLeadCapturePatch({ notes: "called back" });
    expect(patch).toEqual({ notes: "called back" });
    expect("phone" in patch).toBe(false);
    expect("name" in patch).toBe(false);
  });
  it("maps requested service → message and source → captureType", () => {
    const patch = buildLeadCapturePatch({ message: "Heat pump install", captureType: "quick_quote" });
    expect(patch).toEqual({ message: "Heat pump install", captureType: "quick_quote" });
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
