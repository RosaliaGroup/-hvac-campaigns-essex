import { describe, it, expect } from "vitest";
import { buildQboEstimateBody, nextDocNumberFrom } from "./quickbooks";
import { isDuplicateDocNumber } from "./estimatePush";
import type { AccountingEstimateInput } from "./types";

const itemRef = { value: "21", name: "HVAC Services" };
const baseInput = (docNumber?: string | null): AccountingEstimateInput => ({
  customerRef: "55",
  docNumber,
  privateNote: "Opportunity #7",
  lines: [{ name: "Install", description: null, quantity: 1, unitPrice: 100, amount: 100 }],
});

describe("outbound estimate numbering — QuickBooks assigns the number", () => {
  it("OMITS DocNumber from the QBO body when none is supplied (auto-assign mode)", () => {
    const body = buildQboEstimateBody(baseInput(undefined), itemRef);
    expect(body).not.toHaveProperty("DocNumber");
  });

  it("also omits DocNumber for null/empty (never sends a blank number)", () => {
    expect(buildQboEstimateBody(baseInput(null), itemRef)).not.toHaveProperty("DocNumber");
    expect(buildQboEstimateBody(baseInput(""), itemRef)).not.toHaveProperty("DocNumber");
  });

  it("sends DocNumber only when explicitly supplied (custom-txn-numbers mode), truncated to 21 chars", () => {
    const body = buildQboEstimateBody(baseInput("1042"), itemRef);
    expect(body.DocNumber).toBe("1042");
    const long = buildQboEstimateBody(baseInput("123456789012345678901234567890"), itemRef);
    expect((long.DocNumber as string).length).toBe(21);
  });
});

describe("nextDocNumberFrom — max numeric DocNumber + 1", () => {
  it("returns 1001 (floor+1) when there are no numeric DocNumbers", () => {
    expect(nextDocNumberFrom([])).toBe("1001");
    expect(nextDocNumberFrom([undefined, null, ""])).toBe("1001");
  });

  it("takes the max of strictly-numeric DocNumbers, ignoring formatted ones", () => {
    expect(nextDocNumberFrom(["1001", "1007", "1003"])).toBe("1008");
    // "2026-0001" is NOT strictly numeric → ignored, must not inflate the max.
    expect(nextDocNumberFrom(["1005", "2026-0001", "EST-9"])).toBe("1006");
  });

  it("respects a custom floor", () => {
    expect(nextDocNumberFrom(["50"], 1000)).toBe("1001"); // 50 < floor
    expect(nextDocNumberFrom(["2000"], 1000)).toBe("2001");
  });
});

describe("isDuplicateDocNumber — QBO 6140 detection for the single retry", () => {
  it("matches the duplicate-document-number fault message", () => {
    expect(isDuplicateDocNumber(new Error("QuickBooks estimate push failed: Duplicate Document Number Error : ..."))).toBe(true);
    expect(isDuplicateDocNumber(new Error("Error code 6140: something"))).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isDuplicateDocNumber(new Error("HTTP 401 Unauthorized"))).toBe(false);
    expect(isDuplicateDocNumber(new Error("customer 61402 not found"))).toBe(false); // 6140 must be a standalone token
    expect(isDuplicateDocNumber(undefined)).toBe(false);
  });
});
