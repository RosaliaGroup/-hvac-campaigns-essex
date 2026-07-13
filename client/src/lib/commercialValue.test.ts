import { describe, it, expect } from "vitest";
import { fmtMoney, fmtEstimatedValue, financialView } from "./commercialOpportunities";

/**
 * Optional estimated value: an unknown value is NEVER rendered as a misleading
 * $0, and derived figures (weighted value, calculated margin) stay blank until
 * their inputs exist. An explicit 0 is a real value and is shown as $0.
 */
describe("fmtEstimatedValue — unknown is labelled, never $0", () => {
  it("returns the fallback for null / blank / undefined", () => {
    expect(fmtEstimatedValue(null)).toBe("Not estimated");
    expect(fmtEstimatedValue("")).toBe("Not estimated");
    expect(fmtEstimatedValue(undefined, "Not yet estimated")).toBe("Not yet estimated");
  });
  it("formats a real value, including an explicit 0", () => {
    expect(fmtEstimatedValue(125000)).toBe(fmtMoney(125000));
    expect(fmtEstimatedValue(0)).toBe(fmtMoney(0)); // 0 is a real value, not "unknown"
    expect(fmtEstimatedValue(0)).not.toBe("Not estimated");
  });
});

describe("fmtMoney — unknown is em-dash, never $0", () => {
  it("null / blank render as —", () => {
    expect(fmtMoney(null)).toBe("—");
    expect(fmtMoney("")).toBe("—");
  });
  it("0 is a real value (not —)", () => {
    expect(fmtMoney(0)).not.toBe("—");
  });
});

describe("financialView — derived figures blank when inputs incomplete", () => {
  it("value unknown → weighted value and margin are null", () => {
    const fin = financialView(null, "1000", null, 50);
    expect(fin.estimatedValue).toBeNull();
    expect(fin.weightedValue).toBeNull();
    expect(fin.calculatedMargin).toBeNull();
    expect(fin.calculatedMarginPercent).toBeNull();
  });
  it("cost present but value unknown → still no margin", () => {
    expect(financialView(null, "5000", null, null).calculatedMargin).toBeNull();
  });
  it("value + cost → margin; value + probability → weighted", () => {
    const fin = financialView("125000", "90000", null, 40);
    expect(fin.calculatedMargin).not.toBeNull();
    expect(fin.weightedValue).not.toBeNull();
  });
});
