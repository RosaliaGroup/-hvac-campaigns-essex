import { describe, it, expect } from "vitest";
import {
  formatEstimateNumber,
  ESTIMATE_NUMBER_PENDING_LABEL,
  ESTIMATE_NUMBER_PENDING_SHORT,
} from "./estimateNumber";

describe("formatEstimateNumber — QuickBooks is the numbering authority", () => {
  it("shows the QuickBooks number verbatim when assigned", () => {
    expect(formatEstimateNumber("1042")).toBe("1042");
    expect(formatEstimateNumber("1042", { short: true })).toBe("1042");
    expect(formatEstimateNumber("EST-2026-7")).toBe("EST-2026-7"); // whatever QBO assigned, verbatim
  });

  it("shows the full pending marker when there is no number yet", () => {
    expect(formatEstimateNumber(null)).toBe(ESTIMATE_NUMBER_PENDING_LABEL);
    expect(formatEstimateNumber(undefined)).toBe(ESTIMATE_NUMBER_PENDING_LABEL);
    expect(formatEstimateNumber("")).toBe(ESTIMATE_NUMBER_PENDING_LABEL);
    expect(formatEstimateNumber("   ")).toBe(ESTIMATE_NUMBER_PENDING_LABEL);
  });

  it("shows the compact pending marker in short mode", () => {
    expect(formatEstimateNumber(null, { short: true })).toBe(ESTIMATE_NUMBER_PENDING_SHORT);
    expect(formatEstimateNumber("", { short: true })).toBe(ESTIMATE_NUMBER_PENDING_SHORT);
  });

  it("never emits a locally-generated ME-EST placeholder", () => {
    // The pending markers must not look like a real/local number.
    expect(ESTIMATE_NUMBER_PENDING_LABEL).not.toMatch(/ME-EST/);
    expect(ESTIMATE_NUMBER_PENDING_SHORT).not.toMatch(/ME-EST/);
  });
});
