import { describe, expect, it } from "vitest";
import {
  canStartAnalysis,
  selectionBlockMessage,
  needsCostConfirm,
  costConfirmMessage,
  COST_CONFIRM_THRESHOLD,
} from "./takeoffSelection";

describe("takeoff selection + cost guards", () => {
  it("cannot start with zero pages selected", () => {
    expect(canStartAnalysis(0)).toBe(false);
    expect(selectionBlockMessage(0)).toBe("Select at least one page.");
  });

  it("can start with at least one page and shows no block message", () => {
    expect(canStartAnalysis(1)).toBe(true);
    expect(canStartAnalysis(4)).toBe(true);
    expect(selectionBlockMessage(1)).toBeNull();
    expect(selectionBlockMessage(4)).toBeNull();
  });

  it("requires cost confirmation only above the 20-page threshold", () => {
    expect(COST_CONFIRM_THRESHOLD).toBe(20);
    expect(needsCostConfirm(4)).toBe(false);
    expect(needsCostConfirm(20)).toBe(false); // exactly 20 → no confirm
    expect(needsCostConfirm(21)).toBe(true);
    expect(needsCostConfirm(88)).toBe(true);
  });

  it("cost confirmation names the selected page count", () => {
    expect(costConfirmMessage(88)).toBe(
      "You selected 88 pages. This may use significant AI credits. Continue?",
    );
  });
});
