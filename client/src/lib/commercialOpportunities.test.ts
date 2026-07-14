import { describe, expect, it } from "vitest";
import {
  buildCommercialListInput,
  isCommercialView,
  groupByStage,
  moveIntent,
  checklistProgress,
  isOverdue,
  nextDate,
  financialView,
  conversionCheckRows,
  COMMERCIAL_VIEWS,
  type BoardStage,
} from "./commercialOpportunities";

const stage = (over: Partial<BoardStage>): BoardStage => ({
  id: 1, stageKey: "new_lead", name: "New Lead", sortOrder: 1, classification: "open", isActive: true, ...over,
});

describe("buildCommercialListInput — server-side filtering, recordType isolation", () => {
  it("always pins recordType to commercial (legacy QBO never leaks in)", () => {
    for (const v of COMMERCIAL_VIEWS) {
      expect(buildCommercialListInput(v.key).recordType).toBe("commercial");
    }
  });

  it("maps view presets to server filters", () => {
    expect(buildCommercialListInput("mine").mine).toBe(true);
    expect(buildCommercialListInput("followups").followUpDue).toBe(true);
    expect(buildCommercialListInput("won").wonLostOpen).toEqual(["won"]);
    expect(buildCommercialListInput("lost").wonLostOpen).toEqual(["lost"]);
    expect(buildCommercialListInput("all").mine).toBeUndefined();
  });

  it("merges user filters and strips empties", () => {
    const input = buildCommercialListInput("all", { search: "  ", stageId: [1, 2], priority: [], city: "Newark" });
    expect(input.search).toBeUndefined(); // blank stripped
    expect(input.priority).toBeUndefined(); // empty array stripped
    expect(input.stageId).toEqual([1, 2]);
    expect(input.city).toBe("Newark");
  });

  it("uses a large board page size and paginates lists", () => {
    expect(buildCommercialListInput("board").limit).toBe(200);
    expect(buildCommercialListInput("all", {}, { limit: 25, offset: 50 })).toMatchObject({ limit: 25, offset: 50 });
    expect(buildCommercialListInput("all").sortBy).toBe("createdAt");
  });

  it("recognizes valid views", () => {
    expect(isCommercialView("board")).toBe(true);
    expect(isCommercialView("nope")).toBe(false);
  });
});

describe("groupByStage — ordered columns, no silent drops", () => {
  const stages = [stage({ id: 3, sortOrder: 3 }), stage({ id: 1, sortOrder: 1 }), stage({ id: 2, sortOrder: 2, isActive: false })];
  it("orders active columns by sortOrder and excludes inactive stages", () => {
    const { columns } = groupByStage([], stages);
    expect(columns.map(c => c.stage.id)).toEqual([1, 3]); // id 2 inactive → not a column
  });
  it("buckets cards and surfaces orphans instead of dropping them", () => {
    const cards = [{ id: 10, stageId: 1 }, { id: 11, stageId: 3 }, { id: 12, stageId: 2 }, { id: 13, stageId: null }];
    const { columns, orphans } = groupByStage(cards, stages);
    expect(columns.find(c => c.stage.id === 1)!.cards.map(c => c.id)).toEqual([10]);
    expect(orphans.map(o => o.id).sort()).toEqual([12, 13]); // inactive-stage card + null-stage card
  });
});

describe("moveIntent — drives won/lost dialogs", () => {
  it("won target requires confirmation", () => {
    expect(moveIntent(1, stage({ id: 11, classification: "won" }))).toBe("confirm_won");
  });
  it("lost target requires a reason", () => {
    expect(moveIntent(1, stage({ id: 16, classification: "lost" }))).toBe("require_lost_reason");
  });
  it("open target is a plain move; same stage is a no-op", () => {
    expect(moveIntent(1, stage({ id: 6, classification: "open" }))).toBe("plain");
    expect(moveIntent(6, stage({ id: 6, classification: "open" }))).toBe("noop");
  });
});

describe("checklistProgress", () => {
  it("computes done/total/pct and conversion readiness", () => {
    const p = checklistProgress([
      { isComplete: true, requiredForConversion: true },
      { isComplete: false, requiredForConversion: true },
      { isComplete: true, requiredForConversion: false },
    ]);
    expect(p).toMatchObject({ total: 3, done: 2, pct: 67, requiredTotal: 2, requiredDone: 1, requiredIncomplete: 1, conversionReady: false });
  });
  it("is conversion-ready when all required items are done", () => {
    expect(checklistProgress([{ isComplete: true, requiredForConversion: true }]).conversionReady).toBe(true);
    expect(checklistProgress([]).conversionReady).toBe(true);
  });
});

describe("card date helpers", () => {
  const now = new Date("2026-07-12T00:00:00Z");
  it("flags overdue bid/follow-up dates", () => {
    expect(isOverdue("2026-07-01", null, now)).toBe(true);
    expect(isOverdue(null, "2026-07-20", now)).toBe(false);
    expect(isOverdue(null, null, now)).toBe(false);
  });
  it("returns the earlier of bid/follow-up as the next date", () => {
    expect(nextDate("2026-08-01", "2026-07-20")!.kind).toBe("followup");
    expect(nextDate("2026-07-15", "2026-08-01")!.kind).toBe("bid");
    expect(nextDate(null, null)).toBeNull();
  });
});

describe("financialView — calculated vs override, both exposed", () => {
  it("derives margin/percent/weighted with no override", () => {
    const f = financialView("1000.00", "600.00", null, 50);
    expect(f.calculatedMargin).toBe("400.00");
    expect(f.calculatedMarginPercent).toBe(40);
    expect(f.marginIsOverridden).toBe(false);
    expect(f.effectiveMargin).toBe("400.00");
    expect(f.weightedValue).toBe("500.00");
  });
  it("keeps calculated visible even when overridden; effective uses override", () => {
    const f = financialView("1000.00", "600.00", "350.00", null);
    expect(f.calculatedMargin).toBe("400.00");
    expect(f.marginOverride).toBe("350.00");
    expect(f.marginIsOverridden).toBe(true);
    expect(f.effectiveMargin).toBe("350.00");
    expect(f.weightedValue).toBe("0.00"); // null probability → 0
  });
});

describe("conversionCheckRows", () => {
  const base = {
    canConvert: true, alreadyConverted: false, existingJob: null,
    blockers: [] as { code: string; message: string }[], propertyResolution: "resolved",
    incompleteRequiredChecklist: [] as { id: number; label: string }[],
  };
  it("all green when there are no blockers", () => {
    expect(conversionCheckRows(base).every(r => r.ok)).toBe(true);
  });
  it("marks the specific failing checks", () => {
    const rows = conversionCheckRows({
      ...base, canConvert: false,
      blockers: [{ code: "STAGE_NOT_ELIGIBLE", message: "x" }, { code: "CHECKLIST_INCOMPLETE", message: "y" }],
      incompleteRequiredChecklist: [{ id: 1, label: "Estimate created" }],
    });
    expect(rows.find(r => r.key === "stage")!.ok).toBe(false);
    expect(rows.find(r => r.key === "checklist")!.ok).toBe(false);
    expect(rows.find(r => r.key === "checklist")!.detail).toContain("Estimate created");
    expect(rows.find(r => r.key === "customer")!.ok).toBe(true);
  });
});
