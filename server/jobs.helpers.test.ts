import { describe, expect, it } from "vitest";
import { computeLineTotal, makeJobNumber, JOB_STATUSES } from "./routers/jobs";

describe("jobs — makeJobNumber", () => {
  it("formats ME-YYYY-NNNN with zero padding", () => {
    expect(makeJobNumber(7, 2026)).toBe("ME-2026-0007");
    expect(makeJobNumber(42, 2026)).toBe("ME-2026-0042");
    expect(makeJobNumber(1234, 2026)).toBe("ME-2026-1234");
  });
  it("does not truncate ids beyond 4 digits", () => {
    expect(makeJobNumber(123456, 2027)).toBe("ME-2027-123456");
  });
  it("defaults to the current year", () => {
    expect(makeJobNumber(1)).toBe(`ME-${new Date().getFullYear()}-0001`);
  });
});

describe("jobs — computeLineTotal", () => {
  it("multiplies and formats to cents", () => {
    expect(computeLineTotal(2, 150)).toBe("300.00");
    expect(computeLineTotal(1.5, 100)).toBe("150.00");
    expect(computeLineTotal(3, 33.33)).toBe("99.99");
  });
  it("rounds floating point correctly", () => {
    expect(computeLineTotal(0.1, 0.2)).toBe("0.02");
    expect(computeLineTotal(3, 0.1)).toBe("0.30"); // classic 0.30000000000000004 case
  });
  it("handles zero", () => {
    expect(computeLineTotal(0, 500)).toBe("0.00");
    expect(computeLineTotal(5, 0)).toBe("0.00");
  });
});

describe("jobs — status pipeline definition", () => {
  it("contains the full 11-status pipeline in order", () => {
    expect(JOB_STATUSES).toEqual([
      "new", "scheduled", "in_progress", "waiting_parts", "estimate_sent",
      "approved", "completed", "invoice_sent", "paid", "closed", "cancelled",
    ]);
  });
});
