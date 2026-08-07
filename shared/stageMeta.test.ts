import { describe, it, expect } from "vitest";
import { opportunities } from "../drizzle/schema";
import {
  STAGE_META, STAGE_ORDER,
  OPEN_STAGES, WON_STAGES, LOST_STAGES, PARKED_STAGES, CLOSED_STAGES,
  isOpenStage, isWonStage, isLostStage, isParkedStage, isClosedStage,
  type OpportunityStage,
} from "./stageMeta";

// The ACTUAL DB enum, straight from the drizzle column — not a copied list.
const DB_STAGES = opportunities.stage.enumValues as readonly string[];

describe("STAGE_META tripwire — exhaustive over the opportunities.stage DB enum", () => {
  it("EVERY enum member has a STAGE_META entry (add one when you add a stage!)", () => {
    for (const s of DB_STAGES) {
      expect(
        STAGE_META[s as OpportunityStage],
        `opportunities.stage '${s}' has NO STAGE_META entry — classify it in shared/stageMeta.ts, ` +
        `or it will silently drop out of open-pipeline queries, dashboards and reporting.`,
      ).toBeDefined();
    }
  });

  it("STAGE_META has no phantom members that are absent from the DB enum", () => {
    for (const s of Object.keys(STAGE_META)) {
      expect(DB_STAGES, `STAGE_META has '${s}' which is not in the DB enum`).toContain(s);
    }
  });

  it("the classification sets partition the enum — each stage in exactly one of open/won/lost/parked", () => {
    for (const s of DB_STAGES) {
      const hits = [OPEN_STAGES, WON_STAGES, LOST_STAGES, PARKED_STAGES]
        .filter(set => (set as readonly string[]).includes(s)).length;
      expect(hits, `stage '${s}' must belong to exactly one classification set (found ${hits})`).toBe(1);
    }
  });
});

describe("A2 stage classification semantics", () => {
  it("open = the 8 active stages", () => {
    expect([...OPEN_STAGES].sort()).toEqual(
      ["assessment_completed", "assessment_scheduled", "negotiating", "new", "pending", "proposal_sent", "qualified", "sales_document_created"],
    );
  });
  it("won / lost / parked", () => {
    expect(WON_STAGES).toEqual(["won"]);
    expect(LOST_STAGES).toEqual(["lost"]);
    expect(PARKED_STAGES).toEqual(["follow_up_later"]);
    expect([...CLOSED_STAGES].sort()).toEqual(["lost", "won"]);
  });
  it("follow_up_later is parked — neither open nor closed (excluded from pipeline value AND loss metrics)", () => {
    expect(isParkedStage("follow_up_later")).toBe(true);
    expect(isOpenStage("follow_up_later")).toBe(false);
    expect(isClosedStage("follow_up_later")).toBe(false);
    expect(isWonStage("follow_up_later")).toBe(false);
    expect(isLostStage("follow_up_later")).toBe(false);
  });
  it("STAGE_ORDER is the full enum in ascending sortOrder", () => {
    expect(STAGE_ORDER.length).toBe(DB_STAGES.length);
    const orders = STAGE_ORDER.map(s => STAGE_META[s].sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
