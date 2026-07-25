import { describe, it, expect } from "vitest";
import {
  appendSortOrder,
  planReorder,
  decideStageMove,
  resolvePropertyLink,
  buildCreateValues,
  isClosedStage,
  OPPORTUNITY_PRIORITIES,
  type BoardCard,
  type StageState,
} from "./opportunityBoard";

const NOW = new Date("2026-07-24T12:00:00.000Z");

function card(over: Partial<BoardCard> = {}): BoardCard {
  return { id: 1, stage: "new", sortOrder: 0, ...over };
}

// ── appendSortOrder ──────────────────────────────────────────────────────────
describe("appendSortOrder", () => {
  it("is 0 for an empty column", () => {
    expect(appendSortOrder([])).toBe(0);
  });
  it("is max+1 for a populated column (ignores gaps/order)", () => {
    expect(appendSortOrder([0, 1, 2])).toBe(3);
    expect(appendSortOrder([5, 2, 9, 1])).toBe(10);
    expect(appendSortOrder([0])).toBe(1);
  });
});

// ── isClosedStage ────────────────────────────────────────────────────────────
describe("isClosedStage", () => {
  it("is true only for won/lost", () => {
    expect(isClosedStage("won")).toBe(true);
    expect(isClosedStage("lost")).toBe(true);
    expect(isClosedStage("new")).toBe(false);
    expect(isClosedStage("proposal_sent")).toBe(false);
    expect(isClosedStage("pending")).toBe(false);
  });
});

