import { describe, expect, it } from "vitest";
import { computeLineTotal, makeJobNumber, JOB_STATUSES, isDuplicateKeyError } from "./routers/jobs";

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

describe("jobs — isDuplicateKeyError (Complete Job race recovery)", () => {
  it("detects a mysql2 duplicate-entry by code", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY", errno: 1062, message: "Duplicate entry '4' for key 'jobCompletions_jobId_unique'" })).toBe(true);
  });
  it("detects by errno alone", () => {
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
  });
  it("detects by message when code/errno are absent", () => {
    expect(isDuplicateKeyError(new Error("Duplicate entry '4' for key 'jobCompletions_jobId_unique'"))).toBe(true);
  });
  it("unwraps a drizzle-wrapped cause", () => {
    const wrapped: any = new Error("Failed query: insert into `jobCompletions` ...");
    wrapped.cause = { code: "ER_DUP_ENTRY", errno: 1062 };
    expect(isDuplicateKeyError(wrapped)).toBe(true);
  });
  it("does NOT match unrelated errors (so they surface as controlled 500s, not fake successes)", () => {
    expect(isDuplicateKeyError(new Error("connection lost"))).toBe(false);
    expect(isDuplicateKeyError({ code: "ER_NO_SUCH_TABLE", errno: 1146 })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
    expect(isDuplicateKeyError("nope")).toBe(false);
  });
  it("terminates on a self-referential cause chain (no infinite loop)", () => {
    const a: any = new Error("x"); a.cause = a;
    expect(isDuplicateKeyError(a)).toBe(false);
  });
});
