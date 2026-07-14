import { describe, expect, it } from "vitest";
import {
  marginView,
  planStageTransition,
  TransitionError,
  computeOpportunityUpdate,
  opportunityPriorityToJobPriority,
  type StageLike,
} from "./commercialOpportunitiesLogic";

const stage = (over: Partial<StageLike>): StageLike => ({
  id: 1,
  stageKey: "new_lead",
  name: "New Lead",
  classification: "open",
  isActive: true,
  ...over,
});

describe("marginView — calculated vs overridden (never conflated)", () => {
  it("derives margin and percent when there is no override", () => {
    const m = marginView("1000.00", "600.00", null);
    expect(m.calculatedMargin).toBe("400.00");
    expect(m.calculatedMarginPercent).toBe(40);
    expect(m.marginIsOverridden).toBe(false);
    expect(m.marginOverride).toBeNull();
    expect(m.effectiveMargin).toBe("400.00");
  });

  it("exposes BOTH calculated and override; effective uses the override", () => {
    const m = marginView("1000.00", "600.00", "350.00");
    expect(m.calculatedMargin).toBe("400.00"); // still exposed, not overwritten
    expect(m.marginOverride).toBe("350.00");
    expect(m.marginIsOverridden).toBe(true);
    expect(m.effectiveMargin).toBe("350.00");
  });

  it("returns null calculated margin when cost is missing", () => {
    const m = marginView("1000.00", null, null);
    expect(m.calculatedMargin).toBeNull();
    expect(m.effectiveMargin).toBeNull();
  });
});

describe("planStageTransition — server-authoritative rules", () => {
  const from = stage({ id: 1, stageKey: "estimating", classification: "open" });

  it("requires explicit confirmation for a won stage", () => {
    const won = stage({ id: 11, stageKey: "awarded", classification: "won" });
    expect(() => planStageTransition({ from, to: won, now: new Date() })).toThrow(TransitionError);
    try {
      planStageTransition({ from, to: won, now: new Date() });
    } catch (e) {
      expect((e as TransitionError).code).toBe("WON_CONFIRMATION_REQUIRED");
    }
  });

  it("populates awardedAt + closedAt and status=awarded on confirmed won", () => {
    const now = new Date("2026-07-12T12:00:00Z");
    const won = stage({ id: 11, stageKey: "awarded", classification: "won" });
    const plan = planStageTransition({ from, to: won, confirmWon: true, now });
    expect(plan.set.status).toBe("awarded");
    expect(plan.set.awardedAt).toEqual(now);
    expect(plan.set.closedAt).toEqual(now);
    expect(plan.set.lostAt).toBeNull();
    expect(plan.event.type).toBe("stage_changed");
    expect(plan.event.metadata).toMatchObject({ fromStageKey: "estimating", toStageKey: "awarded", classification: "won" });
  });

  it("preserves the original awardedAt when moving between won stages", () => {
    const firstAward = new Date("2026-06-01T00:00:00Z");
    const now = new Date("2026-07-12T00:00:00Z");
    const contract = stage({ id: 12, stageKey: "contract_signed", classification: "won" });
    const plan = planStageTransition({ from: stage({ id: 11, stageKey: "awarded", classification: "won" }), to: contract, confirmWon: true, now, existingAwardedAt: firstAward });
    expect(plan.set.awardedAt).toEqual(firstAward);
  });

  it("requires a lost reason for a lost stage", () => {
    const lost = stage({ id: 16, stageKey: "lost", classification: "lost" });
    try {
      planStageTransition({ from, to: lost, now: new Date() });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as TransitionError).code).toBe("LOST_REASON_REQUIRED");
    }
  });

  it("sets lostAt + lossReason on a valid lost transition", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    const lost = stage({ id: 16, stageKey: "lost", classification: "lost" });
    const plan = planStageTransition({ from, to: lost, lostReason: "Chose another vendor", now });
    expect(plan.set.status).toBe("lost");
    expect(plan.set.lostAt).toEqual(now);
    expect(plan.set.lossReason).toBe("Chose another vendor");
    expect(plan.set.awardedAt).toBeNull();
  });

  it("clears terminal timestamps when reopening from won/lost to open", () => {
    const lostFrom = stage({ id: 16, stageKey: "lost", classification: "lost" });
    const open = stage({ id: 6, stageKey: "estimating", classification: "open" });
    const plan = planStageTransition({ from: lostFrom, to: open, now: new Date() });
    expect(plan.reopened).toBe(true);
    expect(plan.set.status).toBe("open");
    expect(plan.set.awardedAt).toBeNull();
    expect(plan.set.lostAt).toBeNull();
    expect(plan.set.closedAt).toBeNull();
    expect(plan.set.lossReason).toBeNull();
    expect(plan.event.type).toBe("reopened");
  });

  it("rejects an inactive target stage and a same-stage move", () => {
    const inactive = stage({ id: 7, stageKey: "internal_review", isActive: false });
    expect(() => planStageTransition({ from, to: inactive, now: new Date() })).toThrow(/STAGE_INACTIVE|not active/i);
    expect(() => planStageTransition({ from, to: from, now: new Date() })).toThrow(/SAME_STAGE|already/i);
  });
});

describe("computeOpportunityUpdate — only real changes are written and logged", () => {
  const existing = {
    title: "Rooftop RTU replacement",
    amount: "1000.00",
    priority: "normal",
    description: null,
    bidDueAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("is a no-op when every value matches (no set, no events)", () => {
    const plan = computeOpportunityUpdate(existing, {
      title: "Rooftop RTU replacement",
      amount: 1000, // number equals "1000.00"
      priority: "normal",
      description: null,
      bidDueAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(plan.set).toEqual({});
    expect(plan.events).toHaveLength(0);
  });

  it("treats '' and null and undefined as equivalent absence", () => {
    const plan = computeOpportunityUpdate(existing, { description: "" });
    expect(plan.events).toHaveLength(0);
  });

  it("writes and logs only the genuinely changed fields", () => {
    const plan = computeOpportunityUpdate(existing, { title: "New title", amount: 1200, priority: "normal" });
    expect(plan.set).toEqual({ title: "New title", amount: "1200.00" });
    expect(plan.events).toHaveLength(2);
    expect(plan.events.every(e => e.type === "field_changed")).toBe(true);
    const fields = plan.events.map(e => e.metadata.field).sort();
    expect(fields).toEqual(["amount", "title"]);
  });

  it("normalizes money to a 2dp string in the set", () => {
    const plan = computeOpportunityUpdate({ estimatedCost: "500.00" }, { estimatedCost: 750.5 });
    expect(plan.set.estimatedCost).toBe("750.50");
  });
});

describe("opportunityPriorityToJobPriority", () => {
  it("maps opportunity priority onto the job priority enum", () => {
    expect(opportunityPriorityToJobPriority("low")).toBe("normal");
    expect(opportunityPriorityToJobPriority("normal")).toBe("normal");
    expect(opportunityPriorityToJobPriority("high")).toBe("urgent");
    expect(opportunityPriorityToJobPriority("urgent")).toBe("emergency");
    expect(opportunityPriorityToJobPriority(null)).toBe("normal");
  });
});