// ── planReorder ──────────────────────────────────────────────────────────────
describe("planReorder", () => {
  const cards = [card({ id: 1, sortOrder: 0 }), card({ id: 2, sortOrder: 1 }), card({ id: 3, sortOrder: 2 })];

  it("renumbers only the cards whose rank changes (bounded write)", () => {
    // move id 3 to the top: [3,1,2] → 3:0, 1:1, 2:2 (id 3 and 1 and 2 all shift)
    const plan = planReorder([3, 1, 2], cards);
    expect(plan.kind).toBe("ok");
    if (plan.kind !== "ok") return;
    expect(plan.updates).toEqual([
      { id: 3, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ]);
  });

  it("emits no updates when the order is unchanged", () => {
    const plan = planReorder([1, 2, 3], cards);
    expect(plan).toEqual({ kind: "ok", updates: [] });
  });

  it("swaps two adjacent cards writing exactly two rows", () => {
    const plan = planReorder([2, 1, 3], cards);
    expect(plan.kind).toBe("ok");
    if (plan.kind !== "ok") return;
    expect(plan.updates).toEqual([
      { id: 2, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
    ]);
  });

  it("is stale when an id is missing (a card left the column concurrently)", () => {
    expect(planReorder([1, 2], cards).kind).toBe("stale");
  });

  it("is stale when an unknown id appears (a card entered the column concurrently)", () => {
    expect(planReorder([1, 2, 3, 4], cards).kind).toBe("stale");
  });

  it("is invalid when the ordering contains duplicates", () => {
    expect(planReorder([1, 1, 2, 3], cards).kind).toBe("invalid");
  });
});

// ── decideStageMove ──────────────────────────────────────────────────────────
describe("decideStageMove", () => {
  const open: StageState = { stage: "new", closedAt: null };

  it("not_found when the opportunity is missing", () => {
    expect(decideStageMove(null, { toStage: "pending", placementSortOrder: 0, now: NOW }).kind).toBe("not_found");
  });

  it("moves to an open stage without a close stamp and appends at placement rank", () => {
    const d = decideStageMove(open, { toStage: "proposal_sent", placementSortOrder: 4, now: NOW });
    expect(d.kind).toBe("ok");
    if (d.kind !== "ok") return;
    expect(d.fromStage).toBe("new");
    expect(d.toStage).toBe("proposal_sent");
    expect(d.closing).toBe(false);
    expect(d.set).toEqual({ stage: "proposal_sent", stageOverridden: true, closedAt: null, sortOrder: 4 });
  });

  it("stamps closedAt=now when moving to won/lost", () => {
    const d = decideStageMove(open, { toStage: "won", placementSortOrder: 0, now: NOW });
    expect(d.kind).toBe("ok");
    if (d.kind !== "ok") return;
    expect(d.closing).toBe(true);
    expect(d.set.closedAt).toEqual(NOW);
  });

  it("clears closedAt when re-opening a closed deal", () => {
    const closed: StageState = { stage: "lost", closedAt: new Date("2026-01-01T00:00:00Z") };
    const d = decideStageMove(closed, { toStage: "pending", placementSortOrder: 2, now: NOW });
    expect(d.kind).toBe("ok");
    if (d.kind !== "ok") return;
    expect(d.set.closedAt).toBeNull();
  });

  it("is a noop when the target stage equals the current stage", () => {
    expect(decideStageMove(open, { toStage: "new", placementSortOrder: 0, now: NOW })).toEqual({ kind: "noop", stage: "new" });
  });

  it("is stale when expectedStage does not match current (optimistic concurrency)", () => {
    const d = decideStageMove(open, { toStage: "won", expectedStage: "pending", placementSortOrder: 0, now: NOW });
    expect(d.kind).toBe("stale");
  });

  it("proceeds when expectedStage matches current", () => {
    const d = decideStageMove(open, { toStage: "won", expectedStage: "new", placementSortOrder: 0, now: NOW });
    expect(d.kind).toBe("ok");
  });
});

// ── resolvePropertyLink ──────────────────────────────────────────────────────
describe("resolvePropertyLink", () => {
  it("resolves null when no property is given", () => {
    expect(resolvePropertyLink(null, [1, 2])).toEqual({ kind: "ok", propertyId: null });
    expect(resolvePropertyLink(undefined, [1, 2])).toEqual({ kind: "ok", propertyId: null });
  });
  it("accepts a property the customer owns", () => {
    expect(resolvePropertyLink(2, [1, 2, 3])).toEqual({ kind: "ok", propertyId: 2 });
  });
  it("rejects a property the customer does not own (never silently drops it)", () => {
    expect(resolvePropertyLink(9, [1, 2, 3])).toEqual({ kind: "invalid", propertyId: 9 });
  });
});

// ── buildCreateValues ────────────────────────────────────────────────────────
describe("buildCreateValues", () => {
  it("defaults a minimal manual opportunity (source=manual, stage=new, amount 0.00)", () => {
    const v = buildCreateValues(
      { customerId: 7, title: "  Rooftop RTU replacement  " },
      { sortOrder: 3, propertyId: null },
      NOW,
    );
    expect(v.source).toBe("manual");
    expect(v.stage).toBe("new");
    expect(v.title).toBe("Rooftop RTU replacement"); // trimmed
    expect(v.amount).toBe("0.00");
    expect(v.amountOverridden).toBe(false);
    expect(v.stageOverridden).toBe(false);
    expect(v.priority).toBeNull();
    expect(v.propertyId).toBeNull();
    expect(v.sortOrder).toBe(3);
    expect(v.closedAt).toBeNull();
  });

  it("marks amount/stage overridden and stamps closedAt when created directly as won", () => {
    const v = buildCreateValues(
      {
        customerId: 7,
        title: "Cash job",
        stage: "won",
        amount: 4200,
        probability: 100,
        priority: "high",
        assignedToId: 5,
        expectedCloseAt: NOW,
        propertyId: 2,
      },
      { sortOrder: 0, propertyId: 2 },
      NOW,
    );
    expect(v.amount).toBe("4200.00");
    expect(v.amountOverridden).toBe(true);
    expect(v.stage).toBe("won");
    expect(v.stageOverridden).toBe(true);
    expect(v.priority).toBe("high");
    expect(v.assignedToId).toBe(5);
    expect(v.expectedCloseAt).toEqual(NOW);
    expect(v.propertyId).toBe(2);
    expect(v.closedAt).toEqual(NOW);
  });

  it("throws on an invalid stage value", () => {
    expect(() =>
      buildCreateValues({ customerId: 1, title: "x", stage: "bogus" as never }, { sortOrder: 0, propertyId: null }, NOW),
    ).toThrow();
  });
});

describe("OPPORTUNITY_PRIORITIES", () => {
  it("is the fixed low→urgent ladder", () => {
    expect(OPPORTUNITY_PRIORITIES).toEqual(["low", "medium", "high", "urgent"]);
  });
});
